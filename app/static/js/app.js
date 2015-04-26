var AppView = Backbone.View.extend({

    el: "#app-view",

    currentFileView: undefined,
    currentLinkView: undefined,

    events: {

    },

    template: _.template($('#app-template').html()),

    initialize: function() {
      _.bindAll(this, "render");
      this.links = new Links();
      this.uploads = new UploadFiles();

      this.uploadView = new UploadsView({
        app: this,
        collection: this.uploads,
        el: "#app-view"
      });

      this.linksView = new LinksView({
        app: this,
        collection: this.links,
        el: "#app-view"
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
