import sys
import time

import config
import boto
from boto.s3.key import Key

import requests
from boto.cloudfront.distribution import Distribution

settings = [item for item in dir(config) if not item.startswith("__")]

s3_conn = boto.connect_s3(aws_access_key_id=config.AWS_ACCESS,
                           aws_secret_access_key=config.AWS_SECRET)

bucket_map = config.BUCKET_MAP
for cn, data in bucket_map.iteritems():
    try:
        print cn
        bucket_name = data["bucket"]
        anon_bucket_name = data["anon_bucket"]
        cf_host = data["cf"]

        bucket = s3_conn.get_bucket(bucket_name)
        anon_bucket = s3_conn.get_bucket(anon_bucket_name)

        if bucket.get_versioning_status()["Versioning"] == "Enabled":
            print "%s VERSIONING: %s" % (bucket.name, u'\u2713')
        else:
            print "%s VERSIONING: %s" % (bucket.name, "NOT OK")

        headers = {
                    "Access-Control-Request-Method": "POST",
                    "Origin": config.HOSTNAME
                  }
        for b in [bucket, anon_bucket]:
            # Check CORS
            # Check read/write/delete
            # Check key access via bucket
            print "%s ACCESS: %s" % (b.name, u'\u2713')
            r = requests.options("https://%s.s3.amazonaws.com/" % (b.name),
                                  headers=headers)
            # print r.headers
            if r.status_code < 299:
                print "%s CORS: %s" % (b.name, u'\u2713')
            else:
                print "%s CORS: %s" % (b.name, "NOT OK")

            k = Key(b)
            k.key = 'touch'
            print "%s CREATE: %s" % (b.name, u'\u2713')
            cf_dist = Distribution()

            url = "https://%s/%s" % (cf_host, "touch")
            expire_time = int(time.time() + 600 )
            signed_url = cf_dist.create_signed_url(
                            url=url, keypair_id=config.CF_PRIVATE_ID,
                            expire_time=expire_time,
                            private_key_file=config.CF_PRIVATE_PEM_FILE)

            # print signed_url
            r = requests.head(signed_url)
            if r.status_code < 299:
                print "%s CF: %s" % (b.name, u'\u2713')
            else:
                print "%s CF: %s" % (b.name, "NOT OK")

            versions = b.list_versions('touch')
            if versions:
                key_list = [("touch", v.version_id) for v in versions]
                result = b.delete_keys(key_list)
                if not result.errors:
                    print "%s DELETE: %s" % (b.name, u'\u2713')


    except Exception as e:
        print e
