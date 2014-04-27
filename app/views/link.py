import time, uuid, json, calendar

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

from boto.sqs.message import Message as SQSMessage

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

@app.route('/link/', methods=['GET'])
@login_required
def render_links():
    link_list, links = [], []
    owner = current_user.user_id
    start = 0
    end = 10
    page_num = start/10+1
    target = request.args.get("target", None)

    if target:
        link_ids = current_app.redis_client.zrange("target_links:%s" %target, 0, -1)
        link_count = current_app.redis_client.zcard("target_links:%s" %target)
    else:
        link_ids = current_app.redis_client.smembers("user_links:%s" %owner)
        link_count = current_app.redis_client.scard("user_links:%s" %owner)

    if link_ids:
        link_list = current_app.redis_client.mget(["links:%s" %link_id \
                                        for link_id in link_ids])
        link_data = [json.loads(x) for x in link_list if x]

        for link in link_data:
            link["linkUrl"] = "%s/link/%s" %(app.config.get('HOSTNAME'),
                                                link["id"])
            if link["expires_in"] < time.time():
                link["expired"] = True
            else:
                link["expired"] = False
            links.append(link)

    if request.is_xhr:
        return jsonify({'data': links,
                        'total': link_count,
                        'perPage': 10,
                        'page': page_num
                        })
    else:
        return render_template('link.html', links=[])

@app.route('/link/<link_id>', methods=['GET'])
def render_link(link_id):
    link_data = current_app.redis_client.get("links:%s" %link_id)
    link_targets = current_app.redis_client.zrange("link_targets:%s" %link_id, 0, -1)
    target_render_data = []

    if link_data is None:
        abort(404)

    # TODO: Check if target's ACL still allows the owner of this
    # link to access
    link_info = json.loads(link_data)
    expires_in = link_info["expires_in"]
    if link_info["expires_in"] < time.time():
        link_info["expired"] = True
    else:
        link_info["expired"] = False

    if link_info["expired"]:
        if not current_user.is_authenticated():
            abort(404, "Link has expired")

    # Check for temp uploads and move them to link_targets if complete.
    # files will not be moved to the main bucket until the user
    # approves it. File will be served until then from the S3 bucket
    owner_info = json.loads(current_app.redis_client.get("user:%s" %link_info["owner"]))
    del owner_info["idp"]
    del owner_info["idp_id"]
    link_info["owner"] = owner_info

    if link_targets:
        target_ids = link_targets
        target_data = current_app.redis_client.mget(["files:%s" %x for x in target_ids])
        target_info = [json.loads(x) for x in target_data if x]
    else:
        target_info = []

    for idx, target in enumerate(target_info):
        target_url = "%s/link/%s/target/%s/%s" \
                        %(app.config.get('HOSTNAME'), link_id,
                          target["id"], target["title"])
        target["url"] = target_url
        target_download_count = current_app.redis_client.llen(
                                    "target_download_counter:%s:%s" \
                                        %(link_id, target["id"]))
        target["count"] = int(target_download_count)
        del target["acl"]
        del target["source"]
        # del target["owner"]
        target["approved"] = True

        target_render_data.append(target)

    if current_user.is_authenticated():
        temp_target_info = []
        temp_uploads = current_app.redis_client.smembers("link_uploads:%s" %(link_id))
        if temp_uploads:
            temp_target_data = current_app.redis_client.mget(["temp_files:%s" %x \
                                    for x in temp_uploads])
            temp_target_info = [json.loads(x) for x in temp_target_data if x]

        for idx, target in enumerate(temp_target_info):
            # Check if this file really exists in S3 else delete from index
            target_url = "%s/link/%s/upload/%s/%s" \
                            %(app.config.get('HOSTNAME'), link_id,
                              target["id"], target["title"])

            target["url"] = target_url
            target["approved"] = False
            target["count"] = 0
            target_render_data.append(target)
            del target["bucket"]

    if request.headers["Accept"].startswith("text/html"):

        return render_template('link.html',
                                link_data=link_info,
                                targets=target_render_data)
    elif request.headers["Accept"].startswith("application/json"):
        link_data = dict(**link_info)
        link_data.update(targets=target_render_data)

        return jsonify(link_data)
    else:
        render_data = ["%s %s" %(target["title"][:18].ljust(20), target["url"]) \
                        for target in target_render_data]

        resp = make_response("\n".join(render_data)+"\n")
        resp.headers['content-type'] = "text/plain"

        return resp

@app.route('/link/', methods=['POST'])
@login_required
def create_link():
    created = int(time.time())
    owner = current_user.user_id
    acl = {}
    form = LinkForm(MultiDict(request.json))

    if not form.validate():
        abort(400, form.errors)

    link_id = uuid.uuid4().hex
    link_targets = form.target.data.split(",")
    link_expires_in = time.gmtime((form.expires_in.data))

    link_data = {"id": link_id,
                 "owner": owner,
                 "expires_in": form.expires_in.data,
                 "created": created,
                 "acl": acl,
                 "max_uploads": 10,
                 "max_upload_size": 104857600,
                 "max_target_downloads": 0,
                 "allow_downloads": True,
                 "allow_uploads": False}

    current_app.redis_client.set("links:%s" %link_id, json.dumps(link_data))
    current_app.redis_client.sadd("user_links:%s" %owner, link_id)

    if link_targets:
        target_ids = link_targets
        target_data = current_app.redis_client.mget(["files:%s" %x for x in target_ids])
        targets = [json.loads(x) for x in target_data if x]

        for target in targets:
            link.create_link_target(link_data, target)

    link_data["linkUrl"] = "%s/link/%s" % (app.config.get('HOSTNAME'), link_id)
    link_data["expired"] = False

    return jsonify(link_data)

