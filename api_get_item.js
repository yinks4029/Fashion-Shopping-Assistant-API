//
// API function: get /item
//
// Returns an item form the data base
//
// Author:
//   yinka ogunseitan
//   Northwestern University
//

const { get_dbConn, get_bucket, get_bucket_name } = require('./helper2.js');
const { GetObjectCommand } = require("@aws-sdk/client-s3");

// p_retry requires the use of a dynamic import:
// const pRetry = require('p-retry');
const pRetry = (...args) =>
  import('p-retry').then(({ default: pRetry }) => pRetry(...args));
/***
 * 
 * get item
*@param assetid(required URL parameter)of image todownload
*@returns JSON {message: string,userid: int, local_filename: string, data:base64-encoded string}
*/
exports.get_item = async (request, response) => {

  async function try_get_item() {
    let dbConn;

    try {

      const itemid = request.params.itemid;

      if (!itemid || isNaN(parseInt(itemid))) {
        throw new Error("no such itemid");
      }

      //connect to sql
      dbConn = await get_dbConn();

      const sql = `
        SELECT userid, item_name, image_s3_key
        FROM clothing_items
        WHERE itemid = ?;
      `;

      let [rows, _] = await dbConn.execute(sql, [itemid]);

      if (rows.length === 0) {
        throw new Error("no such itemid");
      }

      let row = rows[0];

      let userid = row.userid;
      let item_name = row.item_name;
      let image_s3_key = row.image_s3_key;

      if (!image_s3_key) {
        return {
          message: "success",
          userid,
          item_name,
          data: null
        };
      }

      //get s3
      let bucket = get_bucket();

      let parameters = {
        Bucket: get_bucket_name(),
        Key: image_s3_key
      };

      let command = new GetObjectCommand(parameters);

      let results_s3 = await bucket.send(command);

      let image_str =
        await results_s3.Body.transformToString("base64");

      return {
        message: "success",
        userid,
        item_name,
        data: image_str
      };

    }
    finally {
      try { await dbConn?.end(); } catch (err) {}
    }
  }

  try {

    let result =
      await pRetry(() => try_get_item(), { retries: 2 });

    response.json(result);

  }
  catch (err) {

    if (err.message === "no such itemid") {
      response.status(400).json({
        message: "no such itemid",
        userid: -1
      });
    }
    else {
      response.status(500).json({
        message: err.message,
        userid: -1
      });
    }
  }
};