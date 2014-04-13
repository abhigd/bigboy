import json
import uuid
import datetime
import time
import mimetypes
import os
from email.header import Header

from rauth import OAuth2Service
import requests
import boto

# from boto.sdb.connection import SDBConnection
from boto.s3.key import Key
from boto.cloudfront import CloudFrontConnection
from boto.cloudfront.distribution import Distribution

from boto.sqs.message import Message as SQSMessage

import redis


from werkzeug.datastructures import MultiDict

from app import app
from app.forms import *
from app import login_manager
from app.user import User
from app.lib import auth

from flask import request, redirect
from flask import session, render_template
from flask import make_response, abort
from flask import jsonify, current_app

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

login_manager.login_view = "login"

@login_manager.user_loader
def load_user(userid):
    return User.get(current_app.redis_client, userid)

@app.route('/auth/<provider>')
def oauth_entry(provider):
    if request.args.get("error", None) is not None:
        return redirect("/index")

    if provider not in app.config.get('OAUTH_PROVIDER_MAP').keys():
        return redirect("/index?sorry")

    auth_code = request.args.get("code")
    state = request.args.get("state")

    headers = {'content-type': 'application/json',
                'User-Agent': 'Celery-dev (http://celery.local)'}
    rimage_member = False

    provider_config = app.config.get('OAUTH_PROVIDER_MAP')[provider]
    service = OAuth2Service(
               name='example',
               client_id=provider_config.get('CLIENT_ID'),
               client_secret=provider_config.get('CLIENT_SECRET'),
               access_token_url=provider_config.get('ACCESS_TOKEN_URL'),
               authorize_url=provider_config.get('AUTHORIZE_URL'),
               base_url=provider_config.get('BASE_URL'))

    data = {'code': auth_code,
            'type': 'web_server',
            'redirect_uri': provider_config.get('REDIRECT_URI'),
            'grant_type': 'authorization_code'}

    try:
        response = service.get_raw_access_token(data=data)
        data = response.json()
    except Exception, e:
        return redirect("/index?sorry")
    else:
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        expires_in = data.get("expires_in")

        if provider == "basecamp":
            user_identity, user_profile = auth.basecamp_auth(access_token,
                                                        refresh_token, expires_in)
        elif provider == "googleapps":
            user_identity, user_profile = auth.googleapps_auth(access_token,
                                                          refresh_token, expires_in)

        idp_id = user_identity
        # Does a mapping exist between provider identity and userid
        uid = current_app.redis_client.get("idp_user:%s:%s" % (provider, idp_id))
        if uid:
            user = User(current_app.redis_client, uid)
            login_user(user)
            _next = state

            return redirect(_next)
        else:
            invite_code = uuid.uuid4().hex
            invite_data = {
                            "idp_id": idp_id,
                            "email_address": user_profile["email_address"],
                            "first_name": user_profile["first_name"],
                            "last_name": user_profile["last_name"],
                            "idp": provider
                           }
            invite_data.update(user_profile)
            current_app.redis_client.setex("invites:%s" %invite_code,
                               json.dumps(invite_data), 24*60*60)

            return redirect("/user/new?invite_code=%s" % invite_code)

@app.route('/login')
def login():
    if current_user.is_authenticated():
        return redirect("/")

    next = request.args.get("next", "/")
    bc_idp_url = _get_idp_url("basecamp", next)
    ga_idp_url = _get_idp_url("googleapps", next)
    return render_template('login.html', idp_urls=[bc_idp_url, ga_idp_url])

@login_manager.unauthorized_handler
def unauthorized():
    # do stuff
    if request.is_xhr or \
            request.headers["content-type"].startswith("application/json"):
        abort(401)
    else:
        login_redirect_url = login_url(
                                login_manager.login_view, request.url)
        return redirect(login_redirect_url)

def _get_idp_url(provider="basecamp", next="/"):

    bc_config = app.config.get('OAUTH_PROVIDER_MAP')[provider]
    service = OAuth2Service(
               name='example',
               client_id=bc_config.get('CLIENT_ID'),
               client_secret=bc_config.get('CLIENT_SECRET'),
               access_token_url=bc_config.get('ACCESS_TOKEN_URL'),
               authorize_url=bc_config.get('AUTHORIZE_URL'),
               base_url=bc_config.get('BASE_URL'))

    params = {'redirect_uri': bc_config.get('REDIRECT_URI'),
              'type': 'web_server', 'state': next,
              'response_type': 'code',
              'scope': ' '.join(bc_config.get('SCOPES', [])),
              'hd': 'idc-rimage.com',
              'approval_prompt': 'force'}
    url = service.get_authorize_url(**params)

    return url

