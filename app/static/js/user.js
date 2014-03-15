var UserInlineView = Backbone.View.extend({

    events: {
    },

    tagName: "span",

    userId: 2,

    template: _.template($('#user-inline-template').html()),

    initialize: function(options) {
      this.userId = options.userId;
      this.t = options.target;

      if (users.get(this.userId)) {
        this.renderUser(users.get(this.userId))
      }else {
        this.listenTo(users, 'add', this.renderUser)
      }
    },

    renderUser: function(user) {
      if (user.id == this.userId) {
        this.t.html(this.template(user.toJSON()))
      }
    },

    renderUserInFileList: function(file) {
      var self = this;
      var ts = parseInt(file.get("created"));
      var now = new Date().getTime()/1000;
      if (now - ts < 3600) {
        var at = new Date(ts*1000).toLocaleTimeString();
      } else {
        var at = new Date(ts*1000).toDateString();
      }

      var d = this.render();
      d.then(function() {
        self.$el.prepend("<span>"+at+"</span>");
      });

    }

});
