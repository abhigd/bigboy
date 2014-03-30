from flask import request, redirect
from flask import session, render_template
from flask import make_response, abort
from flask import jsonify, Response

from app import app, gi

import pygeoip
country_code = ["--","AP","EU","AD","AE","AF","AG","AI","AL","AM","AN",
                "AO","AQ","AR","AS","AT","AU","AW","AZ","BA","BB","BD",
                "BE","BF","BG","BH","BI","BJ","BM","BN","BO","BR","BS",
                "BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH",
                "CI","CK","CL","CM","CN","CO","CR","CU","CV","CX","CY",
                "CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH",
                "ER","ES","ET","FI","FJ","FK","FM","FO","FR","FX","GA",
                "GB","GD","GE","GF","GH","GI","GL","GM","GN","GP","GQ",
                "GR","GS","GT","GU","GW","GY","HK","HM","HN","HR","HT",
                "HU","ID","IE","IL","IN","IO","IQ","IR","IS","IT","JM",
                "JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW",
                "KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU",
                "LV","LY","MA","MC","MD","MG","MH","MK","ML","MM","MN",
                "MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY",
                "MZ","NA","NC","NE","NF","NG","NI","NL","NO","NP","NR",
                "NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM",
                "PN","PR","PS","PT","PW","PY","QA","RE","RO","RU","RW",
                "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL",
                "SM","SN","SO","SR","ST","SV","SY","SZ","TC","TD","TF",
                "TG","TH","TJ","TK","TM","TN","TO","TP","TR","TT","TV",
                "TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE",
                "VG","VI","VN","VU","WF","WS","YE","YT","YU","ZA","ZM",
                "ZR","ZW","A1","A2","O1"]

country_continent = ["--","AS","EU","EU","AS","AS","SA","SA","EU","AS",
                     "SA","AF","AN","SA","OC","EU","OC","SA","AS","EU",
                     "SA","AS","EU","AF","EU","AS","AF","AF","SA","AS",
                     "SA","SA","SA","AS","AF","AF","EU","SA","NA","AS",
                     "AF","AF","AF","EU","AF","OC","SA","AF","AS","SA",
                     "SA","SA","AF","AS","AS","EU","EU","AF","EU","SA",
                     "SA","AF","SA","EU","AF","AF","AF","EU","AF","EU",
                     "OC","SA","OC","EU","EU","EU","AF","EU","SA","AS",
                     "SA","AF","EU","SA","AF","AF","SA","AF","EU","SA",
                     "SA","OC","AF","SA","AS","AF","SA","EU","SA","EU",
                     "AS","EU","AS","AS","AS","AS","AS","EU","EU","SA",
                     "AS","AS","AF","AS","AS","OC","AF","SA","AS","AS",
                     "AS","SA","AS","AS","AS","SA","EU","AS","AF","AF",
                     "EU","EU","EU","AF","AF","EU","EU","AF","OC","EU",
                     "AF","AS","AS","AS","OC","SA","AF","SA","EU","AF",
                     "AS","AF","NA","AS","AF","AF","OC","AF","OC","AF",
                     "SA","EU","EU","AS","OC","OC","OC","AS","SA","SA",
                     "OC","OC","AS","AS","EU","SA","OC","SA","AS","EU",
                     "OC","SA","AS","AF","EU","AS","AF","AS","OC","AF",
                     "AF","EU","AS","AF","EU","EU","EU","AF","EU","AF",
                     "AF","SA","AF","SA","AS","AF","SA","AF","AF","AF",
                     "AS","AS","OC","AS","AF","OC","AS","AS","SA","OC",
                     "AS","AF","EU","AF","OC","NA","SA","AS","EU","SA",
                     "SA","SA","SA","AS","OC","OC","OC","AS","AF","EU",
                     "AF","AF","AF","AF"]

def get_user_geo():
    default_country = app.config.get('DEFAULT_COUNTRY')
    ip_addr = request.headers.get("x-forwarded-for", "127.0.0.1")
    cc = gi.country_code_by_addr(ip_addr) or default_country
    cn = country_continent[country_code.index(cc)]

    return cc, cn

def get_closest_bucket():
    cc, cn = get_user_geo()

    return app.config.get("BUCKET_MAP")[cn]["bucket"]

def get_closest_anon_bucket():
    cc, cn = get_user_geo()

    return app.config.get("BUCKET_MAP")[cn]["anon_bucket"]
