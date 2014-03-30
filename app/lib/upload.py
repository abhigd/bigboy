import json
import uuid
import datetime
import time
import mimetypes

import redis
import boto

from rfc6266 import build_header

from app import app
from app import default_s3_conn
from app import redis_client
from app import sqs_conn, sqs_queue

from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

from boto.s3.key import Key
from boto.sqs.message import Message as SQSMessage

from functools import update_wrapper

def upload_curl(file_title, file_length, file_type):
    file_id = uuid.uuid4().hex

    anon_bucket_name = geo.get_closest_anon_bucket()
    bucket_name = geo.get_closest_bucket()

    url = default_s3_conn.generate_url(600, "PUT", bucket_name, file_id)
    file_info = {
        "title": file_title,
        "bucket": anon_bucket_name,
        "id": file_id,
        "type": file_type,
        "size": file_length,
        "created": time.time()
    }
    redis_client.set("temp_files:%s" % file_id, json.dumps(file_info))

    redis_client.expire("temp_files:%s" %(file_id), 600)
    redis_client.sadd("link_uploads:%s" %(link_id), file_id)

    return url

def upload_init(phase, form, bucket_name):
    source = "local"
    start_time = time.time()
    # TODO Get the connection based on Geo
    s3_connection = default_s3_conn
    print time.time()
    if form.key.data == "":
        s3_key = uuid.uuid4().hex
    else:
        s3_key = form.key.data

    file_size = form.size.data
    file_name = form.name.data
    file_type = mimetypes.guess_type(file_name)[0] or \
                                    "application/octet-stream"
    file_md5_hash = form.hash.data
    file_content_disposition_header = build_header(file_name).encode('ascii')
    file_cache_header = 'max-age=%d, public' % (6 * 1 * 1 * 1 * 1)

    if phase == "form":

        x_conds = ["{'content-disposition':'%s'}" \
                                    % file_content_disposition_header,
                   '{"content-type":"%s"}' % file_type,
                   '{"content-size":"%d"}' % file_size,
                   '{"cache-control":"%s"}' % file_cache_header]

        x_fields = [{"name":"content-disposition", "value":'%s' \
                                    % file_content_disposition_header},
                    {"name":"content-type", "value":"%s" % file_type},
                    {"name":"content-size", "value":"%d" % file_size},
                    {"name":"cache-control", "value":"%s" % file_cache_header}]

        response_data = s3_connection.build_post_form_args(bucket_name,
                              s3_key,
                              http_method="https",
                              fields=x_fields,
                              conditions=x_conds,
                              max_content_length=int(file_size))
        response_data["key"] = s3_key
    else:
        s3_bucket = default_s3_conn.get_bucket(bucket_name)
        file_meta = {
                        "content-type":file_type,
                        "content-size": file_size,
                        "cache-control": file_cache_header,
                        "content-disposition": file_content_disposition_header
                    }

        mp = s3_bucket.initiate_multipart_upload(s3_key, metadata=file_meta)
        response_data = {"id": mp.id, "key": s3_key, "bucket": bucket_name}

    file_data = {
                    "title": file_name,
                    "source": source,
                    "type": file_type,
                    "size": file_size,
                    "bucket": bucket_name,
                    "id": s3_key,
                    "created": time.time()
                }
    redis_client.set("temp_files:%s" % s3_key, json.dumps(file_data))
    print time.time() - start_time
    return response_data

def upload_part(phase, form):
    s3_key = form.s3_key.data.encode('ascii')
    mp_id = form.mp_id.data.encode('ascii')
    content_length = form.content_length.data
    part_number = str(form.part_number.data)
    content_hash = form.content_hash.data
    bucket_name = form.bucket_name.data

    content_hash = content_hash.replace(" ", "+")
    url_part = "%s?partNumber=%s&uploadId=%s" % (s3_key, part_number, mp_id)
    url = "https://%s.s3.amazonaws.com/%s" % (bucket_name, url_part)
    date_now = datetime.datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT')
    string_to_sign = """PUT\n%s\n\n\nx-amz-date:%s\n%s""" % \
        (content_hash, date_now, "/%s/%s" % (bucket_name, url_part))
    b64_hmac = default_s3_conn._auth_handler.sign_string(string_to_sign)
    auth_header = "%s %s:%s" % \
                    ("AWS", default_s3_conn.provider.access_key, b64_hmac)
    headers = {'date': date_now, 'authorization': auth_header}

    return {"headers": headers, "url": url}

def upload_complete(phase, s3_key, mp_id):
    source = "local"
    file_data = redis_client.get("temp_files:%s" % s3_key)
    if file_data is None:
        abort(400)

    file_info = json.loads(file_data)
    bucket_name = file_info["bucket"]
    print time.time()
    s3_bucket = default_s3_conn.lookup(bucket_name)
    print time.time()
    mp_upload = boto.s3.multipart.MultiPartUpload(s3_bucket)
    mp_upload.key_name = s3_key
    mp_upload.id = mp_id
    print time.time()
    mp_upload.complete_upload()
    print time.time()
    return {"id": mp_id, "key": s3_key, "bucket": bucket_name}
