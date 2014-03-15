var uploadFile = Backbone.Model.extend({

});

var File = Backbone.Model.extend({

    methodUrl: {
        'create': '/files/',
        'delete': '/files/'
    },

    initialize: function(file) {
        _.bindAll(this, 'links');

    },

    urlRoot: "/files/",

    // sync: function(method, model, options) {
    //     var method = method.toLowerCase();
    //     options = options || {};

    //     switch (method) {
    //         case "delete":
    //             options.url = "/files/"+model.id
    //             break;
    //         case "create":
    //             options.url = "/files/"
    //             break;
    //         case "update":
    //             options.url = "/files/"+model.id
    //             break;
    //         case "read":
    //             options.url = "/files/"+model.id
    //             break;
    //     }

    //     Backbone.sync(method, model, options);
    // },

    _links: undefined,

    links: function() {
        var _self = this;

        if (this._links === undefined) {
            var filter = {"target": this.id}
            this._links = new Links([], {'filter': filter});
            this._links.fetch();

            return this._links;
        }else {
            this._links.reset();
            this._links.fetch();
            return this._links;
        }
    },

    _versions: undefined,

    versions: function() {
        var _self = this;

        if (this._versions === undefined) {
            var versions = Backbone.Collection.extend({
                model: fileVersion,

                parent: _self.id,

                next: undefined,

                comparator: function(file) {
                  return file.get("ts");
                },

                url: function(){
                    var end = this.page*this.perPage,
                        start = end-this.perPage;

                    return "/files/" + _self.id + "/versions/";
                },

                fetch: function(options) {
                    typeof(options) != 'undefined' || (options = {});
                    var self = this;
                    var success = options.success;

                    options.success = function(resp) {
                      if(success) { success(self, resp); }
                    };

                    return Backbone.Collection.prototype.fetch.call(this, options);
                },

                parse: function(data) {
                    this.next = data.next;

                    return data.data;
                }

            });

            this._versions = new versions;
            // this._versions.fetch();

            return this._versions;
        }else {
            return this._versions;
        }
    },

    addVersion: function(versionId) {

    },

    deleteVersion: function(versionId) {

    }

});

var fileVersion = Backbone.Model.extend({

    initialize: function() {
        this.bind("remove", function(model) {
            if (model.get('destroy') == true){
                this.destroy();
            }
        })
    },

    parent: undefined,

    sync: function(method, model, options) {
        var method = method.toLowerCase();
        options = options || {};

        switch (method) {
            case "delete":
                options.url = "/files/"+model.parent+"/versions/"+model.id
                break;
            case "create":
                options.url = "/files/"+model.parent+"/versions/"
                break;
            case "update":
                options.url = "/files/"+model.parent+"/versions/"+model.id
                break;
        }

        Backbone.sync(method, model, options);
    }
});

var uploadFiles = Backbone.Collection.extend({

    model: uploadFile
});

var Files = Backbone.Collection.extend({

    model: File,

    comparator: function(file) {
        // if (a.get("created")>=b.get("created")) {
        //     return 1
        // }else {
        //     return -1
        // }
      return -file.get("created");
    },

    initialize: function() {
        this.page = 1;
        this.total = 0;
        this.perPage = 10;

        this.on({ "add": this.setHumanValues });
    },

    url: function(){
        var end = this.page*this.perPage,
            start = end-this.perPage;

        return "/files/" + '?' + $.param({start: start, end: end});
    },

    fetch: function(options) {
        typeof(options) != 'undefined' || (options = {});
        var self = this;
        var success = options.success;

        options.success = function(resp) {
          if(success) { success(self, resp); }
        };

        return Backbone.Collection.prototype.fetch.call(this, options);
    },

    parse: function(data) {
        this.page = data.page;
        this.perPage = data.perPage;
        this.total = data.total;

        return data.data;
    },

    previousPage: function() {
        if (this.page == 1) {
            return false;
        }
        this.page = this.page - 1;

        return this.fetch();
    },

    nextPage: function() {
        if (this.page*10 > this.total) {
            return false;
        }
        this.page = this.page + 1;

        return this.fetch();
    },

    setHumanValues: function(file) {
        var ts = parseInt(file.get("created"));
        var now = new Date().getTime()/1000;
        if (now - ts < 3600) {
            var at = new Date(ts*1000).toLocaleTimeString();
        } else {
            var at = new Date(ts*1000).toDateString();
        }
        file.set("created_h", at);

        var size = file.get("size");
        if (size < 1024) {
            var size_h = size + "B";
        } else if (size > 1024 && size < 1048576) {
            var size_h = (size/1024).toFixed(2) + " KiB";
        } else if (size > 1048576 && size < 1073741824) {
            var size_h = (size/1048576).toFixed(2) + " MiB";
        }
        file.set("size_h", size_h);
    }
});

var uploads = new uploadFiles;
var files = new Files;

// var Bucket = Backbone.Model.extend({

//     methodUrl: {
//         'create': '/buckets/',
//         'delete': '/buckets/'
//     },

//     urlRoot: "/buckets/",

//     sync: function(method, model, options) {
//         console.log("Save");
//         var method = method.toLowerCase();
//         options = options || {};

//         switch (method) {
//             case "delete":
//                 options.url = "/files/"+model.id
//                 break;
//             case "create":
//                 options.url = "/files/"
//                 break;
//             case "update":
//                 options.url = "/files/"+model.id
//                 break;
//         }

//         Backbone.sync(method, model, options);
//     }

// });

// var Buckets = Backbone.Collection.extend({

//     model: Bucket
// });

// var buckets = new Buckets;
