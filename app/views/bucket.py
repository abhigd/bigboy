import json

import boto
from boto.exception import *

from boto.sts import STSConnection, connect_to_region
from boto.s3.connection import S3Connection
from boto.iam.connection import IAMConnection

from boto.s3.bucket import Bucket

from app import app
from app.lib import upload, auth, files
from app.lib import distribution, link
from app.lib import geo
from app.forms  import *

from flask import request, redirect
from flask import session, render_template
from flask import make_response, abort
from flask import jsonify, Response, current_app

from werkzeug.datastructures import MultiDict
from rfc6266 import build_header
import mimetypes

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

s3_connection = S3Connection(
                    aws_access_key_id=app.config.get("AWS_ACCESS"),
                    aws_secret_access_key=app.config.get("AWS_SECRET"))

iam_connection = IAMConnection(
                    aws_access_key_id=app.config.get("AWS_ACCESS"),
                    aws_secret_access_key=app.config.get("AWS_SECRET"))
account_alias = iam_connection.get_account_alias()
account_alias_name = account_alias["list_account_aliases_response"]["list_account_aliases_result"]["account_aliases"][0]

@app.route('/')
@app.route('/bucket/<bucket>/')
@app.route('/bucket/<bucket>/<key>')
@app.route('/bucket/<bucket>/<path:path>')
# @app.route('/file/', methods=['GET'])
@login_required
def render_bucket(bucket="", key="", path=""):
    print "path is %s" %path
    region_setting = ""
    region = connect_to_region(region_setting)
    sts_connection = STSConnection(
                        aws_access_key_id=app.config.get("AWS_ACCESS"),
                        aws_secret_access_key=app.config.get("AWS_SECRET"),
                        region=region)

    token = sts_connection.get_session_token().to_dict()

    # assumedRoleObject = sts_connection.assume_role(
    #                         role_arn=vc5_role_arn,
    #                         role_session_name="AssumeRoleSession1")

    # iam_connection = IAMConnection(
    #                     aws_access_key_id=assumedRoleObject.credentials.access_key,
    #                     aws_secret_access_key=assumedRoleObject.credentials.secret_key,
    #                     security_token=assumedRoleObject.credentials.session_token)

    return render_template('bucket.html', token=json.dumps(token))

@app.route('/api/bucket/')
@login_required
def render_buckets_api():
    bucket_info = {}

    s3_buckets = s3_connection.get_all_buckets()
    for bucket in s3_buckets:
        bucket_details = current_app.redis_client.hgetall(bucket.name)
        if bucket_details:
            bucket_info[bucket.name] = bucket_details
            continue

        try:
            tagset = bucket.get_tags()
            tags = dict([(x.key, x.value) for x in tagset[0]])
        except:
            tags = {}
        versioning_info = bucket.get_versioning_status()
        versioning = {
            "Versioning": versioning_info.get("Versioning", False),
            "MFA": versioning_info.get("MFADelete", False)
        }
        try:
            lifecycle = `bucket.get_lifecycle_config()`
        except:
            lifecycle = ""
        try:
            policy = bucket.get_policy()
        except:
            policy = {}
        try:
            cors_configuration = bucket.get_cors()
            cors_headers = [dict([
                ("method", x.allowed_method), ("origin", x.allowed_origin),
                ("header", x.allowed_header), ("max_age", x.max_age_seconds),
                ("expose_header", x.expose_header)])
            for x in cors_configuration]
        except:
            cors_headers = []
        try:
            permissions_doc = bucket.get_acl()
            permissions = {}
            for g in permissions_doc.acl.grants:
                if g.type == "CanonicalUser":
                    permissions[g.display_name] = g.permission
                elif g.type == "Group":
                    permissions[g.uri] = g.permission
                else:
                    g.email_address = g.permission
        except:
            permissions = {}
        try:
            logging_status = bucket.get_logging_status()
            if logging_status.target:
                logging = {
                    "target": logging_status.target,
                    "prefix": logging_status.prefix
                }
            else:
                logging = False
        except:
            logging = False

        bucket_details = {
            "account": account_alias_name,
            "region": bucket.get_location(),
            "tags": tags,
            "versioning": versioning,
            "lifecycle": lifecycle,
            "policy": policy,
            "cors_headers": cors_headers,
            "permissions": permissions,
            "logging": logging
        }
        bucket_info[bucket.name] = bucket_details
        current_app.redis_client.hmset(bucket.name, bucket_details)


    return jsonify(bucket_info)
