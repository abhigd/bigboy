var Bucket = Backbone.Model.extend({
  getConnection: function(bucket) {
    var region = bucket.get("region");

    return new AWS.S3({
          accessKeyId: root_creds["access_key"],
          secretAccessKey: root_creds["secret_key"],
          sessionToken: root_creds["session_token"],
          region: region
    });
  }
});

var Buckets = Backbone.Collection.extend({
    model: Bucket,

    initialize: function(models, options) {
    },

    url: "/api/bucket/",

    parse: function(response) {
        var results = [];
        _.each(response, function(info, name){
            info["id"] = name;
            results.push(info);
        }, this);

        return results;
    }
});

var recentBuckets = Buckets.extend({

});

var BucketKey = Backbone.Model.extend({

    defaults: {
      "isSelected": false
    },

    getNextSet: function(s3, params, context) {
        var moreExists = true;
        var nextMarker = "";

        this.next = function(func, complete) {
            if (moreExists) {
                params["Marker"] = nextMarker;
                s3.listObjects(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else {
                    console.log(data);
                    var keys = _.map(data.Contents, function(v, k ,l){
                        var deleteObject = {
                            Key: v.Key,
                            VersionId: v.VersionId
                        };
                        return deleteObject;
                    });
                    moreExists = data.IsTruncated;
                    nextMarker = _.last(keys)["Key"];
                    func.call(context, keys);
                  }
                });
            } else {
                complete.call(context);
            }
        };
    },

    sync: function(method, model, options) {
        var s3 = this.collection.s3;
        var _model = this;

        switch (method) {
            case "update":
                var params = {
                    StorageClass : model.get("StorageClass"),
                    Bucket: this.collection.bucket.id,
                    Key: this.id
                };

                s3.putObject(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else {
                    _model.set(data.Contents);
                  }

                });
                break;
            case "read":
                var params = {
                    Bucket: this.collection.bucket.id,
                    Key: this.id
                };

                s3.headObject(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else {
                    _model.set(data);
                  }
                });
                break;
            case "delete":
                if (_model.get("type") == "folder") {
                    // Get the keys under this prefix and delete them
                    var params = {
                      Bucket: this.collection.bucket.id,
                      Prefix: model.id
                    };
                    // Add keys as models to this collection if there are
                    // more records and if marker was specified other wise,
                    // reset the collection.
                    var complete = function() {
                        this.collection.remove(_model);
                    };

                    var keysIter = new this.getNextSet(s3, params, _model);
                    var deleteKeys = function(keys) {
                        var self = this;
                        var params = {
                            Bucket: this.collection.bucket.id,
                            Delete: {
                                Objects: keys
                            }
                        };

                        s3.deleteObjects(params, function(err, data) {
                          if (err) console.log(err, err.stack); // an error occurred
                          else {
                            keysIter.next(deleteKeys, complete, self);
                          }
                        });
                    };
                    keysIter.next(deleteKeys, complete, _model);
                } else {
                    var params = {
                        Bucket: this.collection.bucket.id,
                        Key: this.id
                    };

                    s3.deleteObject(params, function(err, data) {
                      if (err) console.log(err, err.stack); // an error occurred
                      else {
                        _model.collection.remove(_model);
                      }
                    });
                }
                break;
        }
    }
});

var BucketKeys = Backbone.Collection.extend({

    model: BucketKey,

    currentPrefix: "",

    initialize: function(models, options) {
        options = options || {};

        this.maxKeys = options.maxKeys || 30;
        this.marker = "";
        this.delimiter = "/";
        this.filter = options.filter;

        _.bindAll(this, 'fetchNextPage', 'setPrefixes', 'setKeys');
    },

    comparator: "title",

    setBucket: function(bucket) {
        if (this.bucket && this.bucket.id != bucket) {
            console.log("Not same bucket");
            this.reset();
        }
        this.bucket = bucket;
        this.s3 = bucket.getConnection(bucket);
    },

    sync: function(method, model, options) {
        var options = options || {};

        switch (method) {
            case "create":
                break;
            case "update":
                break;
            case "read":
                var marker = options.marker || this.marker;
                var delimiter = options.delimiter || this.delimiter;
                var reset = options.reset || false;
                var prefix = "";
                if (options.prefix !== "") {
                    prefix = options.prefix || this.currentPrefix;
                }

                var params = {
                  Bucket: this.bucket.id,
                  MaxKeys: this.maxKeys,
                  Prefix: prefix,
                  Marker: marker,
                  Delimiter: delimiter
                };
                // Add keys as models to this collection if there are
                // more records and if marker was specified other wise,
                // reset the collection.
                var _collection = this;

                this.s3.listObjects(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else {
                    _collection.currentPrefix = prefix;
                    if (reset === true) {
                        _collection.reset();
                    }
                    _collection.setKeys(data.Contents);
                    _collection.setPrefixes(data.CommonPrefixes);
                    _collection.trigger('sync');
                  }
                });
                break;
            case "delete":
                var params = {
                    Bucket: this.bucket.id,
                    Key: this.model.id
                };

                s3.deleteObject(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else {
                    console.log(this);
                    // _model.set(data);
                  }
                });
                break;
        }
    },

    fetchNextPage: function(prefix, delimiter, maxKeys) {
        var marker = this.at(this.length-1).get("id");
        this.fetch({marker: marker});
    },

    fetchPreviousPage: function(prefix, delimiter, maxKeys) {
        //
    },

    setPrefixes: function(data) {
        _.each(data, function(e, i, l) {
            var splitBy = this.currentPrefix === "" ? "/" : this.currentPrefix;

            if (this.currentPrefix === "") {
                e["title"] = e['Prefix'];
            } else {
                e["title"] = e['Prefix'].split(splitBy).pop();
            }

            e["id"] =  e['Prefix'];
            e["type"] = "folder";
            e["bucket"] = this.bucket.id;
            this.add(e);
        }, this);
    },

    setKeys: function(data) {
        _.each(data, function(e, i, l) {
            e["id"] = e["Key"];

            var splitBy = this.currentPrefix === "" ? "/" : this.currentPrefix;
            e["title"] = e['Key'].split(splitBy).pop();
            e["type"] = "file";
            e["bucket"] = this.bucket.id;
            this.add(e);
        }, this);
    }

});
