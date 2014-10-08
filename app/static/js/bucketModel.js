// var Bucket = Backbone.Model.extend({
//     idAttribute: "Key"
// });

// var Buckets = Backbone.Collection.extend({

//     model: Bucket,
//     url: "/api/bucket/"
// });

var BucketKey = Backbone.Model.extend({

    idAttribute: "Key",

    sync: function(method, model, options) {
        switch (method) {
            case "update":
                console.log("Update");
                console.log(model);
                var params = {
                    StorageClass : model.get("StorageClass"),
                    Bucket: this.collection.bucket,
                    Key: this.id
                };

                var _model = this;
                s3.putObject(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else {
                    _model.set(data.Contents);
                  }

                });
                break;
            case "read":
                console.log("Read");
                var params = {
                  Bucket: 'STRING_VALUE', // required
                  Key: 'STRING_VALUE', // required
                };
                s3.getObject(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else {
                    this.set(data.Contents);
                  }
                });
                break;
        }
    }
});

var BucketKeys = Backbone.Collection.extend({

    model: BucketKey,

    initialize: function(models, options) {
        options = options || {};

        this.bucket = options.bucket;
        this.s3 = options.s3;
        this.maxKeys = options.maxKeys || 30;
        this.marker = "";
        this.delimiter = "/";
        this.filter = options.filter;
        this.prefix = "";

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
                var prefix = options.prefix || this.prefix;
                var delimiter = options.delimiter || this.delimiter;

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
                    _collection.setKeys(data.Contents);
                    _collection.setPrefixes(data.CommonPrefixes);
                  }
                });
        }
    },

    fetchNextPage: function(prefix, delimiter, maxKeys) {
        console.log(this);
        var marker = this.at(this.length-1).get("Key");
        this.fetch({marker: marker});
    },

    fetchPreviousPage: function(prefix, delimiter, maxKeys) {
        //
    },

    setPrefixes: function(data) {
        // var _this = this;
        _.each(data, function(e, i, l) {
            e["id"] =  e['Prefix'];
            e["title"] = e['Prefix'].replace("/", "");
            e["type"] = "folder";
            e["bucket"] = this.bucket;
            this.add(e);
        }, this);
    },

    setKeys: function(data) {
        _.each(data, function(e, i, l) {
            e["id"] = e["Key"];
            e["title"] = e['Key'];
            e["type"] = "file";
            e["bucket"] = this.bucket;
            this.add(e);
        }, this);
    }

});
