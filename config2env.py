import config
import json
import base64
import pickle

items = [item for item in dir(config) if not item.startswith("__")]
for x in items:
    val = getattr(config, x)
    print "BB_%s=%s" %(x, base64.b64encode(pickle.dumps(val)))
