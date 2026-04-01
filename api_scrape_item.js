// API function: scrape item
// scrapes html to get all the info to post item to s3

// Author:
//   yinka ogunseitan
//   Northwestern University
// 
const axios = require("axios");
const cheerio = require("cheerio");


const pRetry = (...args) =>
  import('p-retry').then(({ default: pRetry }) => pRetry(...args));
/***
 * 
 * scrape item
 * @description get the html info for items before uplaoding them
*@param assetid(required URL parameter)of image todownload
*@returns JSON {message: string,userid: int, local_filename: string, data:base64-encoded string}
*/
exports.scrape_item= async (request, response) => {

    try {

        let url = request.body.url;
        let userid = request.body.userid;

        if (!url || !userid) {
            return response.status(400).json({
                message: "missing url or userid"
            });
            }
        // to make sure website doesnt think were a bot add the header
        let page = await axios.get(url, {
            timeout: 5000,
            headers: {
                "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9"
            }
            });
        let $ = cheerio.load(page.data);
        //since json is more standard try to scrape info from there
        // if info is not in json then check html

        //json load first before trying html
        let jsonName = null;
        let jsonImage = null;
        let jsonBrand = null;
        let jsonPrice = null;

        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                let json = JSON.parse($(el).contents().text());

                if (json["@type"] === "Product") {

                jsonName = json.name || null;

                if (Array.isArray(json.image))
                    jsonImage = json.image[0];
                else
                    jsonImage = json.image || null;

                if (json.brand) {
                    jsonBrand = typeof json.brand === "object"
                    ? json.brand.name
                    : json.brand;
                }
                if (json.offers && json.offers.price)
                    jsonPrice = json.offers.price;
                }

            } catch (err) {
                // ignore invalid json
            }
            });

         // get commonly used metadata from json if avaiable

        let name =
        jsonName ||
        $('meta[property="og:title"]').attr("content") ||
        $("title").text();

        let image =
        jsonImage ||
        $('meta[property="og:image"]').attr("content");

        let brand =
        jsonBrand ||
            $('meta[property="og:brand"]').attr("content") ||
            $('[data-brand]').attr("data-brand") ||
            null;

        let price =
            jsonPrice ||
            $('meta[property="product:price:amount"]').attr("content") ||
            $('meta[property="og:price:amount"]').attr("content") ||
            $('[data-price]').attr("data-price") ||
            $(".price").first().text() ||
            null;

        if (price) {
            price = price.replace(/[^0-9.]/g, "");
            }
        //common clothing materials search through them if they match
        let materials = [
            "cotton",
            "polyester",
            "denim",
            "wool",
            "linen",
            "silk",
            "leather",
            "nylon",
            "spandex",
            "rayon",
            "viscose",
            "acrylic",
            "cashmere"
            ];

            let material = null;

            let bodyText = $("body").text().toLowerCase();

            for (let m of materials) {
            if (bodyText.includes(m)) {
                material = m;
                break;
            }
            }

        //category of clothing, common types of clothing
        let category = null;

        let nameLower = name.toLowerCase();

        if (nameLower.includes("shirt") || nameLower.includes("top")){
            category = "top";
        }
        
        else if (nameLower.includes("jeans") || nameLower.includes("pants"))
            {
            category = "pants";
        }
        else if (nameLower.includes("jacket"))
            {
            category = "jacket";
        }

        
        //get the image
        let image_base64 = null;
        // try to find image from one of these meta data tags
        let image_url =
            jsonImage ||
            $('meta[property="og:image"]').attr("content") ||
            $('meta[name="twitter:image"]').attr("content") ||
            $('img[data-src]').first().attr("data-src") ||
            $('img[src*="product"]').first().attr("src") ||
            $('img[src$=".jpg"]').first().attr("src") ||
            $('img[src$=".png"]').first().attr("src") ||
            null;

        // download the image
        image_base64 = null;
        if (image_url) {
            let imgResponse = await axios.get(image_url, { 
                responseType: "arraybuffer", 
                timeout: 5000 
            });
            image_base64 = Buffer.from(imgResponse.data).toString("base64");
        }
 

        response.json({
            message: "scrape success",
            data: {
                userid: userid,
                item_name: name,
                brand: brand,
                price: price,
                material: material,
                category: category,
                store_url: url,
                data: image_base64,
                
            }
            });

    
    }
    
  catch (err) {

    response.status(500).json({
      message: err.message
    });

  }


};
