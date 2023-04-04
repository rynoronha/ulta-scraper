# Ulta Beauty Scraper

### Usage

A Node.js scraper that fetches makeup product information including the product's name, brand, price, link, ingredients, and image URLs from the Ulta Beauty website. Once the scraper has fetched the product information, it stores the data in a PostgreSQL database and exports the current batch to a CSV file.

### Technologies Used

- Puppeteer - A Node.js library for controlling headless Chrome/Chromium
- pg - A PostgreSQL client for Node.js
- crypto - A Node.js module for handling cryptographic operations
- chalk - A Node.js module for adding colors to console logs
- p-limit - A Node.js module to limit the number of concurrent promises
- dotenv - A Node.js module to load environment variables from a .env file
- csv-writer - A Node.js module to create CSV files

### Prerequisites

Before running this script, you'll need to have the following:

- Node.js
- PostgreSQL installed and running

### Setting up the Database

To set up the database and create the table, follow these steps:

- Install PostgreSQL if not yet installed, and create a database.
- Create a table named product with the following columns:

  - id: SERIAL PRIMARY KEY
  - site: TEXT
  - name: TEXT
  - brand: TEXT
  - price: TEXT
  - ingredients: TEXT[]
  - image_urls: TEXT[]
  - scrape_job_id: TEXT
  - scrape_date_time: TIMESTAMP

  You can use the following SQL code to create the table:

  ```sql
  CREATE TABLE product (
      id SERIAL PRIMARY KEY,
      site TEXT,
      name TEXT,
      brand TEXT,
      price TEXT,
      ingredients TEXT[],
      image_urls TEXT[],
      scrape_job_id TEXT,
      scrape_date_time TIMESTAMP
  );
  ```

### Running the Scraper

- Clone this repository.
- Install dependencies using `npm install`.
- Create an `.env` file in the root of the project with the following varaibles:
  ```makefile
  DB_USER=your_database_user
  DB_HOST=your_database_host
  DB_NAME=your_database_name
  DB_PASSWORD=your_database_password
  DB_PORT=your_database_port
  ```
- Run the script using `npm start`.

### Bot Detection Strategies

The code uses the following bot detection strategies to avoid detection and prevent blocking:

- **Puppeteer's StealthPlugin**: This plugin is used to avoid detection by hiding Puppeteer's automated browser fingerprints, such as the Chrome driver, navigator.languages, and navigator.plugins.
- **User-Agent Rotation**: A random user agent is set on each new page request, chosen from an array of user agents. This helps to mimic human behavior and avoid detection.
- **Limited Concurrent Scraping**: Scrapes are limited to 10 concurrent requests using p-limit, which also helps to mimic human browsing behavior and avoid detection.

### Future bot-detection improvements

- **Proxy support**: Adding proxy support can help prevent detection by websites that track IP addresses. By using a different IP address for each request, it makes it more difficult for websites to identify the scraper as a bot.
- **CAPTCHA handling**: This could involve using a package like [puppeteer-extra-plugin-recaptcha
  ](https://www.npmjs.com/package/puppeteer-extra-plugin-recaptcha) to detect when a CAPTCHA is presented and automatically solve it.
