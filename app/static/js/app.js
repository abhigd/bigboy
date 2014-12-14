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

    template: _.template($('#app-template').html()),

    initialize: function(options) {
      this.buckets = new Buckets([bucket_details]);

      _.bindAll(this, "render", "refresh", "showFile", "showFiles");
      _.bindAll(this, "fileSelected");

      this.on("toggle-selectAll", this.toggleSelectAllOption);
      this.on("file-selected", this.fileSelected);
    },

    render: function() {

      this.$el.find("#content").html(this.template());
      this.providerView = new providerView({
        parent: this,
        buckets: this.buckets
      });
      this.uploaderView = new UploaderView();
      this.sidebarView = new SideBarView({
        collection: this.buckets
      });

      this.providerView.render();
      this.sidebarView.render();

      return this;
    },

    refresh: function(bucket, keyOrPrefix) {
      this.providerView.refresh(bucket, keyOrPrefix);
      this.sidebarView.refresh(bucket);
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

    fileSelected : function() {
      if (this.$('.mdfi_toggle_check_box').length > 0) {
        this.$el.find("#delete-btn").removeClass("disabled");
        this.$el.find("#edit-btn").removeClass("disabled");
        this.$el.find("#copy-btn").removeClass("disabled");
        this.$el.find("#move-btn").removeClass("disabled");
        this.$el.find("#paste-btn").removeClass("disabled");
      } else {
        this.$el.find("#delete-btn").addClass("disabled");
        this.$el.find("#edit-btn").addClass("disabled");
        this.$el.find("#copy-btn").addClass("disabled");
        this.$el.find("#move-btn").addClass("disabled");
        this.$el.find("#paste-btn").addClass("disabled");
      }
    },

    renderSelectAllOptionState: function(e) {
      var isChecked = this.$el.find('#navigationbar #select-toggle input')[0].checked;

      this.toggleSelectAllOption(!isChecked);
      // if (!isChecked) {
      //   this.$el.find("#navigationbar #select-toggle .file-select").addClass("el-icon-check").removeClass("el-icon-check-empty");
      // } else {
      //   this.$el.find("#navigationbar #select-toggle .file-select").addClass("el-icon-check-empty").removeClass("el-icon-check");
      // }

      // this.$el.find('#navigationbar #select-toggle input').prop('checked', !(isChecked)).change();

      e.preventDefault();
    },

    toggleSelectAllOption: function(state) {
      if (state) {
        this.$el.find("#navigationbar #select-toggle .file-select").addClass("mdfi_toggle_check_box").removeClass("mdfi_toggle_check_box_outline_blank");
      } else {
        this.$el.find("#navigationbar #select-toggle .file-select").addClass("mdfi_toggle_check_box_outline_blank").removeClass("mdfi_toggle_check_box");
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
      this.fileApp.render();
    },

    refresh: function(bucket, key) {
      this.fileApp.refresh(bucket, key);
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
    console.log("renderRoot " + bucket);

    app.refresh(bucket);
  },

  renderBucketWithKey: function(bucket, key) {
    console.log("renderBucketWithKey " + bucket + " " + key);

    app.refresh(bucket, key);
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
