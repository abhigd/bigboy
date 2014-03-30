import time, uuid, json, calendar

from app import app
from app import default_s3_conn
from app import redis_client
from app import sqs_conn, sqs_queue
from app.forms  import *
from app.lib import geo, files

from flask import request, redirect
from flask import session, render_template
from flask import make_response, abort
from flask import jsonify, Response

from rfc6266 import build_header
import mimetypes

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

def edit_link():
    pass

def approve_link_target(link, target):
    target_id = target["id"]
    content_disposition = build_header(target['title']).encode('ascii')
    headers = {'content-type': target['type'],
               'content-disposition': content_disposition}

    anon_bucket_cn = redis_client.get("config:%s:cn" %target["bucket"])
    cn_bucket = redis_client.get("config:%s:bucket" % anon_bucket_cn)

    s3_bucket = default_s3_conn.get_bucket(cn_bucket)
    s3_bucket.copy_key(target_id, target["bucket"], target_id, metadata=headers)

    s3_bucket = default_s3_conn.get_bucket(target["bucket"])
    s3_bucket.delete_key(target_id)

    target["bucket"] = cn_bucket
    files.create(target)
    target = create_link_target(link, target)

    return target

def create_link_target(link, target):
    target_id = target["id"]
    link_id = link["id"]
    target_link = target_id
    created = int(time.time())

    redis_client.zadd("link_targets:%s" %link_id, target_link, created)
    redis_client.zadd("target_links:%s" %target_link, link_id, created)

    target_url = "%s/link/%s/target/%s/%s" \
                    %(app.config.get('HOSTNAME'), link_id,
                      target_id, target["title"])
    target["url"] = target_url
    target["count"] = 0
    if current_user.is_authenticated():
        target["approved"] = True
    else:
        target["approved"] = False

    # doc_script = """if (ctx._source.containsKey("links")) {
    #                     ctx._source.links += link
    #              } else {
    #                     ctx._source.links = [link]
    #              }
    #              """
    # doc = {
    #     "script" : doc_script,
    #     "params": {
    #         "link": link_id
    #     }
    # }
    # es.update("files", "file", target_id, doc)

    return target

def delete_link_target(link, target):
    link_id = link["id"]
    target_id = target["id"]
    link_target = target_id

    redis_client.zrem("link_targets:%s" %link_id, link_target)
    redis_client.zrem("target_links:%s" %link_target, link_id)
    redis_client.srem("link_uploads:%s" %(link_id), target_id)

    # doc_script = """if (ctx._source.containsKey("links")) {
    #                     ctx._source.links.remove(link)
    #              } else {
    #                     ctx._source.links = []
    #              }
    #              """
    # doc = {
    #     "script" : doc_script,
    #     "params": {
    #         "link": link_id
    #     }
    # }
    # es.update("files", "file", target_id, doc)
