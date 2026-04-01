//
// API function: get /post_item
//save the item (image + metadata) to S3 + DB 
// post item to s3
// Author:
//   yinka ogunseitan
//   Northwestern University
// 

const { get_dbConn, get_bucket, get_bucket_name, get_rekognition } = require('./helper2.js');
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { DetectLabelsCommand } = require("@aws-sdk/client-rekognition");
const uuid = require("uuid");
const sharp = require('sharp');

//
// p_retry requires the use of a dynamic import:
// const pRetry = require('p-retry');
//
const pRetry = (...args) => import('p-retry').then(({default: pRetry}) => pRetry(...args));


/**
*post_item

*@param userid(required URL parameter)for whom we are uploading this image
*@param request body {local_filename: string, data: base64-encoded string}
*@returns JSON {message: string,assetid:int}

*@description save the item (image + metadata) to S3 + DB 
*/
exports.post_item= async (request, response) => {

  async function try_post_item()
  {

    let dbConn;

    try {

      dbConn = await get_dbConn();
      await dbConn.beginTransaction();

      let userid = request.params.userid;

      let [users] = await dbConn.execute(
      "SELECT username FROM users WHERE userid = ?;",
      [userid]);

      if (users.length === 0) {
        throw new Error("no such userid");
      }
      let username;
      username = users[0].username; 
      const body = request.body ?? {};

      
      // If it cant find any of the info use null
      let local_filename = body.local_filename ?? "image.jpg";
      let item_name = body.item_name ?? null;
      let store_name = body.store_name ?? null;
      let price = body.price ?? null;
      let material = body.material ?? null;
      let brand = body.brand ?? null;
      let image_base64 = body.data ?? null;
      let category = body.category ?? null;
      let url = body.store_url  ?? null;

      if (!image_base64) throw new Error("No image data provided");

      // strip data URL start if its there
      if (image_base64.startsWith("data:")) {
          image_base64 = image_base64.split(",")[1];
      }

      let image_bytes = Buffer.from(image_base64, 'base64');

      let unique_part = uuid.v4();
      let bucketkey = `${username}/${unique_part}-${local_filename}`;
      const jpeg_bytes = await sharp(image_bytes).jpeg().toBuffer();
              

      //upload s3
      let bucket = get_bucket();

       let command = new PutObjectCommand({
        Bucket: get_bucket_name(),
        Key: bucketkey,
        Body: jpeg_bytes
      });
      await bucket.send(command);

      const fields = ['local_filename','item_name','store_name','brand','price','material'];
      const values = fields.map(f => body[f] ?? null);
      values.push(bucketkey); 
      //insert clothing item to the database
      let [result] = await dbConn.execute(
        "INSERT INTO clothing_items (userid, item_name, store_name, brand, price, material, category, store_url, image_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?);",
        [userid, item_name, store_name, brand, price, material, category,url, bucketkey, ]
      );

      let itemid  = result.insertId;
     
      await dbConn.commit();
      await dbConn.end();
      dbConn = null;

    // add rekognition tags
      try {
        let rekognition = get_rekognition();
        let rek_params = {
          Image: {
            S3Object: {
              Bucket: get_bucket_name(),
              Name: bucketkey,
            },
          },
          MaxLabels: 40,
          MinConfidence: 80.0,
        };

        let rek_command = new DetectLabelsCommand(rek_params);
        let rek_results = await rekognition.send(rek_command);

        let labelConn = await get_dbConn();
        try {
          if (rek_results && Array.isArray(rek_results.Labels)) {
            for (let label of rek_results.Labels) {
              await labelConn.execute(
                "INSERT INTO imagelabels (assetid, label, confidence) VALUES (?, ?, ?);",
                [itemid, label.Name, Math.floor(label.Confidence)]
              );
            }
          }
        } finally {
          await labelConn.end();
        }
      } catch (rek_err) {
        console.log("Rekognition error, continuing without labels:", rek_err.message);
      }

      return itemid;

    }
    catch (err) {
      if (dbConn) await dbConn.rollback();
      console.log("post_image error:", err.message);
      throw err;

    }
    finally {

      if (dbConn) await dbConn.end();
    }
  }


  try {
    let itemid = await pRetry(() => try_post_item(), { retries: 2 });

    response.json({
      message: "success",
      itemid: itemid
    });
  }
  catch (err) {
    if (err.message === "no such userid") {
      response.status(400).json({
        message: "no such userid",
        itemid: -1
      });
    }
    else {
      response.status(500).json({
        message: err.message,
        itemid: -1
      });
  }
  }
};
