import time
from flask import current_app
from flask.ext.login import login_user, current_user
from flask.ext.login import login_required, login_url

from boto.cloudfront.distribution import Distribution

def get_signed_url(file_info):

    file_id = file_info["id"]
    bucket = file_info["bucket"]
    cf_id = current_app.redis_client.get("config:%s:cf_id" % bucket)

    cf_dist = Distribution()
    cf_host = current_app.redis_client.get("config:%s:cf" % cf_id)

    # Generate a signed url
    url = "https://%s/%s" % (cf_host, file_id)
    expire_time = int(time.time() + 2592000 )
    signed_url = cf_dist.create_signed_url(
                    url=url, keypair_id=current_app.cf_keypair_id,
                    expire_time=expire_time,
                    private_key_file=current_app.cf_private_key_file)

    return signed_url
