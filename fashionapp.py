#
# FashionApp API functions that interact with FashionApp web service
# to support downloading and uploading images to S3, along with
# retrieving and updating data in associated fashionapp database.
#
# Initial code (initialize, get_ping, get_users):
#   Prof. Joe Hummel
#   yinka ogunseitan
#   Northwestern University
#

import logging
import requests
import base64
from requests.exceptions import HTTPError, ConnectionError, Timeout
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from configparser import ConfigParser


#
# module-level varibles:
#
WEB_SERVICE_URL = 'set via call to initialize()'


###################################################################
#
# initialize
#
# Initializes local environment need to access PhotoApp web 
# service, based on given client-side configuration file. Call
# this function only once, and call before calling any other 
# API functions.
#
# NOTE: does not check to make sure we can actually reach the
# web service. Call get_ping() to check.
#
def initialize(client_config_file):
  """
  Initializes local environment for AWS access, returning True
  if successful and raising an exception if not. Call this 
  function only once, and call before calling any other API
  functions.
  
  Parameters
  ----------
  client_config_file is the name of the client-side configuration 
  file, probably 'photoapp-client-config.ini', which contains URL 
  for web service.
  
  Returns
  -------
  True if successful, raises an exception if not
  """

  try:
    #
    # extract and save URL of web service for other API functions:
    #
    global WEB_SERVICE_URL

    configur = ConfigParser()
    configur.read(client_config_file)
    WEB_SERVICE_URL = configur.get('client', 'webservice')

    #
    # success:
    #
    return True

  except Exception as err:
    logging.error("initialize():")
    logging.error(str(err))
    raise


def get_users():
  """
  Returns a list of all the users in the database. Each element 
  of the list is a tuple containing userid, username, givenname
  and familyname (in this order). The tuples are ordered by 
  userid, ascending. If an error occurs, an exception is raised.
  Exceptions of type HTTPError are from the underlying web service.
  
  Parameters
  ----------
  N/A
  
  Returns
  -------
  a list of all the users, where each element of the list is a tuple
  containing userid, username, givenname, and familyname in that 
  order. The list is ordered by userid, ascending. On error an 
  exception is raised; exceptions of type HTTPError are from the 
  underlying web service.
  """

  try:
    baseurl = WEB_SERVICE_URL

    url = baseurl + "/users"

    response = requests.get(url)

    if response.status_code == 200:
      #
      # success
      #
      body = response.json()
      rows = body['data']

      # 
      # rows is a dictionary-like list of objects, so
      # let's extract the values and discard the keys
      # to honor the API's return value:
      #
      users = []

      for row in rows:
        userid = row["userid"]
        username = row["username"]
        givenname = row["givenname"]
        familyname = row["familyname"]
        #
        user = (userid, username, givenname, familyname)
        users.append(user)

      return users
    elif response.status_code == 500:
      #
      # failed:
      #
      body = response.json()
      msg = body['message']
      err_msg = f"status code {response.status_code}: {msg}"
      #
      # NOTE: this exception will not trigger retry mechanism, 
      # since we reached the server and the server-side failed, 
      # and we are assuming the server-side is also doing retries.
      #
      raise HTTPError(err_msg)
    else:
      # 
      # something unexpected happened, and in this case we don't 
      # have a JSON-based response, so let Python raise proper
      # HTTPError for us:
      #
      response.raise_for_status()

  except Exception as err:
    logging.error("get_users():")
    logging.error(str(err))
    #
    # raise exception to trigger retry mechanism if appropriate:
    #
    raise

  finally:
    # nothing to do
    pass
###################################################################
#
# get_images
#

def get_item(itemid):
    """
    Calls the /item/:itemid endpoint and returns the metadata + base64 data.
    """
    try:
        url = f"{WEB_SERVICE_URL}/item/{itemid}"
        response = requests.get(url)

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 400:
            raise ValueError(response.json()["message"])
        else:
            response.raise_for_status()

    except Exception as err:
        logging.error("get_item():")
        logging.error(str(err))
        raise


###################################################################
#
# get_images
#
@retry(stop=stop_after_attempt(3), 
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((ConnectionError, Timeout)),
        reraise=True
      )


def get_items(userid = None):
  """
  a list of items
  """

  try:
    url = f"{WEB_SERVICE_URL}/items"

    if userid is not None:
      url += f"?userid={userid}"

    response = requests.get(url)

    if response.status_code == 200:

      body = response.json()
      rows = body["data"]

      items = []

      for row in rows:
        item = (
          row["itemid"],
          row["item_name"],
          row["store_name"],
          row["price"],
          row["material"],
          row["category"],
          row["brand"],
          row["store_url"],
          row["image_s3_key"]
        )
        items.append(item)

      return items

    else:
      response.raise_for_status()

  except Exception as err:
    logging.error("get_items():")
    logging.error(str(err))
    raise

    

###################################################################
#
# post_item
#
@retry(stop=stop_after_attempt(3), 
       wait=wait_exponential(multiplier=1, min=2, max=30),
       retry=retry_if_exception_type((ConnectionError, Timeout)),
       reraise=True
)

def post_item(userid, item_data):
  """
  Saves a clothing item for a user.

  Returns itemid if successful.
  """
  try:
      url = f"{WEB_SERVICE_URL}/item/{userid}"

      response = requests.post(url, json=item_data)

      if response.status_code == 200:
        body = response.json()
        return body["itemid"]

      elif response.status_code == 400:
        body = response.json()
        raise ValueError(body["message"])

      elif response.status_code == 500:
        body = response.json()
        raise HTTPError(body["message"])

      else:
        response.raise_for_status()

  except Exception as err:
    logging.error("post_item():")
    logging.error(str(err))
    raise



