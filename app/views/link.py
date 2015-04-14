import time, uuid, json, calendar

from app import app
from app.forms  import *

from boto.sts import STSConnection, connect_to_region

from flask import request, redirect
from flask import session, render_template
from flask import make_response, abort
from flask import jsonify, Response, current_app

from werkzeug.datastructures import MultiDict
from rfc6266 import build_header
import mimetypes

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

@app.route('/link/', methods=['GET'])
# @login_required
def render_links():
    # region = connect_to_region(region_setting)
    sts_connection = STSConnection(
                        aws_access_key_id=app.config.get("AWS_ACCESS"),
                        aws_secret_access_key=app.config.get("AWS_SECRET")
                        )

    token = sts_connection.get_session_token().to_dict()
    bucket_details = {"name": "meer-sg-1", "region": "ap-southeast-1"}

    return render_template('link.html', token=json.dumps(token),
                bucket=json.dumps(bucket_details))

@app.route('/link/<link_id>', methods=['GET'])
def render_link(link_id):
    region = connect_to_region(region_setting)
    sts_connection = STSConnection(
                        aws_access_key_id=app.config.get("AWS_ACCESS"),
                        aws_secret_access_key=app.config.get("AWS_SECRET"),
                        region=region)

    token = sts_connection.get_session_token().to_dict()

    return render_template('link.html', links=[])

@app.route('/link/', methods=['POST'])
@login_required
def create_link():

    return jsonify({})

@app.route('/link/<link_id>', methods=['PUT'])
@login_required
def edit_link(link_id):

    return jsonify({})

@app.route('/link/<link_id>', methods=["DELETE"])
@login_required
def delete_link(link_id):

    response = Response(status=204)
    return response

@app.route('/link/<link_id>/upload/<file_name>', methods=["PUT"])
def link_target_upload(link_id, file_name):
    #Check if link allows anonmous uploads
    # Set size limits for file.
    # Set storage type to reduced redundancy

    # content_length = request.headers["content-length"]
    # content_type = mimetypes.guess_type(file_name)[0] or \
    #                                 "application/octet-stream"
    # if int(content_length) > link_info["max_upload_size"]:
    #     abort(400)

    # url = upload.upload_curl(file_name, content_length, content_type)
    # curl -Lv --upload-file ~/Downloads/xxx.pdf http://celery.meer.io:5000/link/xxx/upload/
    # print url
    # return redirect(url, 307)
    response = Response(status=204)
    return response
