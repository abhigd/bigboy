var FileAppView = Backbone.View.extend({

    el: "#file-app",

    currentLinkView: undefined,

    events: {

    },

    template: _.template($('#file-app-template').html()),

    initialize: function() {
      _.bindAll(this, "render");
      this.links = new Files();
      this.uploads = new UploadFiles();
      this.uploadView = new UploadsView({
        parent: this,
        collection: this.uploads,
        el: "#file-app"
      });
      this.linkView = new FilesView({
        parent: this,
        collection: this.links,
        el: "#file-app"
      });

      this.currentLinkView = this.linkView;
      this.on("upload::complete", function(file) {
        console.log("File upload completed " + file.get('name'));
      });
    },

    render: function() {
      this.$el.html(this.template());
      this.uploadView.render();
      this.linkView.render();
    },

    onClose: function() {
    }
});


var AppView = Backbone.View.extend({

    events: {},

    initialize: function() {
      this.view = new FileAppView();
    },

    render: function() {
      this.view.render();
    }
});

var AppRouter = Backbone.Router.extend({

  routes: {
    "link/:link" : "link",
    "link/"      : "links",
    "test/:test"  : "test",
    ""            : "links"
  },

  links: function() {
    console.log("Show all links");
    app.render();
  },

  link: function(link) {
    console.log("Show link");
    app.render(link);
  },

  test: function(test) {
    console.log("Show Link Usage");
  }

});


var app = new AppView();

jQuery(document).ready(function($) {

  var routes = new AppRouter();
  app.router = routes;
  // app.render();

  Backbone.history.start({pushState: true});
});

Backbone.View.prototype.close = function(){
  this.remove();
  this.unbind();
  if (this.onClose){
    this.onClose();
  }
};
