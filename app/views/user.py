import json
import uuid
import datetime
import time
import mimetypes

import redis

from app import app
from app.forms import *
from app import default_s3_conn
from app import redis_client
from app import sqs_conn, sqs_queue
from app.user import User

from flask import request, redirect, url_for
from flask import session, render_template
from flask import make_response, abort
from flask import jsonify, Response

from boto.s3.key import Key
from boto.sqs.message import Message as SQSMessage

from werkzeug.datastructures import MultiDict

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

@app.route('/user/new')
def new_user_form():
    if current_user.is_authenticated():
        return redirect("/")

    invite_code = request.args.get("invite_code", None)
    if invite_code:
        invite_data = redis_client.get("invites:%s" %invite_code)
        if invite_data:
            return render_template("welcome.html", invite_code=invite_code)

    return redirect("/login")

@app.route('/user/', methods=["POST"])
def new_user():
    # TODO Decrypt, the hidden field
    invite_code = request.form.get("invite_code")

    invite_data = redis_client.get("invites:%s" %invite_code)
    if invite_data:
        uid = uuid.uuid4().hex
        invite_info = json.loads(invite_data)
        idp = invite_info["idp"]
        idp_id = invite_info["idp_id"]
        invite_info["id"] = uid

        redis_client.set("user:%s" %uid, json.dumps(invite_info))
        redis_client.set("idp_user:%s:%s" % (idp, idp_id), uid)
        redis_client.sadd("user_idp:%s" %(uid), "%s:%s" %(idp, idp_id))
        redis_client.delete("invites:%s" %invite_code)

        user = User(uid)
        login_user(user)

        return redirect("/")
    else:
        return redirect("/index?sorry")

# @app.route('/user/', methods=['GET'])
# @login_required
# def list_users():
#     users = {"page": 0, "perPage": 10, "total": 1,
#                 "data": [
#                     {"id": 1,
#                      "firstName": "First",
#                      "lastName": "Name",
#                      "email": "admin@example.com",
#                      "nick": "admin",
#                      "avatar": "http://placehold.it/16x16"},
#                     {"id": 2,
#                      "firstName": "Second",
#                      "lastName": "Name",
#                      "email": "admin2@example.com",
#                      "nick": "admin2",
#                      "avatar": ""}
#                  ]}

#     return jsonify(users)

@app.route('/user/me', methods=['GET'])
@login_required
def user_profile():
    user_id = current_user.user_id
    user_data = redis_client.get("user:%s" %user_id)
    user_idp_data = redis_client.smembers("user_idp:%s" %(user_id))
    user_idps = [x.split(":", 1)[0] for x in user_idp_data]
    user_non_idps = set(app.config.get('OAUTH_PROVIDER_MAP').keys()) - \
                    set(user_idps)
    user_pattern = ""

    return render_template('profile.html', user=json.loads(user_data),
                            idp=user_idps, non_idp =user_non_idps,
                            pattern=user_pattern)

@app.route('/user/<user_id>', methods=['GET'])
@login_required
def fetch_user(user_id):
    user_data = redis_client.get("user:%s" %user_id)

    return user_data

