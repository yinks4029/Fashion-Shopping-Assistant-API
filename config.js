//
// Defines important app-wide config parameters
//
// Web service configuration parameters, separate from the
// photoapp-config file which contains AWS-specific config
// information (e.g. pwds and access keys which we don't
// want in the code).
//
// Initial template:
//   Prof. Hummel
//   Northwestern University
//

const config = {
  fashionapp_config_filename: "fashionapp-config.ini",
  fashionapp_s3_profile: "s3readwrite",
  web_service_port: 8080,
  response_page_size: 12
};

module.exports = config;
