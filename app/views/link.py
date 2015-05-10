import time, uuid, json, calendar

from app import app
from app.forms import *

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
        aws_secret_access_key=app.config.get("AWS_SECRET"))

    token = sts_connection.get_session_token().to_dict()
    bucket_details = {"name": "meer-sg-1", "region": "ap-southeast-1"}

    return render_template('link.html',
        token=json.dumps(token), bucket=json.dumps(bucket_details))

@app.route('/link/<link_id>', methods=['GET'])
def render_link(link_id):
    region = connect_to_region(region_setting)
    sts_connection = STSConnection(
                        aws_access_key_id=app.config.get("AWS_ACCESS"),
                        aws_secret_access_key=app.config.get("AWS_SECRET"),
                        region=region)

    token = sts_connection.get_session_token().to_dict()

    return render_template('link.html', links=[])

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

@app.route('/api/link/', methods=['GET'])
# @login_required
def get_links():

    links = current_app.redis_client.zrange('links', 0, -1)
    links_data = []
    for link in links:
        link_data = current_app.redis_client.hgetall(link)
        if link_data:
            links_data.append(link_data)

    return jsonify({"data": links_data})

@app.route('/api/link/<link_id>', methods=['GET'])
# @login_required
def get_link():

    return jsonify({})

@app.route('/api/link/', methods=['POST'])
# @login_required
def create_link():

    link_id = uuid.uuid4()
    created_at = time.time()
    link_data = {'created_at': created_at, 'id': link_id}
    current_app.redis_client.zadd('links', link_id, 1)
    current_app.redis_client.hmset(link_id, link_data)

    return jsonify({"id": link_id, "created_at": created_at})

@app.route('/api/link/<link_id>', methods=['PUT'])
# @login_required
def edit_link(link_id):

    return jsonify({})

@app.route('/api/link/<link_id>', methods=["DELETE"])
# @login_required
def delete_link(link_id):

    response = Response(status=204)
    return response
@app.route('/api/link/<link_id>/files/', methods=['GET'])
# @login_required
def get_link_files(link_id):
    refresh = request.args.get('refresh')
    start = int(request.args.get('start', '0'))
    end = int(request.args.get('end', '100'))

    if refresh == "1":
        bucket = current_app.default_s3_conn.get_bucket("meer-sg-1")
        keys = bucket.list(link_id+"/", "/")
        # for group in grouper(keys, 10):
        #     group_keys = [x.name for x in group if x]
        #     current_app.redis_client.rpush("%s_files" % link_id,
        #                                    *group_keys)
        for k in keys:
            file_name = k.name.split("/")[-1]
            file_path = "%s/%s" %(app.config.get("HOSTNAME"), k.name)
            key_data = {"name": file_name,
                        "size": k.size,
                        "link": file_path,
                        "type": k.content_type,
                        "metadata": repr(k.metadata),
                        "created_at": k.last_modified}
            current_app.redis_client.hmset("%s/%s" % (link_id, k.name),
                                           key_data)
            current_app.redis_client.zadd("%s_files" % (link_id), k.name, 1)
            current_app.redis_client.zadd("%s_files_tmp" % (link_id), k.name, 1)

        current_app.redis_client.zinterstore("%s_files" % (link_id), ["%s_files" % (link_id), "%s_files_tmp" % (link_id)])
    
    file_ids = current_app.redis_client.zrange("%s_files" % link_id,
                                               start, end)
    files_data = []
    for file_id in file_ids:
        key_data = current_app.redis_client.hgetall("%s/%s" % (link_id, file_id))
        files_data.append(key_data)

    return jsonify({"data": files_data})


