import json
import uuid
import datetime
import time
import mimetypes

import redis
import boto

from rfc6266 import build_header

from app import app
from app.forms import *
from app.lib import upload, auth, files
from app.lib import distribution, geo

from flask import request, redirect, url_for
from flask import session, render_template
from flask import make_response, abort
from flask import jsonify, Response, current_app

from boto.s3.key import Key
from boto.sqs.message import Message as SQSMessage

from werkzeug.datastructures import MultiDict

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

from flask import make_response
from functools import update_wrapper

def nocache(f):
    def new_func(*args, **kwargs):
        resp = make_response(f(*args, **kwargs))
        resp.cache_control.no_cache = True
        return resp
    return update_wrapper(new_func, f)

@app.route('/files/upload/', methods=["GET"])
# @login_required
def manage_upload():
    phase = request.args.get("phase", "init")

    if phase in ["form", "init"]:
        # TODO: Add to a queue to track failed uploads later
        # TODO: If s3_key exists, then check if the owner is the same
        form = NewFileForm(MultiDict(request.json))
        if not form.validate():
            abort(400, form.errors)

        response_data = upload.upload_init(phase, form)

        return jsonify(response_data)

    elif phase == "complete":
        s3_key = request.json.get("s3_key", None)
        multipart_id = request.json.get("mp_id", None)

        if multipart_id is None or s3_key is None:
            abort(400)

        upload.upload_complete(phase, s3_key, multipart_id)

        return jsonify({"id":multipart_id})

@app.route('/files/upload/', methods=["GET"])
@app.route('/link/<link_id>/target/upload/', methods=["GET"])
def upload_part():
    phase = request.args.get("phase", "part")
    source = "local"

    # TODO: Moving to browser will require STS
    form = FilePartUploadForm(request.args)
    if not form.validate():
        abort(400, form.errors)

    response_data = upload.upload_part(phase, form)

    return jsonify(response_data)

@app.route('/')
@app.route('/files/', methods=['GET'])
@login_required
def list_files():
    owner = current_user.user_id
    form = Files(request.args)

    if not form.validate():
        abort(400)

    start = form.start.data
    end = form.end.data
    data = []
    file_ids = current_app.redis_client.zrange("user_files:%s" %owner, start, end-1)
    files_count = current_app.redis_client.zcard("user_files:%s" %owner)
    page_num = start/10+1
    if file_ids and files_count:
        data = files.get_file_data(file_ids)

    if request.is_xhr:
        return jsonify({'data': data,
                        'total': files_count,
                        'perPage': 10,
                        'page': page_num
                        })
    else:
        return render_template('files.html', files=[])

@app.route('/files/', methods=['POST'])
@login_required
def create_file():
    created = int(time.time())
    owner = current_user.user_id
    acl = {}
    source = "local"
    form = FileForm(MultiDict(request.json))
    sqs_message = SQSMessage()

    if not form.validate():
        print form.errors
        abort(400)

    file_data = current_app.redis_client.get("temp_files:%s" % form.key.data)
    if not file_data:
        abort(400)

    file_data = files.create(json.loads(file_data))
    return jsonify(file_data)

@app.route('/files/<file_id>', methods=['PUT'])
@login_required
def modify_file():
    abort(404)

# @app.route('/files/empty', methods=['GET'])
# @login_required
# def empty():
#     versions_iter = default_s3_bucket.list_versions()
#     delete_list = [(v.name, v.version_id) for v in versions_iter]
#     result = default_s3_bucket.delete_keys(delete_list)
#     print result.errors

#     return "Bucket cleared"

@app.route('/files/<file_id>', methods=['DELETE'])
@login_required
def delete_file(file_id):
    file_data = current_app.redis_client.get("files:%s" %file_id)
    if not file_data:
        abort(404)

    file_info = json.loads(file_data)
    files.delete(file_info)

    response = Response(status=204)
    return response

@app.route('/files/<file_id>')
@nocache
@login_required
def show_file(file_id):
    file_data = current_app.redis_client.get("files:%s" % file_id)

    if file_data is None:
        abort(404)

    file_info = json.loads(file_data)
    views = [json.loads(x) for x in \
                        current_app.redis_client.smembers("file_views:%s" % file_id)]
    file_info.update({"views": views})

    if request.is_xhr:
        return jsonify(file_info)
    else:
        return render_template('files.html', file=file_info)

@app.route('/files/<file_id>/download')
@login_required
def download_file(file_id):
    file_data = current_app.redis_client.get("files:%s" %file_id)

    if file_data is None:
        abort(404)

    signed_url = distribution.get_signed_url(json.loads(file_data))
    print signed_url
    return redirect(signed_url, code=307)

@app.route('/files/<file_id>/versions/', methods=['GET'])
@login_required
def get_file_versions(file_id):
    file_data = current_app.redis_client.get("files:%s" %file_id)
    version_marker = request.args.get("next", "")

    if file_data is None:
        abort(404)

    abort(404)
    # versions = []

    # if version_marker != "":
    #     rs = default_s3_bucket.get_all_versions(
    #             prefix=file_id, key_marker=file_id,
    #             version_id_marker=version_marker, max_keys=10)
    # else:
    #     rs = default_s3_bucket.get_all_versions(
    #             prefix=file_id, max_keys=10)

    # next = rs.next_version_id_marker or ""

    # for key in rs:
    #     versions.append({"id": key.version_id,
    #                      "ts": key.last_modified})

    # if request.is_xhr:
    #     return jsonify({"data": versions, "next": next})
    # else:
    #     return redirect(url_for("get_file", file_id))

@app.route('/files/<file_id>/versions/<version_id>', methods=['GET'])
@login_required
def get_file_version(file_id, version_id):
    file_data = current_app.redis_client.get("files:%s" %file_id)

    if file_data is None:
        abort(404)

    abort(404)

    # print signed_url
    # return redirect(signed_url, code=307)

@app.route('/files/<file_id>/versions/<version_id>', methods=["POST"])
@login_required
def manage_file_versions(file_id, version_id):
    # TODO: We only support deleting a version
    abort(404)

# @app.route('/files/<file_id>/preview/<preview_id>', methods=["GET"])
# def render_file_preview(file_id, preview_id):
#     file_path = "preview/%s/%s" % (file_id, preview_id)

#     # Generate a signed url
#     signed_url = sg_cf_dist.create_signed_url(url, keypair_id,
#                                               expire_time=expire_time,
#                                               private_key_file=private_key_file)

#     return redirect(signed_url, code=307)

# @app.route('/files/<file_id>/views/', methods=["POST"])
# def manage_file_view(file_id):
#     file_views = redis_client.get("file_views:%s" %file_id)
#     pass
