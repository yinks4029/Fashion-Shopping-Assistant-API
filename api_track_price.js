//
// API function: get /track price
//save the item (image + metadata) to S3 + DB 
// post item to s3
// Author:
//   yinka ogunseitan
//   Northwestern University
// 

const { get_dbConn } = require('./helper2.js');
const axios = require('axios');
const cheerio = require('cheerio');

//
// p_retry requires the use of a dynamic import:
// const pRetry = require('p-retry');
//
const pRetry = (...args) => import('p-retry').then(({default: pRetry}) => pRetry(...args));


/**
*track price

*@param userid(required URL parameter)for whom we are uploading this image
*@param request body {local_filename: string, data: base64-encoded string}
*@returns JSON {message: string,assetid:int}

*@description save the item (image + metadata) to S3 + DB 
*/

exports.track_price = async (request, response) => {
  const itemid = request.params.itemid;
  if (!itemid) return response.status(400).json({ message: "itemid is required" });

  try {
    const dbConn = await get_dbConn();

    // get price that was instered when the item was first posted
    const [items] = await dbConn.execute(
      "SELECT store_url, price FROM clothing_items WHERE itemid = ?",
      [itemid]
    );
    if (!items.length) throw new Error("no such item");

    const item = items[0];
    let original_price = item.price ? parseFloat(item.price) : null;
    let sale_price = null;
    let discount_info = null;

    //scrape internet to check the most current price
    // check store at call to see if the price is different
    if (item.store_url) {
      try {
        const res = await axios.get(item.store_url, {
          //to make sure they dont think we are a bot and get blocked
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com"
          },
          timeout: 5000,
        });

        const $ = cheerio.load(res.data);
        //scrape for price info
        const priceSelectors = [
          'meta[property="product:price:amount"]',
          'meta[property="og:price:amount"]',
          '.price-sales',
          '.price-sale',
          '.price-standard',
          '.price-original',
          '.price'
        ];

        for (const sel of priceSelectors) {
          const el = $(sel).first();
          let val = el.attr('content') || el.text();
          if (val) {
            const parsed = parseFloat(val.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed)) {
              sale_price = parseFloat(parsed.toFixed(2));
              break;
            }
          }
        }

        if (!sale_price) {
          $('script[type="application/ld+json"]').each((i, el) => {
            try {
              const json = JSON.parse($(el).contents().text());
              if (json["@type"] === "Product" && json.offers && json.offers.price) {
                sale_price = parseFloat(String(json.offers.price).replace(/[^0-9.]/g, ''));
                sale_price = parseFloat(sale_price.toFixed(2));
              }
            } catch (err) { /* ignore */ }
          });
        }


        //check discount compare saved price to current price
        if (sale_price && original_price && original_price > sale_price) {
          const percent = Math.round(((original_price - sale_price) / original_price) * 100);
          discount_info = `${percent}% off`;
        }

      } catch (err) {
        console.warn("Could not fetch or parse store page:", err.message);
      }
    }

    // if no discount
    if (!sale_price && original_price) sale_price = original_price;
    if (!original_price) original_price = "N/A";
    if (!discount_info) discount_info = "N/A";

    // Insert price into db
    await dbConn.execute(
      `INSERT INTO item_prices
         (itemid, sale_price, original_price, discount_info, checked_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [itemid, sale_price, original_price, discount_info]
    );

    await dbConn.end();

    response.json({ message: "success", itemid, sale_price, original_price, discount_info });

  } catch (err) {
    response.status(500).json({ message: err.message });
  }
};