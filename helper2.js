//
// FashionApp helper functions
//

const fs = require('fs');
const ini = require('ini');
const config = require('./config.js');
const mysql2 = require('mysql2/promise');
const { RekognitionClient } = require('@aws-sdk/client-rekognition');
const { S3Client } = require('@aws-sdk/client-s3');


/** 
 * async get_dbConn
 *
 * Returns a MySQL connection object.
 */
async function get_dbConn() {
    const config_data = fs.readFileSync(config.fashionapp_config_filename, 'utf-8');
    const fashionapp_config = ini.parse(config_data);

    const dbConn = mysql2.createConnection({
        host: fashionapp_config.rds.endpoint,
        port: fashionapp_config.rds.port_number,
        user: fashionapp_config.rds.user_name,
        password: fashionapp_config.rds.user_pwd,
        database: fashionapp_config.rds.db_name,
        multipleStatements: true
    });

    return dbConn;
}


/** 
 * sync get_bucket
 *
 * Returns a configured S3 client using hardcoded credentials.
 */
function get_bucket() {
    const config_data = fs.readFileSync(config.fashionapp_config_filename, 'utf-8');
    const fashionapp_config = ini.parse(config_data);

    return new S3Client({
        region: fashionapp_config.s3.region_name,
        maxAttempts: 3,
        defaultsMode: "standard",
        credentials: {
            accessKeyId: "XXXX",
            secretAccessKey: "XXXX"
        }
    });
}


/** 
 * sync get_bucket_name
 *
 * Returns the S3 bucket name.
 */
function get_bucket_name() {
    const config_data = fs.readFileSync(config.fashionapp_config_filename, 'utf-8');
    const fashionapp_config = ini.parse(config_data);
    return fashionapp_config.s3.bucket_name;
}


/** 
 * sync get_rekognition
 *
 * Returns a configured Rekognition client using hardcoded credentials.
 */
function get_rekognition() {
    const config_data = fs.readFileSync(config.fashionapp_config_filename, 'utf-8');
    const fashionapp_config = ini.parse(config_data);

    return new RekognitionClient({
        region: fashionapp_config.s3.region_name,
        maxAttempts: 3,
        defaultsMode: "standard",
        credentials: {
            accessKeyId: "XXXX",
            secretAccessKey: "XXXX"
        }
    });
}


// Export all helper functions
module.exports = { get_dbConn, get_bucket, get_bucket_name, get_rekognition };