###################################################################
#
# get_item
#
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((ConnectionError, Timeout)),
    reraise=True
)
def get_image(assetid, local_filename = None):
  

  try:
    baseurl = WEB_SERVICE_URL
    url = f"{baseurl}/image/{assetid}" 


    response = requests.get(url)

    if response.status_code == 200:
      body = response.json()
      image_base64 = body["data"]
      image_bytes = base64.b64decode(image_base64)



      if local_filename is None:
        local_filename = body["local_filename"]

      with open(local_filename, "wb") as f:
        f.write(image_bytes)

      return local_filename

    elif response.status_code == 404:
      raise ValueError("no such assetid")

    elif response.status_code == 500:
      body = response.json()
      msg = body.get("message", "server error")
      raise HTTPError(f"status code 500: {msg}")

    else:
      response.raise_for_status()

  except Exception as err:
    logging.error("get_image():")
    logging.error(str(err))
    raise
  finally:
      pass


###################################################################
#
# post_outfit
#
@retry(stop=stop_after_attempt(3), 
       wait=wait_exponential(multiplier=1, min=2, max=30),
       retry=retry_if_exception_type((ConnectionError, Timeout)),
       reraise=True
)

def post_outfit(userid,  outfit_name, rating=None):
  """
  Saves a new otufit 

  Returns itemid if successful.
  """
  try:
    url = f"{WEB_SERVICE_URL}/outfit/{userid}"

    data = {
      "outfit_name": outfit_name,
      "rating": rating
    }

    response = requests.post(url, json=data)

    if response.status_code == 200:
      body = response.json()
      return body["outfitid"]

    elif response.status_code == 400:
      raise ValueError(response.json()["message"])

    else:
      response.raise_for_status()

  except Exception as err:
    logging.error("post_outfit():")
    logging.error(str(err))
    raise

###################################################################
#
# add_item_to_outfit
#
@retry(stop=stop_after_attempt(3), 
       wait=wait_exponential(multiplier=1, min=2, max=30),
       retry=retry_if_exception_type((ConnectionError, Timeout)),
       reraise=True
)
def add_item_to_outfit(outfitid, itemid):

  try:
    url = f"{WEB_SERVICE_URL}/outfit_item/{outfitid}"

    data = {
      "itemid": itemid
    }

    response = requests.post(url, json=data)

    if response.status_code == 200:
      return True
    else:
      response.raise_for_status()

  except Exception as err:
    logging.error("add_item_to_outfit():")
    logging.error(str(err))
    raise

###################################################################
#
# get comapre outfit
#
@retry(stop=stop_after_attempt(3), 
       wait=wait_exponential(multiplier=1, min=2, max=30),
       retry=retry_if_exception_type((ConnectionError, Timeout)),
       reraise=True
)

def compare_outfits(outfitid):
    """
    Calls the /compare_outfits/:outfitid endpoint.
    
    """
    try:
        url = f"{WEB_SERVICE_URL}/compare_outfits/{outfitid}"
        response = requests.get(url)

        if response.status_code == 200:
            body = response.json()
            return body.get("similar_outfits", [])
        elif response.status_code == 404:
            raise ValueError("No such outfit")
        else:
            response.raise_for_status()

    except Exception as err:
        logging.error("compare_outfits():")
        logging.error(str(err))
        raise


###################################################################
#
# post track price
#
@retry(stop=stop_after_attempt(3), 
       wait=wait_exponential(multiplier=1, min=2, max=30),
       retry=retry_if_exception_type((ConnectionError, Timeout)),
       reraise=True
)
def track_price(itemid):

  try:
    url = f"{WEB_SERVICE_URL}/track_price/{itemid}"

    response = requests.get(f"{WEB_SERVICE_URL}/item/price/{itemid}")

    if response.status_code == 200:
      body = response.json()

      sale_price = body.get("sale_price")
      original_price = body.get("original_price")
      discount = body.get("discount_info")

      return (sale_price, original_price, discount)

    elif response.status_code == 404:
      raise ValueError("no such item")

    else:
      response.raise_for_status()

  except Exception as err:
    logging.error("track_price():")
    logging.error(str(err))
    raise


###################################################################
#
# get_scrape_item
#
@retry(
  stop=stop_after_attempt(3),
  wait=wait_exponential(multiplier=1, min=2, max=30),
  retry=retry_if_exception_type((ConnectionError, Timeout)),
  reraise=True
)
def scrape_item(userid, url):
  """
  Scrapes a clothing item webpage and returns metadata.
  Returns:
  (name, brand, price, material, category, image_base64)
  """

  try:
    api_url = f"{WEB_SERVICE_URL}/scrape"

    data = {
      "userid": userid,
      "url": url
    }

    response = requests.post(api_url, json=data)

    if response.status_code == 200:

      body = response.json()
      item = body["data"]

      return (
        item.get("item_name"),
        item.get("brand"),
        item.get("price"),
        item.get("material"),
        item.get("category"),
        item.get("store_url"),
        item.get("data")  
      )

    elif response.status_code == 400:
      raise ValueError(response.json()["message"])

    elif response.status_code == 500:
      raise HTTPError(response.json()["message"])

    else:
      response.raise_for_status()

  except Exception as err:
    logging.error("scrape_item():")
    logging.error(str(err))
    raise


