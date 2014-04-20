var LinkAppView = Backbone.View.extend({

    el: "#link-app",

    events: {

    },

    template: _.template($('#link-app-template').html()),

    initialize: function() {
    },

    render: function() {
      this.$el.html(this.template());
    },

    renderLinks: function() {
      this.linksView = new LinksView();
      this.$el.find("#linkAppViewWrapper").html(this.linksView.render().el);
    },

    renderLink: function(link) {
      this.linkView = new LinkView({model: link});
      this.$el.find("#linkAppViewWrapper").html(this.linkView.render().el);
    },

    showLink: function(linkId) {
      console.log("Show the link " + linkId);
      var self = this;
      var link = links.get(linkId);

      var link = new Link({id: linkId});
      link.fetch({'success': function() {
          links.remove(link);
          links.add(link);
          self.renderLink(link);
      }});
    },

    showLinks: function() {
      // this.linkApp.render();
      this.renderLinks();
      links.fetch();
    },

    onClose: function() {
      if (this.linkView) {
        this.linkView.close();
      }
    }

});

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
      _.bindAll(this, "render", "renderFiles", "renderFile");
      _.bindAll(this, "renderUploadProgressCount", "renderUploadProgressTitle");

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

    renderFiles: function() {
      this.$el.find("#fileAppViewWrapper").html(this.filesTemplate());

      this.uploaderView = new uploaderView({collection: uploads});
      this.providerView = new providerView({collection: files});

      this.$el.find("#uploaderView").html(this.uploaderView.render().el);
      this.$el.find("#providerView").html(this.providerView.render().el);
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
      this.linkApp = new LinkAppView();
    },

    render: function() {
      this.fileApp.render();
      this.linkApp.render();
    },

    initFiles: function() {
      this.linkApp.$el.hide();
      this.fileApp.$el.show();
    },

    initLinks: function() {
      this.fileApp.$el.hide();
      this.linkApp.$el.show();
    }
});

var AppRouter = Backbone.Router.extend({

  routes: {
    "files/:file" : "file",
    "files/"      : "fileIndex",
    "link/:link"  : "link",
    "link/"       : "linkIndex",
    "test/:test"  : "test",
    ""            : "fileIndex",
  },

  fileIndex: function() {
    console.log("Show all my files ");
    app.initFiles();
    app.fileApp.showFiles();
  },

  file: function(file) {
    console.log("Show file")
    app.initFiles();
    app.fileApp.showFile(file);
  },

  linkIndex: function() {
    console.log("Show all links");
    app.initLinks();
    app.linkApp.showLinks();
  },

  link: function(link) {
    console.log("Show link");
    app.initLinks();
    app.linkApp.showLink(link);
  },

  test: function(test) {
    console.log("Show Link Usage")
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
}
