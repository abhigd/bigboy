var baseBucketView = Backbone.View.extend({

  s3: undefined,

  getS3: function() {
    return new AWS.S3({
          accessKeyId: root_creds["access_key"],
          secretAccessKey: root_creds["secret_key"],
          sessionToken: root_creds["session_token"]
    });
  }
});

var uploadView = Backbone.View.extend({

  el: "<input type='file' class='file-input' multiple/>",

  events: {
    "change": "startFileUpload"
  },

  initialize: function(options) {
    this.parent = options.parent;
    this.fileId = "file-input-"+new Date().getTime();
    this.uploadUrlPath = options.uploadUrlPath || "/files/upload/";
    this.s3 = options.s3;
    this.bucket = options.bucket;
    this.prefix = options.prefix;
  },

  render: function() {
    this.$el.attr("id", this.fileId);
    $(this.$el).appendTo('body');
  },

  showFilePicker: function() {
    this.$el.trigger("click");
  },

  startFileUpload: function(e) {
    var self = this;
    var currentTargetFile = e.currentTarget;

    _.each(currentTargetFile.files, function(e, i, l) {
      this.collection.add(
        new uploadFile({
          'size': e.size,
          'title': e.name,
          'type': e.type,
          'input_id': self.fileId,
          'file_idx': i,
          'progress': -1
        })
      );
    }, this);

    $(currentTargetFile).BigBoyUploader({
      s3: this.s3,
      bucket: this.bucket,
      prefix: this.prefix,
      urlPath: this.uploadUrlPath,
      onComplete: function() {
        console.log("All files completed");
        self.parent.trigger('upload-complete', self);
      },
      onFileStart: function(fileIdx) {
        var file = self.collection.findWhere({'input_id': self.fileId, 'file_idx': fileIdx});
        file.set({uploadStatus: -1, progress:0});
      },
      onFileComplete: function(key, fileIdx, result) {
        var file = self.collection.findWhere({'input_id': self.fileId, 'file_idx': fileIdx});
        var uploadStatus = result === true?1:0;
        file.set({progress: 100, key: key, uploadStatus: uploadStatus});

        console.log("File Completed " + key + " fileIdx " + fileIdx +
          " status " + result);
      },
      onProgress: function(key, fileIdx, progressPercent) {
        var file = self.collection.findWhere({'input_id': self.fileId, 'file_idx': fileIdx});
        file.set({progress: progressPercent});
      }
    });
  }
});

var fileView = Backbone.View.extend({

    el: '<li class="row">',

    events: {
      "click a.file-link": "showFile",
      "click .file-select": "toggleFileSelectCheckBox",
      "click .file-title": "toggleFileSelectCheckBox",
      "change .file-select input": "toggleFileSelect"
    },

    uploadTemplate: _.template($('#upload-file-template').html()),
    fileTemplate: _.template($('#file-template').html()),

    initialize: function(options) {
      this.parent = options.parent;

      _.bindAll(this, 'showFile', '_remove');

      this.listenTo(this.model, 'remove', this._remove);
      this.listenTo(this.model, 'change:progress', this.renderProgress);
      this.listenTo(this.model, 'change:uploadStatus', this.renderUploadStatus);
      this.listenTo(this.model.collection, 'reset', this.remove);
    },

    render: function() {
      this.$el.html(this.fileTemplate(this.model.toJSON()));
      this.$el.prop('id', this.model.get("id"));

      return this;
    },

    renderFileMeta: function() {
    },

    renderProgress: function(file) {
      var progress = file.get('progress');

      if (progress == -1) {
      } else {
        this.$el.find(".upload-file-progress span.percent").html(file.get("progress")+"%");
      }

    },

    renderUploadStatus: function(file) {
      if (file.get("uploadStatus") == 1) {
        this.$el.find("label").css("opacity", 0.5);
      } else if (file.get("uploadStatus") == -1) {
        this.$el.find("label").css("font-weight", "bold");
      } else {
        this.$el.find("label").css("opacity", 0.5);
        this.$el.find("label").css("color", "red");
      }
    },

    _remove: function() {
      this.remove();
    },

    showFile: function(e) {
      e.preventDefault();

      if (this.model.get("type") == "folder") {
        this.parent.trigger("navigate", this.model.get("id"), true);
      }
      else {
       this.parent.trigger("view", this.model.get("id"), false);
      }

      return false;
    },

    hoverSelector: function(e) {
      console.log("Hovering");
    },

    toggleFileSelect: function(e) {
      var isChecked = e.currentTarget.checked;

      if (isChecked) {
        this.$el.find(".file-select").addClass("el-icon-check").removeClass("el-icon-check-empty");
      } else {
        this.$el.find(".file-select").addClass("el-icon-check-empty").removeClass("el-icon-check");
      }
    },

    toggleFileSelectCheckBox: function() {
      var isChecked = this.$el.find('.file-select input')[0].checked;

      this.$el.find('.file-select input').prop('checked', !(isChecked)).change();
    }

});

