//
// API function: get /post_outfit
//save the otufit (image + metadata) to S3 + DB 
// post outfit to s3
// Author:
//   yinka ogunseitan
//   Northwestern University
// 

const { get_dbConn, get_bucket, get_bucket_name, get_rekognition } = require('./helper2.js');
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { DetectLabelsCommand } = require("@aws-sdk/client-rekognition");
const uuid = require("uuid");


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

*@description save the outfit (image + metadata) to S3 + DB 
*/
exports.post_item_to_outfit= async (request, response) => {

  async function try_item_to_outfit()
  {

    let dbConn;

    try {

      dbConn = await get_dbConn();
      await dbConn.beginTransaction();

      let outfitid = request.params.outfitid;
      let itemid = request.body.itemid;

      if (!itemid) {
        throw new Error("missing itemid");
      }

      // verify outfit 
      let [outfits] = await dbConn.execute(
        "SELECT outfitid FROM outfits WHERE outfitid=?;",
        [outfitid]
      );

      if (outfits.length === 0) {
        throw new Error("no such outfitid");
      }

      // verify item 
      let [items] = await dbConn.execute(
        "SELECT itemid FROM clothing_items WHERE itemid=?;",
        [itemid]
      );

      if (items.length === 0) {
        throw new Error("no such itemid");
      }

      // insert into outfit_items
      let [result] = await dbConn.execute(
        "INSERT INTO outfit_items (outfitid, itemid) VALUES (?, ?);",
        [outfitid, itemid]
      );

      let outfititemid = result.insertId;

      await dbConn.commit();
      await dbConn.end();
      dbConn = null;

      return outfititemid;

    }
    catch (err) {
      if (dbConn) await dbConn.rollback();
      console.log("item_to_outfit error:", err.message);
      throw err;

    }
    finally {

      if (dbConn) await dbConn.end();
    }
  }

  try {

    let outfititemid = await pRetry(() => try_item_to_outfit(), { retries: 2 });

    response.json({
      message: "success",
      outfititemid: outfititemid
    });

  }
  catch (err) {

    response.status(500).json({
      message: err.message,
      outfititemid: -1
    });

  }

};