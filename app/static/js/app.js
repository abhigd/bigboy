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

      // Render existing links
      this.links.fetch();

      // Wire in events for new files being uploaded

      // When a new upload session starts
      //    Create a new link
      //    Use that as the prefix for new uploads
      this.on("upload::init", function(file) {
        console.log("Starting new upload session");
        var link = this.links.create({}, {wait: true});

        // this.currentFileView = filesView;
        // this.currentLinkView = linkView;

        this.trigger('upload::begin', link);
      });

      this.on("upload::file::complete", function(file) {
        this.links.add(file, {at:0});
        console.log("File upload completed " + file.get('name'));
      });

      // When all uploads complete including failed ones.
      //  Request server to update list of files uploaded to this link
      this.on("upload::complete", function(file) {
        console.log("All uploads completed");
      });
    },

    render: function() {
      this.$el.html(this.template());
      this.uploadView.render();
      this.linksView.render();
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