var uploaderView = baseBucketView.extend({

    collection: uploads,

    uploaders: [],

    events: {
      // "change input.file-input": "startFileUpload"
    },

    template: _.template('<div class="upload-file-list container-fluid"></div>'),

    initialize: function() {

      _.bindAll(this, 'showFilePicker', 'updateStatus', 'updateProgress');
      _.bindAll(this, 'uploadComplete');

      // this.listenTo(this.collection, "add", this.addOne);
      // this.listenTo(this.collection, "remove", this.removeOne);
      this.listenTo(this.collection, "change:uploadStatus", this.updateStatus);
      this.listenTo(this.collection, "change:progress", this.updateProgress);

      // this.on('upload-start')
      this.on('upload-complete', this.uploadComplete);
    },

    render: function() {
      this.$el.html(this.template());

      this.collection.each(function(model) {
        this.addOne(model);
      }, this);

      return this;
    },

    addOne: function(file) {
      var view = new fileView({model: file});
      this.$(".upload-file-list").append(view.render().el);
    },

    removeOne: function(file) {
      file.destroy();
    },

    updateProgress: function(file) {

    },

    updateStatus: function(file) {
      var result = file.get('uploadStatus');

      // if (result == 1) {
      //   files.create(file.attributes, {wait: true});
      //   this.collection.remove(file);
      // }
    },

    uploadComplete: function(uploader) {
      uploader.close();
    },

    show: function() {
      this.$el.show();
    },

    hide: function() {
      this.$el.hide();
    },

    showFilePicker: function(e) {
      var bucket_name = "meer-sg-1";
      var uploader = new uploadView({
        collection: uploads,
        parent: this,
        s3: this.getS3(),
        bucket: bucket_name,
        prefix: ""
      });
      this.uploaders.push(uploader);
      uploader.render();
      uploader.showFilePicker();
    },

    onClose: function() {
      _.each(this.uploaders, function(uploader) {
        uploader.close();
      });
    }

});

var providerView = baseBucketView.extend({

    events: {
      "change .file-select input": "fileSelected",
    },

    currentFolder: "",

    initialize: function(options) {
      _.bindAll(this, 'sync', 'addOne', 'deleteFiles');
      _.bindAll(this, 'previous', 'next', 'fileSelected', 'render');
      _.bindAll(this, 'toggleSelectAll', 'navigate');

      this.bucket_name = options.bucket;
      var path = options.keyOrPrefix || "";

      if (path.endsWith("/")) {
        this.prefix = path;
      } else {
        // Get the prefix holding this key
        this.prefix = path.slice(0, path.lastIndexOf("/")+1);
      }

      var s3 = this.getS3();
      this.collection = new BucketKeys([], {
        bucket: this.bucket_name,
        s3: s3
      });

      this.collection.bind('sync', this.sync);
      this.collection.bind('add', this.addOne);

      this.on("selectAll", this.toggleSelectAll);
      this.on("navigate", this.navigate);
      this.on("view", this.view);

      this.collection.fetch({prefix: this.prefix});
    },

    render: function() {
      this.$el.addClass('file-list container-fluid');

      var breadView = new FileBreadCrumbView({
        prefix: this.prefix,
        parent: this
      });
      breadView.render();

      return this;
    },

    addOne: function(file) {
      var view = new fileView({model: file, parent: this});
      var idx = this.collection.indexOf(file);

      if (idx === 0) {
        this.$el.prepend(view.render().el);
      } else {
        this.$el.append(view.render().el);
      }

    },

    sync: function() {
      this.fileSelected();
      app.fileApp.trigger("toggle-selectAll", false);
      this.currentFolder = this.collection.currentPrefix;
    },

    previous: function() {
      this.collection.previousPage();

      return false;
    },

    next: function() {
      this.collection.fetchNextPage();

      return false;
    },

    hide: function() {
      this.$el.hide();
    },

    show: function() {
      this.$el.show();
    },

    fileSelected : function() {

      if (this.$('.el-icon-check').length > 0) {
        app.fileApp.trigger("file-selected", false);
      } else {
        app.fileApp.trigger("file-selected", true);
      }
    },

    deleteFiles: function() {
      var selectedFiles = this.$('.el-icon-check input');

      _.each(selectedFiles, function(elem) {
          var id = this.$(elem).data("id");
          var f = files.get(id);
          f.destroy({wait: true});
          files.remove(f);
          app.fileApp.trigger("toggle-selectAll", false);
      }, this);

      files.fetch();
    },

    shareFiles: function() {
    },

    toggleSelectAll: function(isChecked) {
        this.$el.find(".file-selector input").prop('checked', isChecked).change();
    },

    navigate: function(path, isPrefix) {
      if (path.substring(0, 1) != "/") {
        path = "/" + path;
      }

      app.router.navigate("bucket/" + this.bucket + path, {trigger: true});
    },

    view: function(path, isPrefix) {
      var key = this.collection.get(path);
      key.fetch();

      app.router.navigate("bucket/" + this.bucket + path);
    },

    }
});

var FileBreadCrumbView = Backbone.View.extend({

    el: "#actionbar-breadcrumb",

    template: _.template($('#file-bread-template').html()),
    linkTemplate: _.template($('#file-bread-link-template').html()),

    events: {
      "click li a": "jumpToFolder",
    },

    initialize: function(options) {
      this.parent = options.parent;
      this.prefix = options.prefix;

      _.bindAll(this, 'jumpToFolder', 'render');
      // this.listenTo(this.collection, 'reset', this.render);
    },

    render: function() {
      var crumbs = this.prefix.split("/");
      this.$el.html(this.template());

      _.each(crumbs, function(x) {
        this.$el.find('.breadcrumb').append(this.linkTemplate({title: x}));
      }, this);
    },

    jumpToFolder: function(e) {
      var id = $(e.currentTarget).attr("id");
      var crumbs = $(e.currentTarget).parent().prevAll().filter(".folder");
      var links = [id];
      var prefix = "";

      if (id !== "/") {
        _.each(crumbs, function(x) {
          links.unshift($(x).find("a").attr("id"));
        });
        // this.collection.fetch({prefix: links.join("/")+"/", reset: true});
        this.parent.navigate(links.join("/")+"/");
      } else {
        // this.collection.fetch({prefix: "", reset: true});
        this.parent.navigate("/");
      }

    }
});