@app.route('/link/<link_id>', methods=['PUT'])
@login_required
def edit_link(link_id):
    link_data = current_app.redis_client.get("links:%s" %link_id)
    if not link_data:
        abort(404)

    form = LinkForm(MultiDict(request.json))
    if not form.validate():
        abort(400, form.errors)

    link_info = json.loads(link_data)
    expires_in = form.expires_in.data

    link_data = {"id": link_id,
                 "owner": link_info["owner"],
                 "expires_in": expires_in,
                 "created": link_info["created"],
                 "acl": link_info["acl"],
                 "max_uploads": form.max_uploads.data or 10,
                 "max_upload_size": form.max_upload_size.data or 1024*1024*100,
                 "max_target_downloads": form.max_target_downloads.data or 0,
                 "allow_downloads": form.allow_downloads.data,
                 "allow_uploads": form.allow_uploads.data}

    current_app.redis_client.set("links:%s" %link_id, json.dumps(link_data))

    return jsonify(link_data)

@app.route('/link/<link_id>', methods=["DELETE"])
@login_required
def delete_link(link_id):
    link_data = current_app.redis_client.get("links:%s" %link_id)
    if not link_data:
        abort(404)

    target = request.args.get("target", None)
    if target:
        target_id = target.split("/", 2)[-1]
        target_data = current_app.redis_client.get("files:%s" % target_id)
        if not target_data:
            abort(400, "Specified File does not exist")

    link_info = json.loads(link_data)
    owner = link_info["owner"]

    # TODO: This is ambigious. This method does two things:
    # 1. Remove a link or
    # 2. Remove a specific target from a link
    if target is None:
        current_app.redis_client.delete("links:%s" %link_id)
        current_app.redis_client.srem("user_links:%s" %owner, link_id)
        current_app.redis_client.delete("link_uploads:%s" %link_id)
    else:
        link.delete_link_target(link_info, json.loads(target_data))

    response = Response(status=204)
    return response

# @app.route('/link/<link_id>/target/', methods=["GET"])
# def get_link_targets(link_id):
#     pass
#     # Get last 100 ids from source uploads

@app.route('/link/<link_id>/search', methods=["GET"])
@login_required
def search_link_targets(link_id):
    link_data = current_app.redis_client.get("links:%s" %link_id)

    if link_data is None:
        abort(404)

    last_100_files = current_app.redis_client.zrevrange("local_files", 0, 100)
    link_targets = current_app.redis_client.zrevrange("link_targets:%s" %link_id, 0, -1)
    interesting_files = set(last_100_files) - set(link_targets)
    data = files.get_file_data(interesting_files)

    return jsonify({'data': data})

@app.route('/link/<link_id>/target/<target_id>/<file_name>', methods=["GET"])
def get_link_target(link_id, target_id, file_name):
    link_data = current_app.redis_client.get("links:%s" %link_id)
    target_data = current_app.redis_client.get("files:%s" % target_id)

    if link_data is None or target_data is None:
        abort(404)

    link_info = json.loads(link_data)
    if link_info["expires_in"] < time.time():
        abort(404, "Link has expired")

    if link_info["max_target_downloads"] > 0:
        target_d_count = current_app.redis_client.llen("target_download_counter:%s:%s" \
                                             %(link_id, target_id))
        if target_d_count >= link_info["max_target_downloads"]:
            abort(404, "Limit reached")

    target_exists = current_app.redis_client.zrank("link_targets:%s" %link_id, target_id)
    if target_exists is None:
        abort(404, "No such file exists")

    target_info = json.loads(target_data)
    signed_url = distribution.get_signed_url(target_info)
    current_app.redis_client.lpush("target_download_counter:%s:%s" \
                           %(link_id, target_id),
                       time.time())
    print signed_url
    return redirect(signed_url, code=307)

@app.route('/link/<link_id>/target/<target_id>', methods=["PUT"])
@login_required
def edit_link_target(link_id, target_id):
    form = EditLinkTargetForm(MultiDict(request.json))
    link_data = current_app.redis_client.get("links:%s" %link_id)

    if not link_data:
        abort(404)

    if not form.validate():
        abort(400, form.errors)

    approved = form.approved.data
    description = form.description.data
    if approved:
        temp_file_data = current_app.redis_client.get("temp_files:%s" % target_id)
        if not temp_file_data:
            abort(404)

        link_info = json.loads(link_data)
        temp_file_info = json.loads(temp_file_data)
        target = link.approve_link_target(link_info, temp_file_info)

        return jsonify(target)

    response = Response(status=204)
    return response

