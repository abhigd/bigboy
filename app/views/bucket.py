import json

import boto
from boto.exception import *

from boto.sts import STSConnection, connect_to_region
from boto.s3.connection import S3Connection

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

@app.route('/')
# @app.route('/file/', methods=['GET'])
@login_required
def render_bucket():
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
    s3_connection = S3Connection(
                        aws_access_key_id=app.config.get("AWS_ACCESS"),
                        aws_secret_access_key=app.config.get("AWS_SECRET"))

    s3_buckets = s3_connection.get_all_buckets()
    bucket_info = [{"name":x.name} for x in s3_buckets]

    return json.dumps(bucket_info)
