//
// API function: get /users
//
// Returns all the users in the database.
//
// Author:
//   Prof. Joe Hummel
//   Northwestern University
//

const mysql2 = require('mysql2/promise');
const { get_dbConn } = require('./helper2.js');
//
// p_retry requires the use of a dynamic import:
// const pRetry = require('p-retry');
//
const pRetry = (...args) => import('p-retry').then(({default: pRetry}) => pRetry(...args));


/**
 * get_users:
 * 
 * @description returns all the users in the database as a JSON object
 * {message: ..., data: ...} where message is either "success" or an 
 * error message (with status code 500). If successful, the data is a 
 * list of dictionary-like objects of the form {"userid": int, 
 * "username": string, "givenname": string, "familyname": string}, 
 * in order by userid. If an error occurs then the list is empty [].
 *
 * @param none
 * @returns JSON {message: string, data: [object, object, ...]} 
 */
exports.get_users = async (request, response) => {

  async function try_get_users()
  {
    try {
      //
      // open connection to database:
      //
      dbConn = await get_dbConn();

      let sql = `
                SELECT userid, username, givenname, familyname 
                FROM users
                ORDER BY userid ASC;
                `;

      //
      // call MySQL to execute query, await for results:
      //
      console.log("executing SQL...");
      
      let [rows, _] = await dbConn.execute(sql);
      
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
      console.log("ERROR in try_get_users:");
      console.log(err.message);

      throw err;  // re-raise exception to trigger retry mechanism

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
    console.log("**Call to get /users...");

    let rows = await pRetry( () => try_get_users(), {retries: 2} );

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
