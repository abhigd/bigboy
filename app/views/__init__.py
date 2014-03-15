from app import app
from app.forms import *
from app import default_s3_conn
from app import redis_client
from app import sqs_conn, sqs_queue
from app.user import User

from flask import request, redirect, url_for
from flask import session, render_template
from flask import make_response, abort
from flask import jsonify, Response

@app.route('/test')
def test():
    return render_template("test.html")
