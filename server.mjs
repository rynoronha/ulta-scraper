import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import pg from "pg";
import crypto from "crypto";
import chalk from "chalk";
import pLimit from "p-limit";
const { Pool } = pg;
import dotenv from "dotenv";
import { createObjectCsvWriter } from "csv-writer";
dotenv.config();

// Set up the database connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Add the StealthPlugin to the PuppeteerExtra instance
puppeteer.use(StealthPlugin());

// Create an array of user agents to rotate through
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36",
];

const scrape = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set a random user agent on each new page
  await page.setUserAgent(
    userAgents[Math.floor(Math.random() * userAgents.length)]
  );
  await page.setViewport({ width: 1280, height: 720 });

  const limit = pLimit(10); // limit concurrent scrapes to 10

  const scrapeJobId = crypto.randomBytes(4).toString("hex");
  const now = new Date();
  const timestamp = now.toISOString();

  let pageNumber = 1;
  let hasNextPage = true;

  const scrapeStartTime = performance.now();

  while (hasNextPage) {
    try {
      const pageStartTime = performance.now();
      await page.goto(
        `https://www.ulta.com/shop/makeup/all?page=${pageNumber}`,
        {
          waitUntil: "networkidle0",
          timeout: 60000,
        }
      );
      const productList = await page.$$(".ProductCard");

      const productInfo = await Promise.all(
        productList.map(async (product) => {
          const brand = await product.$eval(
            ".ProductCard__brand",
            (node) => node.innerText
          );
          const name = await product.$eval(
            ".ProductCard__product",
            (node) => node.innerText
          );
          const price = await product.$eval(
            ".ProductCard__price",
            (node) => node.innerText
          );
          const link = await product.$eval(".ProductCard a", (node) =>
            node.getAttribute("href")
          );
          console.log(
            chalk.yellow(
              `product info for ${name} scraped on product list page`
            )
          );
          return { brand, name, price, link };
        })
      );

      if (productInfo.length === 0) {
        hasNextPage = false;
        break;
      }

      for (let index = 0; index < productInfo.length; index++) {
        const info = productInfo[index];
        await limit(async () => {
          const productPage = await browser.newPage();
          await productPage.goto(info.link, { waitUntil: "networkidle0" });
          let ingredientsArray = [];
          try {
            const ingredients = await productPage.$eval(
              'details[aria-controls="Ingredients"] .Markdown--body-2 > p:first-child',
              (node) => node.textContent
            );
            ingredientsArray = ingredients.split(", ");
          } catch (error) {
            console.log(`No ingredients found for ${info.name}`);
          }
          const imageURLs = await productPage.$$eval(
            ".ProductHero__MediaGallery img",
            (images) => images.map((image) => image.src)
          );
          await productPage.close();
          console.log(
            chalk.yellow(
              `product details for ${info.name} scraped on product details page`
            )
          );
          const query = {
            text: `INSERT INTO product(site, name, brand, price, ingredients, image_urls, scrape_job_id, scrape_date_time)
                VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
            values: [
              "Ulta",
              info.name,
              info.brand,
              info.price,
              ingredientsArray,
              imageURLs,
              scrapeJobId,
              timestamp,
            ],
          };

          try {
            const res = await pool.query(query);
            console.log(
              chalk.green(`Product ${info.name} inserted successfully!`)
            );
          } catch (err) {
            console.log(chalk.red(`error: ${err}`));
          }
        });

        if (index !== productInfo.length - 1) {
          const randomTimeout = Math.floor(Math.random() * 1000) + 5000;
          await new Promise((resolve) => setTimeout(resolve, randomTimeout));
        }
      }

      const pageEndTime = performance.now();

      console.log(
        chalk.blue(
          `Finished scraping and inserting products on page ${pageNumber}. Job took ${
            pageEndTime - pageStartTime
          } milliseconds`
        )
      );

      pageNumber++;
    } catch (e) {
      console.log(chalk.red("error: ", e));
    }
  }

  await browser.close();

  const scrapeEndTime = performance.now();
  console.log(
    chalk.green(
      `Scraping finished! Job took ${
        scrapeEndTime - scrapeStartTime
      } milliseconds`
    )
  );

  try {
    // Retrieve products for latest scrapeJobId from database
    const query = {
      text: `SELECT name, brand, price, array_to_string(ingredients, ',') as ingredients, array_to_string(image_urls, ',') as image_urls
              FROM product
              WHERE scrape_job_id = $1
              ORDER BY name ASC`,
      values: [scrapeJobId],
    };

    const { rows } = await pool.query(query);

    // Write products to CSV file
    const csvWriter = createObjectCsvWriter({
      path: `products-${scrapeJobId}.csv`,
      header: [
        { id: "name", title: "Name" },
        { id: "brand", title: "Brand" },
        { id: "price", title: "Price" },
        { id: "ingredients", title: "Ingredients" },
        { id: "image_urls", title: "Image URLs" },
      ],
    });
    await csvWriter.writeRecords(rows);
    console.log(chalk.green("CSV file created successfully!"));
  } catch (error) {
    console.log(chalk.red(`Error writing CSV file: ${error}`));
  }

  await pool.end();
};

scrape();
