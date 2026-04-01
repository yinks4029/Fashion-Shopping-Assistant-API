//
// API function: get /items
//
// Returns all the items in the database.
//
// Author:
//   yinka ogunseitan
//   Northwestern University
//

const mysql2 = require('mysql2/promise');
const { get_dbConn } = require('./helper2.js');
//
// p_retry requires the use of a dynamic import:
// const pRetry = require('p-retry');
//
const pRetry = (...args) => import('p-retry').then(({default: pRetry}) => pRetry(...args));


/*** get_items:
*
*@param userid (optionalquery parameter) filters the returned images for just this userid
*@returns JSON {message: string, data: [object, object, ...]}
*/
exports.get_items= async (request, response) => {

  async function try_get_items()
  {
    try {
      //
      // open connection to database:
      //
      dbConn = await get_dbConn();

      let userid = request.query.userid;

      let sql;
      let params = [];

      if (userid) {
        sql = `
            SELECT
            itemid,
            userid,
            item_name,
            store_name,
            price,
            material,
            image_s3_key,
            category,
            brand,
            store_url
            FROM clothing_items
            WHERE userid = ?
            ORDER BY itemid ASC;
              `;
        params = [userid];
      }
      else {
        sql = `
          SELECT
          itemid,
          userid,
          item_name,
          store_name,
          price,
          material,
          image_s3_key,
          category,
          brand,
          store_url
        FROM clothing_items
        ORDER BY itemid ASC;
        `;
      }

      //
      // call MySQL to execute query, await for results:
      //
      console.log("executing SQL...");
      
      let [rows, _] = await dbConn.execute(sql, params);
      
      //
      // success, return rows from DB:
      //
      console.log(`done, retrieved ${rows.length} rows`);

      return rows;
    }
    catch (err) {
      //
      // exception:
      //
      console.log("ERROR in try_get_items:");
      console.log(err.message);

      throw err;  

    }
    finally {
      //
      // close connection:
      //
      try { await dbConn.end(); } catch(err) { /*ignore*/ }
    }
  }

  //
  // retry the inner function at most 3 times:
  //
  try {
    console.log("**Call to get /items...");

    let rows = await pRetry( () => try_get_items(), {retries: 2} );

    //
    // success, return data in JSON format:
    //
    console.log("success, sending response...");

    response.json({
      "message": "success",
      "data": rows,
    });
  }
  catch (err) {
    //
    // exception:
    //
    console.log("ERROR:");
    console.log(err.message);

    //
    // if an error occurs it's our fault, so use status code
    // of 500 => server-side error:
    //
    response.status(500).json({
      "message": err.message,
      "data": [],
    });
  }

};
