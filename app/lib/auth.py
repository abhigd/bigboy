import json
import requests

from app import app

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

def basecamp_auth(access_token, refresh_token, expires_in):
    authorized_headers = {'Authorization': 'Bearer %s' %access_token}
    idp_id = None
    base_url = app.config.get('OAUTH_PROVIDER_MAP')["basecamp"]["BASE_URL"]

    # Get User Identity
    r = requests.get('https://launchpad.37signals.com/authorization.json',
                        headers=authorized_headers)
    user_data = r.json()
    user_identity = user_data["identity"]["id"]
    account_urls = [x["href"] for x in user_data["accounts"] \
                        if x["href"] == base_url]

    # Get User Profile details
    request_headers = {"Content-Type": "application/xml",
                       "User-Agent": "Celery-dev (http://celery.local)",
                       "Authorization": "Bearer %s" % access_token}
    r = requests.get("%s/me.json" % base_url, headers=request_headers)
    data = r.json()
    user_profile = {"email_address": data["emailAddress"],
                    "first_name": data["name"],
                    "last_name": "",
                    "avatar_url": data["avatarUrl"]}

    return user_identity, user_profile

def googleapps_auth(access_token, refresh_token, expires_in):
    authorized_headers = {'Authorization': 'Bearer %s' %access_token}
    # The hd param in oauth ensures that only users from our domain are
    # allowed.
    r = requests.get('https://www.googleapis.com/plus/v1/people/me',
                        headers=authorized_headers)
    data = r.json()
    user_profile = {"email_address": data["emails"][0]["value"],
                    "first_name": data["name"]["givenName"],
                    "last_name": data["name"]["familyName"],
                    "avatar_url": data["image"]["url"]}

    return data["id"], user_profile
