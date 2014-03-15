var User = Backbone.Model.extend({

    urlRoot: "/user/",

});

var Users = Backbone.Collection.extend({

    model: User,

    comparator: function(user) {
      return -user.get("created");
    },

    initialize: function() {
        this.page = 1;
        this.total = 0;
        this.perPage = 10;
    },

    url: function() {
        var end = this.page*this.perPage,
            start = end-this.perPage;

        return "/user/" + '?' + $.param({start: start, end: end});
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

    fetchOrGet: function(id) {
        var d = $.Deferred();

        if (!users.get(id)){
            var u = new User({id: id})
            u.fetch({'success': function() {
                users.add(u);
                d.resolve(u);
            }});

            return d;
        } else {
            d.resolve(users.get(id));
        }

        return d;
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

var users = new Users;
