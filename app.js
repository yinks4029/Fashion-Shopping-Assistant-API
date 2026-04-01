//
// PhotoApp web service based on Node.js and Express. This file
// contains the main function that starts and listens on the
// configured network port. The remaining API functions are 
// defined in separate JS files for easier development.
//
// Authors:
//  yinka ogunseitan
//  Prof. Joe Hummel (initial template)
//  Northwestern University
//
// References:
// Node.js: 
//   https://nodejs.org/
// Express: 
//   https://expressjs.com/
// MySQL2: 
//  https://sidorares.github.io/node-mysql2/docs
// AWS SDK with JS:
//   https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html
//   https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started-nodejs.html
//   https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/
//   https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html
//

const express = require('express');
const app = express();
const config = require('./config.js');

// support larger image uploads/downloads:
app.use(express.json({ strict: false, limit: "50mb" }));


/**
 * main:
 *
 * @description startup code for web service, starts listening on port
 * @param none
 * @returns none
 */
var startTime;

app.listen(config.web_service_port, () => {
  startTime = Date.now();
  console.log(`**Web service running, listening on port ${config.web_service_port}...`);
  //
  // Configure AWS to use our config file:
  //
  process.env.AWS_SHARED_CREDENTIALS_FILE = config.fashionapp_config_filename;
});


/**
 * get /
 * 
 * @description handles request for what would be default page as if
 * we were a web server. Returns startus and how long the service has
 * been up and running (seconds).
 * 
 * @param request
 * @param response
 * @returns {status: string, uptime_in_seconds: integer}
 */
app.get('/', (request, response) => {
  try {
    console.log("**Call to /...");
    
    let uptime = Math.round((Date.now() - startTime) / 1000);

    console.log("sending response...");

    response.json({
      "status": "running",
      "uptime_in_secs": uptime,
    });
  }
  catch(err) {
    console.log("ERROR:");
    console.log(err.message);

    //
    // if something goes wrong it's our fault, ==> use a
    // status code of 500 ==> server-side error:
    //
    response.status(500).json({
      "status": err.message,
      "uptime_in_secs": uptime,
    });
  }
});


//
// web service API functions, one per JS file:

//
// load and define more API functions here:
//
let get_users_file = require('./api_get_users.js');
app.get('/users', get_users_file.get_users);

let get_item = require('./api_get_item.js');
app.get('/item/:itemid', get_item.get_item);

let get_items = require('./api_get_items.js');
app.get('/items', get_items.get_items);

let scrape_item_file = require('./api_scrape_item.js');
app.post('/scrape', scrape_item_file.scrape_item);

let post_item_file = require('./api_post_item.js');
app.post('/item/:userid', post_item_file.post_item);

let post_outfit_item_file = require('./api_post_item_to_outfit.js');
app.post('/outfit_item/:outfitid', post_outfit_item_file.post_item_to_outfit);

let post_new_outfit_item_file = require('./api_post_new_outfit.js');
app.post('/outfit/:userid', post_new_outfit_item_file.post_outfit);

let compare_outfits_file = require('./api_compare_outfits.js');
app.get('/compare_outfits/:outfitid', compare_outfits_file.compare_outfits);

let track_price_file = require('./api_track_price.js');
app.get('/item/price/:itemid', track_price_file.track_price);

