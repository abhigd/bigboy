// var Bucket = Backbone.Model.extend({
//     idAttribute: "Key"
// });

// var Buckets = Backbone.Collection.extend({

//     model: Bucket,
//     url: "/api/bucket/"
// });

var BucketKey = Backbone.Model.extend({

    sync: function(method, model, options) {
        var s3 = this.collection.s3;
        var _model = this;

        switch (method) {
            case "update":
                var params = {
                    StorageClass : model.get("StorageClass"),
                    Bucket: this.collection.bucket,
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
                    Bucket: this.collection.bucket,
                    Key: this.id
                };

                s3.headObject(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else {
                    // console.log(this);
                    _model.set(data);
                  }
                });
                break;
        }
    }
});

var BucketKeys = Backbone.Collection.extend({

    model: BucketKey,

    currentPrefix: "",

    initialize: function(models, options) {
        options = options || {};

        this.bucket = options.bucket;
        this.s3 = options.s3;
        this.maxKeys = options.maxKeys || 30;
        this.marker = "";
        this.delimiter = "/";
        this.filter = options.filter;

        _.bindAll(this, 'fetchNextPage', 'setPrefixes', 'setKeys');
    },

    comparator: "title",

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
                  Bucket: this.bucket,
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
            e["bucket"] = this.bucket;
            this.add(e);
        }, this);
    },

    setKeys: function(data) {
        _.each(data, function(e, i, l) {
            e["id"] = e["Key"];

            var splitBy = this.currentPrefix === "" ? "/" : this.currentPrefix;
            e["title"] = e['Key'].split(splitBy).pop();
            e["type"] = "file";
            e["bucket"] = this.bucket;
            this.add(e);
        }, this);
    }

});
