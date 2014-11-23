var FileAppView = Backbone.View.extend({

    el: "#app",

    events: {
      "click #delete-btn": "deleteFiles",
      "click #upload-btn": "showFilePicker",
      "click #prev": "previous",
      "click #next": "next",
      "click #navigationbar #select-toggle": "renderSelectAllOptionState",
      "change #navigationbar #select-toggle input": "selectAllFiles"
    },

    filesTemplate: _.template($('#files-base-template').html()),

    initialize: function() {
      _.bindAll(this, "render", "renderBucket", "showFile", "showFiles");

      this.on("toggle-selectAll", this.toggleSelectAllOption);

      this.uploaderView = new UploaderView();
    },

    render: function() {
      this.$el.find("#content").html(this.filesTemplate());
    },

    renderBucket: function(bucket, keyOrPrefix) {
      this.providerView = new providerView({
        bucket: bucket,
        keyOrPrefix: keyOrPrefix
      });
      this.providerView.render();

      this.sidebarView = new SideBarView({
        selectedBucket: bucket
      });
      this.sidebarView.render();
    },

    showFilePicker: function() {
      this.uploaderView.showFilePicker(this.providerView);
    },

    previous: function() {
      this.providerView.previous();

      return false;
    },

    next: function() {
      this.providerView.next();

      return false;
    },

    showFile: function(bucket, key) {
      console.log("Show the file " + key);
      var self = this;
      self.renderBucket(bucket, key);
    },

    showFiles: function(bucket) {
      this.renderBucket(bucket, "");
    },

    renderSelectAllOptionState: function(e) {
      var isChecked = this.$el.find('#navigationbar #select-toggle input')[0].checked;

      if (!isChecked) {
        this.$el.find("#navigationbar #select-toggle .file-select").addClass("el-icon-check").removeClass("el-icon-check-empty");
      } else {
        this.$el.find("#navigationbar #select-toggle .file-select").addClass("el-icon-check-empty").removeClass("el-icon-check");
      }

      this.$el.find('#navigationbar #select-toggle input').prop('checked', !(isChecked)).change();

      e.preventDefault();
    },

    toggleSelectAllOption: function(state) {
      if (state) {
        this.$el.find("#navigationbar #select-toggle .file-select").addClass("el-icon-check").removeClass("el-icon-check-empty");
      } else {
        this.$el.find("#navigationbar #select-toggle .file-select").addClass("el-icon-check-empty").removeClass("el-icon-check");
      }

      this.$el.find('#navigationbar #select-toggle input').prop('checked', state).change();
    },

    selectAllFiles : function(e) {
      this.providerView.trigger("selectAll", e.currentTarget.checked);
    },

    onClose: function() {
      if (this.providerView) {
        this.providerView.close();
      }
      if (this.uploaderView) {
        this.uploaderView.close();
      }
      if (this.fileInfoView) {
        this.fileInfoView.close();
      }
    },

    deleteFiles: function(e) {
      this.providerView.deleteFiles();
    }
});


var AppView = Backbone.View.extend({

    events: {},

    initialize: function() {
      this.fileApp = new FileAppView();
      // this.linkApp = new LinkAppView();
    },

    render: function() {
      this.fileApp.render();
      // this.linkApp.render();
    },

    initFiles: function() {
      // this.linkApp.$el.hide();
      this.fileApp.$el.show();
    },

    initLinks: function() {
      this.fileApp.$el.hide();
      // this.linkApp.$el.show();
    }
});

var AppRouter = Backbone.Router.extend({

  routes: {
    "bucket/:bucket/*key" : "renderBucketWithKey",
    "bucket/:bucket(/)" : "renderBucket",
    "help"                : "help"
  },

  help: function() {
    console.log("Hello help");
  },

  renderBucket: function(bucket) {
    console.log("renderBucket " + bucket);

    app.initFiles();
    app.fileApp.showFile(bucket);
  },

  renderBucketWithKey: function(bucket, key) {
    console.log("renderBucketWithKey " + bucket + " " + key);

    app.initFiles();
    app.fileApp.showFile(bucket, key);
  }
});


var app = new AppView();

jQuery(document).ready(function($) {

  var routes = new AppRouter();
  app.router = routes;
  app.render();

  Backbone.history.start({pushState: true});
});

Backbone.View.prototype.close = function(){
  this.remove();
  this.unbind();
  if (this.onClose){
    this.onClose();
  }
};
