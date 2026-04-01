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
*post_newoutfit

*@param userid(required URL parameter)for whom we are uploading this image
*@param request body {local_filename: string, data: base64-encoded string}
*@returns JSON {message: string,assetid:int}

*@description save the outfit (image + metadata) to S3 + DB 
*/
exports.post_outfit = async (request, response) => {
  async function try_post_outfit() {
    let dbConn;
    try {
      dbConn = await get_dbConn();
      await dbConn.beginTransaction();

      const userid = request.params.userid;
      const { outfit_name, rating } = request.body;

      // add new outfit to db
      let [result] = await dbConn.execute(
        `INSERT INTO outfits (userid, outfit_name, rating) VALUES (?, ?, ?)`,
        [userid, outfit_name ?? null, rating ?? null]
      );

      const outfitid = result.insertId;
      await dbConn.commit();
      await dbConn.end();
      return outfitid;
    } 
    
    catch (err) {
      if (dbConn) await dbConn.rollback();
      throw err;
    } finally {
      if (dbConn) await dbConn.end();
    }
  }

  try {
    const outfitid = await pRetry(() => try_post_outfit(), { retries: 2 });
    response.json({ message: "success", outfitid });
  } 
  catch (err) {
    response.status(500).json({ message: err.message, outfitid: -1 });
  }
};