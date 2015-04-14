var UploadFile = Backbone.Model.extend({

});

var File = Backbone.Model.extend({

});

var uploadFiles = Backbone.Collection.extend({

    model: UploadFile
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

    },

    url: function(){
        var end = this.page*this.perPage,
            start = end-this.perPage;

        return "/link/" + '?' + $.param({start: start, end: end});
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
    }

});

var uploads = new uploadFiles();
var files = new Files();
