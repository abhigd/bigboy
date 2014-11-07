var FileAppView = Backbone.View.extend({

    el: "#file-app",

    events: {
      "click #delete-btn": "deleteFiles",
      "click #share-btn": "shareFiles",
      "click #upload-btn": "showFilePicker",
      "click #prev": "previous",
      "click #next": "next",
      "click #navigationbar #select-toggle": "renderSelectAllOptionState",
      "change #navigationbar #select-toggle input": "selectAllFiles"
    },

    template: _.template($('#file-app-template').html()),
    filesTemplate: _.template($('#files-base-template').html()),

    initialize: function() {
      _.bindAll(this, "render", "renderBucket", "showFile", "showFiles");

      this.listenTo(uploads, "add", this.renderUploadProgressCount);
      this.listenTo(uploads, "remove", this.renderUploadProgressCount);
      this.listenTo(uploads, 'change:uploadStatus', this.renderUploadProgressTitle);
      this.listenTo(files, "remove", this.uncheckSelectAllCheckBox);

      this.on("file-selected", this.fileSelected);
      this.on("toggle-selectAll", this.toggleSelectAllOption);
    },

    render: function() {
      this.$el.html(this.template());
    },

    renderBucket: function(bucket, keyOrPrefix) {
      // console.log("Rendering bucket " + bucket + " " + keyOrPrefix);
      this.$el.find("#fileAppViewWrapper").html(this.filesTemplate());
      this.providerView = new providerView({
        bucket: bucket,
        keyOrPrefix: keyOrPrefix
      });

      this.uploaderView = new uploaderView({collection: uploads});
      this.providerView = new providerView({collection: files});

      this.$el.find("#uploaderView").html(this.uploaderView.render().el);
      this.$el.find("#providerListView").html(this.providerView.render().el);
    },

    renderFile: function(file) {
      this.fileInfoView = new FileInfoView({
        model: file
      });
      this.$el.find("#fileAppViewWrapper").html(this.fileInfoView.render().el);
    },

    deleteFiles: function() {
      this.providerView.deleteFiles();
    },

    shareFiles: function() {
      this.providerView.shareFiles();
    },

    showFilePicker: function() {
      this.uploaderView.showFilePicker();
    },

    previous: function() {
      this.providerView.previous();

      return false;
    },

    next: function() {
      this.providerView.next();

      return false;
    },

    renderUploadProgressCount: function(file, c, options) {
      var length = c.length;
      if (length > 0) {
        this.$(".upload-snippet").show();
        this.$(".upload-snippet-count").html(length);
      } else {
        this.$(".upload-snippet").hide();
        this.$('.upload-snippet-alert').hide();
        this.$('.upload-snippet-title').html("");
      }
    },

    renderUploadProgressTitle: function(file) {
      if (file.get("uploadStatus") == -1) {
        this.$('.upload-snippet-title').html(file.get("title"))
      } else if (file.get("uploadStatus") == 0) {
        this.$('.upload-snippet-alert').show();
      } else if (file.get("uploadStatus") == 1) {
        this.$('.upload-snippet-title').html("");
      }
    },

    showFile: function(fileId) {
      console.log("Show the file " + fileId);
      var self = this;
      var file = files.get(fileId);

      var file = new File({id: fileId});

      file.fetch({success: function(data){
        files.remove(file);
        files.add(file);
        self.renderFile(file);
      }});
    },

    showFiles: function() {
      this.renderFiles();
      files.fetch();
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

    fileSelected: function(value) {
      if (value) {
        this.$el.find("#delete-btn").addClass("disabled");
        this.$el.find("#share-btn").addClass("disabled");
      } else {
        this.$el.find("#delete-btn").removeClass("disabled");
        this.$el.find("#share-btn").removeClass("disabled");
      }
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
