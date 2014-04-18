import json
import uuid
import datetime
import time
import mimetypes

import redis
import boto

from rfc6266 import build_header

from app.forms import *
from app.lib import geo
from flask import current_app

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

from boto.s3.key import Key
from boto.sqs.message import Message as SQSMessage


def create(file_info):
    created = int(time.time())
    owner = current_user.user_id
    acl = {}
    source = "local"
    sqs_message = SQSMessage()

    file_type = file_info["type"]
    file_size = file_info["size"]
    file_id = file_info["id"]
    file_title = file_info["title"]

    file_data = {
                   "id": file_id,
                   "owner": owner,
                   "source": source,
                   "created": created,
                   "acl": acl,
                   "type": file_type,
                   "size": file_size,
                   "title": file_title,
                   "bucket": file_info["bucket"]
                }
    current_app.redis_client.set("files:%s" %file_id, json.dumps(file_data))
    current_app.redis_client.zadd("user_files:%s" %owner, file_id, created)
    current_app.redis_client.zadd("%s:%s" %(source, owner), file_id, created)
    current_app.redis_client.zadd("%s_files" %(source), file_id, created)

    current_app.redis_client.delete("temp_files:%s" % file_id)

    original_link = "%s/download" % file_id
    original_value = json.dumps({"link": original_link,
                                 "label": "Original",
                                 "title": file_title})
    current_app.redis_client.sadd("file_views:%s" % file_id, original_value)

    # sqs_message.set_body(json.dumps({
    #                                  "key": file_id,
    #                                  "bucket": file_info["bucket"],
    #                                  "type": file_type,
    #                                  "size": file_size
    #                                  }))
    # sqs_queue.write(sqs_message)

    # body = {
    #    "owner": owner,
    #    "created": created,
    #    "type": file_type,
    #    "size": file_size,
    #    "title": file_title,
    # }
    # es.create("files", "file", body, id=file_id)
    return file_data

def edit():
  pass

def delete(file_info):
    # Get a list of all the versions of this file and then
    # do a multi delete.
    # S3 limits the number of keys that can be passed to a
    # multi delete to 1000 I think.
    file_id = file_info["id"]
    bucket = file_info["bucket"]
    source = file_info["source"]
    owner = file_info["owner"]

    bucket_connection = current_app.default_s3_conn.lookup(bucket)
    versions = bucket_connection.list_versions(file_id)
    key_list = [(file_id, v.version_id) for v in versions]
    result = bucket_connection.delete_keys(key_list)

    if len(result.errors) == 0:
        current_app.redis_client.delete("files:%s" % file_id)
        current_app.redis_client.zrem("user_files:%s" % owner, file_id)
        current_app.redis_client.zrem("%s:%s" % (source, owner), file_id)
        current_app.redis_client.zrem("%s_files" %(source), file_id)

        current_app.redis_client.delete("file_views:%s" % file_id)

        target = "/files/%s" %file_id
        links = current_app.redis_client.zrange("target_links:%s" %target, 0, -1)
        for link in links:
            current_app.redis_client.zrem("link_targets:%s" %link, target)

        current_app.redis_client.delete("target_links:%s" %target)
        # es.delete("files", "file", file_id)

def get_file_data(file_ids):
  # Given a list of file ids, return information about them
    users = {}
    _files = current_app.redis_client.mget(["files:%s" %file_id \
                                    for file_id in file_ids])
    files = [json.loads(x) for x in _files if x]
    user_ids = set(x["owner"] for x in files)
    _users = [json.loads(x) for x in \
                current_app.redis_client.mget(["user:%s" %x for x in user_ids])]
    for _user in _users:
        del _user["idp"]
        del _user["idp_id"]
        users[_user["id"]] = _user
    # user_info = dict((x, json.loads))

    data = []
    for _file in files:
        file_id = _file["id"]
        _file["owner"] = users[_file["owner"]]
        data.append(_file)

    return data