@app.route('/link/<link_id>/target/', methods=["POST"])
def create_link_target(link_id):
    form = LinkTargetForm(MultiDict(request.json))
    link_data = current_app.redis_client.get("links:%s" %link_id)

    if not link_data:
        abort(404)

    if not form.validate():
        abort(400, form.errors)

    link_info = json.loads(link_data)

    if not current_user.is_authenticated():
        if link_info["expires_in"] < time.time():
            abort(404, "Link has expired")

        if not link_info["allow_uploads"]:
            abort(403, "Link does not allow anonymous uploads")

    target_id = form.target_id.data
    if current_user.is_authenticated():
        target_data = current_app.redis_client.get("files:%s" %target_id)
    else:
        target_data = current_app.redis_client.get("temp_files:%s" %target_id)
    if not target_data:
        abort(400, form.errors)

    target_info = json.loads(target_data)
    if current_user.is_authenticated():
        target = link.create_link_target(link_info, target_info)
    else:
        target_info["url"] = "#"
        target_info["count"] = 0
        target_info["approved"] = False
        target_info["created"] = time.time()

    return jsonify(target_info)

@app.route('/link/<link_id>/target/<target_id>', methods=["DELETE"])
@login_required
def delete_link_target(link_id, target_id):
    link_data = current_app.redis_client.get("links:%s" %link_id)
    link_target = target_id

    if link_data is None:
        abort(404)

    target_data = current_app.redis_client.get("files:%s" %target_id)
    if not target_data:
        abort(400)

    link.delete_link_target(json.loads(link_data), json.loads(target_data))

    response = Response(status=204)
    return response

@app.route('/link/<link_id>/upload/<file_id>/<file_name>', methods=["GET"])
@login_required
def get_temp_link_upload(link_id, file_id, file_name):
    link_data = current_app.redis_client.get("links:%s" %link_id)
    temp_file = current_app.redis_client.get("temp_files:%s" %file_id)
    temp_file_exists = current_app.redis_client.sismember("link_uploads:%s" %(link_id),
                                              file_id)

    if link_data is None or temp_file is None or temp_file_exists is False:
        abort(404)

    file_info = json.loads(temp_file)
    bucket = file_info["bucket"]
    file_type = file_info["type"]
    file_name = file_info["title"]
    file_content_disposition_header = build_header(file_name).encode('ascii')
    response_headers = {"response-content-disposition":
                            file_content_disposition_header,
                        "response-content-type": file_type}

    url = default_s3_conn.generate_url(600, "GET", bucket=bucket, key=file_id,
            response_headers=response_headers)

    return redirect(url, 307)

@app.route('/link/<link_id>/upload/', methods=["POST"])
def link_target_upload_manage(link_id):
    # TODO: Check if link allows uploads. Set limits
    phase = request.args.get("phase", "init")
    link_data = current_app.redis_client.get("links:%s" %link_id)

    if link_data is None:
        abort(404)

    link_info = json.loads(link_data)
    if not current_user.is_authenticated():
        if link_info["expires_in"] < time.time():
            abort(404, "Link has expired")
        if not link_info["allow_uploads"]:
            abort(403)

    if phase in ["form", "init"]:
        # TODO: Add to a queue to track failed uploads later
        # TODO: If s3_key exists, then check if the owner is the same
        form = NewFileForm(MultiDict(request.json))
        if not form.validate():
            abort(400, form.errors)

        is_anonymous = not current_user.is_authenticated()
        response_data = upload.upload_init(phase, form, is_anonymous)

    elif phase == "complete":
        s3_key = request.json.get("s3_key", None)
        multipart_id = request.json.get("mp_id", None)

        if multipart_id is None or s3_key is None:
            abort(400)

        response_data = upload.upload_complete(phase, s3_key, multipart_id)

    if phase in ["form", "complete"]:
        if not current_user.is_authenticated():
            s3_key = response_data["key"]
            current_app.redis_client.expire("temp_files:%s" %(s3_key), 600)
            current_app.redis_client.sadd("link_uploads:%s" %(link_id), s3_key)

    return jsonify(response_data)

@app.route('/link/<link_id>/upload/<file_name>', methods=["PUT"])
def link_target_upload(link_id, file_name):
    #Check if link allows anonmous uploads
    # Set size limits for file.
    # Set storage type to reduced redundancy
    link_data = current_app.redis_client.get("links:%s" %link_id)
    if link_data is None:
        abort(404)

    link_info = json.loads(link_data)
    if link_info["expires_in"] < time.time():
        abort(404, "Link has expired")
    if not link_info["allow_uploads"]:
        abort(403)

    content_length = request.headers["content-length"]
    content_type = mimetypes.guess_type(file_name)[0] or \
                                    "application/octet-stream"
    if int(content_length) > link_info["max_upload_size"]:
        abort(400)

    url = upload.upload_curl(file_name, content_length, content_type)
    # curl -Lv --upload-file ~/Downloads/xxx.pdf http://celery.meer.io:5000/link/xxx/upload/
    print url
    return redirect(url, 307)
