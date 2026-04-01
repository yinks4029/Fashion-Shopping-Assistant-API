
// API function: get /compare_outfits
//save the item (image + metadata) to S3 + DB 
// post item to s3
// Author:
//   yinka ogunseitan
//   Northwestern University
// 

const { get_dbConn} = require('./helper2.js');
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

*@description save the item (image + metadata) to S3 + DB 
**/

exports.compare_outfits = async (request, response) => {

  async function try_compare() {
    let dbConn;
    try {
      dbConn = await get_dbConn();

      const outfitid = request.params.outfitid;

      // get all assetids for this outfit U
      // SES ITEMID
      const [items] = await dbConn.execute(
        `SELECT itemid FROM outfit_items WHERE outfitid = ?`,
        [outfitid]
      );

      if (items.length === 0) {
        throw new Error("no such outfitid or outfit has no items");
      }

      const assetIds = items.map(i => i.itemid);

      // fetch labels for this outfit 
      // USES ASSETID
      const [labelsRows] = await dbConn.execute(
        `SELECT label FROM imagelabels WHERE assetid IN (${assetIds.map(() => '?').join(',')})`,
        assetIds
      );

      const outfitLabels = new Set(labelsRows.map(r => r.label));

      // get all other outfits
      const [otherOutfits] = await dbConn.execute(
        `SELECT DISTINCT outfitid FROM outfit_items WHERE outfitid != ?`,
        [outfitid]
      );

      const results = [];

      for (let other of otherOutfits) {
        // get assetids for the other outfit 
        // USE ITEMID
        const [otherItems] = await dbConn.execute(
          `SELECT itemid FROM outfit_items WHERE outfitid = (?)`,
          [other.outfitid]
        );
        const otherAssetIds = otherItems.map(i => i.itemid);

        if (otherAssetIds.length === 0) continue;

        // fetch labels for the other outfit
        const [otherLabelsRows] = await dbConn.execute(
          `SELECT label FROM imagelabels WHERE assetid IN (${otherAssetIds.map(() => '?').join(',')})`,
          otherAssetIds
        );

        const otherLabels = new Set(otherLabelsRows.map(r => r.label));

        // compute similarity
        const intersection = [...outfitLabels].filter(label => otherLabels.has(label));
        const union = new Set([...outfitLabels, ...otherLabels]);
        const similarity = union.size === 0 ? 0 : intersection.length / union.size;

        if (similarity > 0) {
          results.push({
            outfitid: other.outfitid,
            similarity: parseFloat(similarity.toFixed(2)),
            common_labels: intersection
          });
        }
      }

      // sort by similarity
      results.sort((a, b) => b.similarity - a.similarity);

      return results;

    } finally {
      if (dbConn) await dbConn.end();
    }
  }

  try {
    const similarOutfits = await pRetry(() => try_compare(), { retries: 2 });
    response.json({ similar_outfits: similarOutfits });
  } catch (err) {
    console.log("compare_outfits error:", err.message);
    response.status(500).json({ message: err.message, similar_outfits: [] });
  }

};

