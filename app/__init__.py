import os
import base64
import json
import pickle
import urlparse

import redis

import boto
from boto.s3 import S3RegionInfo
from boto.s3.key import Key

from boto.cloudfront import CloudFrontConnection
from boto.cloudfront.distribution import Distribution

import boto.sqs
from boto.sqs.regioninfo import SQSRegionInfo
from boto.sqs.connection import SQSConnection

from flask import Flask, g, current_app
from flask.ext.login import LoginManager

from session import RedisSessionInterface
import pygeoip

import logging
logging.basicConfig(filename="bigboy.log", level=logging.INFO)

app = Flask(__name__)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
# login_manager.unauthorized_handler =

def startup():
    with app.app_context():

        load_config()

        AWS_ACCESS = app.config.get('AWS_ACCESS')
        AWS_SECRET = app.config.get('AWS_SECRET')

        # S3
        regions = set([x["aws_region"] for x in app.config.get('BUCKET_MAP').values()])
        s3_connections = {}
        for region in regions:
            conn = boto.s3.connect_to_region(region, aws_access_key_id=AWS_ACCESS,
                                             aws_secret_access_key=AWS_SECRET)
            s3_connections[region] = conn

        current_app.default_s3_conn = default_s3_conn = s3_connections[app.config.get('DEFAULT_AWS_REGION')]

        # Redis
        redis_host = app.config.get('REDIS_HOST', 'localhost')
        redis_port = app.config.get('REDIS_PORT', 6379)
        redis_db = app.config.get('REDIS_DB', 0)
        redis_password = app.config.get('REDIS_PASSWORD')
        pool = redis.ConnectionPool(host=redis_host, port=redis_port,
                                        db=redis_db, password=redis_password)
        current_app.redis_client = redis_client = redis.Redis(connection_pool=pool)

        # CloudFront
        for cn, cn_info in app.config.get('BUCKET_MAP').iteritems():
            redis_client.set("config:%s:bucket" % cn, cn_info["bucket"])
            redis_client.set("config:%s:anon_bucket" % cn, cn_info["anon_bucket"])
            redis_client.set("config:%s:cf_id" % cn, cn_info["cf_id"])
            redis_client.set("config:%s:cf_id" % cn_info["bucket"], cn_info["cf_id"])
            redis_client.set("config:%s:cf" % cn_info["cf_id"], cn_info["cf"])
            redis_client.set("config:%s:cn" % cn_info["bucket"], cn)
            redis_client.set("config:%s:cn" % cn_info["anon_bucket"], cn)

        current_app.cf_keypair_id = app.config.get('CF_PRIVATE_ID')
        current_app.cf_private_key_file = app.config.get('CF_PRIVATE_PEM_FILE')

        # SQS
        sqs_region = SQSRegionInfo(name='ap-southeast-1',
                                  endpoint='ap-southeast-1.queue.amazonaws.com')
        sqs_conn = SQSConnection(AWS_ACCESS, AWS_SECRET, region=sqs_region)
        sqs_queue = sqs_conn.get_queue("celery")
        sqs_failed_queue = sqs_conn.get_queue("failed")

        current_app.gi = pygeoip.GeoIP('GeoIP.dat')

        current_app.session_interface = RedisSessionInterface(redis_client)
        # print app.config.get("ENVIRONMENT")
        from app.views import auth, files, link, user
        app.run('0.0.0.0', current_app.config.get('PORT'))

def load_config():
    environment = current_app.config.get('ENVIRONMENT')
    if environment == "heroku":
        for key in os.environ.keys():
            if key.startswith("BB_"):
                current_app.config[key.replace("BB_", "")] = pickle.loads(base64.b64decode(os.getenv(key)))

        # Parse rediscloud URL
        url = urlparse.urlparse(os.environ.get('REDISCLOUD_URL'))
        current_app.config["REDIS_HOST"] = url.hostname
        current_app.config["REDIS_PORT"] = url.port
        current_app.config["REDIS_PASSWORD"] = url.password

    else:
        current_app.config.from_object('config')

