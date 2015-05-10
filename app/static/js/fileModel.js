var UploadFile = Backbone.Model.extend({

});

var File = Backbone.Model.extend({

});

var Link = Backbone.Model.extend({

});

var UploadFiles = Backbone.Collection.extend({

    model: UploadFile
});

var Files = Backbone.Collection.extend({

    model: File,

    initialize: function(models, options) {
        this.link = options.link;
    },

    url: function() {
        var link_id = this.link.get("id");

        return "/api/link/" + link_id + "/files/";
    },

    parse: function(data) {
        // this.page = data.page;
        // this.perPage = data.perPage;
        // this.total = data.total;

        return data.data;
    }

});

var Links = Backbone.Collection.extend({

    model: Link,

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

        return "/api/link/" + '?' + $.param({start: start, end: end});
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

