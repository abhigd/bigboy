var Link = Backbone.Model.extend({

   initialize: function() {
        _.bindAll(this, 'setHumanValues');

        this.on({ "add": this.setHumanValues });
        this.on({ "change": this.setHumanValues });
    },

    setHumanValues: function(link) {
        var size = parseInt(link.get("max_upload_size"));
        if (size > 1024 && size < 1048576) {
            var size_h = (size/1024) + "K";
        } else if (size > 1048576 && size < 1073741824) {
            var size_h = (size/1048576) + "M";
        } else if (size > 1073741824) {
            var size_h = (size/1073741824) + "G";
        }
        link.set("max_upload_size_h", size_h);

        var max_downloads = parseInt(link.get("max_target_downloads"));
        if (max_downloads == 0) {
            link.set("max_target_downloads_h", "")
        } else {
            link.set("max_target_downloads_h", max_downloads)
        }

        var expires_in = link.get("expires_in");
        var now = new Date().getTime()/1000;

        if (expires_in <= now) {
            link.set("expired", true);
            link.set("expired_h", "Link has expired.");
        } else {
            link.set("expired", false);
            var ts = parseInt(link.get("expires_in"));
            var at = new Date(ts*1000).toLocaleString();

            link.set("expired_h", "Link expires by " + at + ".")
        }
    },

    urlRoot: "/link/",

    sync: function(method, model, options) {
        var method = method.toLowerCase();
        options = options || {};

        switch (method) {
            case "delete":
                options.url = "/link/"+model.id
                if (options.target)
                    options.url = options.url+"?target="+options.target
                break;
            case "create":
                options.url = "/link/"
                break;
            case "update":
                options.url = "/link/"+model.id
                break;
        }

        Backbone.sync(method, model, options);
    }

});

var LinkTarget = Backbone.Model.extend({

   initialize: function(file) {
        _.bindAll(this, 'setHumanValues');

        this.on({ "add": this.setHumanValues });
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

var LinkSearchTargets = Backbone.Collection.extend({

    model: File,

    comparator: function(file) {
      return -file.get("created");
    },

    initialize: function(models, options) {
        this.prefix = options.link
    },

    url: function() {
        return "/link/"+this.prefix+'/search';
    },

    parse: function(data) {

        return data.data;
    }

});

var LinkTargets = Backbone.Collection.extend({

    model: LinkTarget,

    initialize: function(models, options) {
        this.prefix = options.link
    },

    url: function() {
        return "/link/"+this.prefix+'/target/';
    }
});

var Links = Backbone.Collection.extend({

    model: Link,

    filter: {},

    comparator: function(link) {
      return -link.get("created");
    },

    initialize: function(models, options) {
        options = options || {};

        this.page = 1;
        this.total = 0;
        this.perPage = 10;
        this.filter = options.filter;

        _.bindAll(this, 'url');
    },

    url: function() {
        var end = this.page*this.perPage,
            start = end-this.perPage,
            params = {start: start, end: end}

        if (this.filter)
            $.extend(params, this.filter);

        return "/link/" + '?' + $.param(params);
    },

    fetch: function(options) {
        typeof(options) != 'undefined' || (options = {});
        var self = this;
        var success = options.success;

        options.success = function(resp) {
          if(success) { success(self, resp); }
        };
        options.remove = false;

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
    }
});

var links = new Links;
