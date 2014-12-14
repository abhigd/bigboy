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
    console.log(this.prefix);
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
      this.listenTo(this.parent.collection, 'reset', this._remove);
    },

    render: function() {
      this.$el.html(this.fileTemplate(this.model.toJSON()));
      this.$el.prop('id', this.model.get("id"));

      return this;
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

      this.model.set("isSelected", isChecked);
    },

    toggleFileSelectCheckBox: function() {
      var isChecked = this.$el.find('.file-select input')[0].checked;

      this.$el.find('.file-select input').prop('checked', !(isChecked)).change();
    }

});

var UploaderView = baseBucketView.extend({

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

    showFilePicker: function(provider) {
      var bucket = provider.getCurrentBucket();
      var prefix = provider.getCurrentFolder();
      var uploader = new uploadView({
        collection: uploads,
        parent: this,
        s3: this.getS3(),
        bucket: bucket,
        prefix: prefix
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

    el: "#fileAppViewWrapper",

    template: _.template($('#files-provider-template').html()),

    currentFolder: "",

    initialize: function(options) {
      _.bindAll(this, 'sync', 'addOne', 'deleteFiles', 'removeOne');
      _.bindAll(this, 'previous', 'next', 'fileSelected', 'render');
      _.bindAll(this, 'toggleSelectAll', 'navigate', 'view');

      this.parent = options.parent;
      this.buckets = options.buckets;
      this.collection = new BucketKeys();

      this.metaView = new FileMetaView({
        collection: this.collection,
        parent: this
      });

      this.collection.on('sync', this.sync);
      this.collection.bind('add', this.addOne);
      this.collection.bind('destroy', this.removeOne);

      this.on("selectAll", this.toggleSelectAll);
      this.on("navigate", this.navigate);
      this.on("view", this.view);
    },

    fileSelected: function() {
      this.parent.trigger("file-selected");
    },

    render: function() {
      this.$el.html(this.template());

      return this;
    },

    refresh: function(bucket_name, key) {
      var bucket = this.buckets.get(bucket_name);

      this.bucket = bucket_name;
      var path = key || "";

      if (path.endsWith("/")) {
        this.prefix = path;
      } else {
        // Get the prefix holding this key
        this.prefix = path.slice(0, path.lastIndexOf("/")+1);
      }

      this.collection.setBucket(bucket);
      this.collection.fetch({prefix: this.prefix});

      var breadView = new FileBreadCrumbView({
        prefix: this.prefix,
        parent: this
      });
      breadView.render();

    },

    addOne: function(file) {
      var view = new fileView({model: file, parent: this});
      var idx = this.collection.indexOf(file);

      if (idx === 0) {
        this.$el.find("#providerListView").prepend(view.render().el);
      } else {
        this.$el.find("#providerListView").append(view.render().el);
      }

    },

    removeOne: function(file) {
      this.collection.remove(file);
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
      var selectedFiles = this.collection.where({"StorageClass": "STANDARD"});

      return false;
    },

    deleteFiles: function() {
      var keys = _.filter(this.collection.models, function(model) {
        return model.get("isSelected") === true;
      });

      _.each(keys, function(key) {
        key.destroy({wait: true});
      });
    },

    toggleSelectAll: function(isChecked) {
        this.$el.find(".file-selector input").prop('checked', isChecked).change();
    },

    navigate: function(path, isPrefix) {
      if (path.substring(0, 1) != "/") {
        path = "/" + path;
      }
      this.collection.reset();
      app.router.navigate("bucket/" + this.bucket + path, {trigger: true});
    },

    view: function(path, isPrefix) {
      var key = this.collection.get(path);
      this.metaView.render(key);

      app.router.navigate("bucket/" + this.bucket + "/" + path);
    },

    getCurrentFolder: function() {
      return this.currentFolder;
    },

    getCurrentBucket: function() {
      return this.bucket;
    }
});

var FileBreadCrumbView = Backbone.View.extend({

    el: "#breadcrumb-wrapper",

    template: _.template($('#file-bread-template').html()),
    linkTemplate: _.template($('#file-bread-link-template').html()),

    events: {
      "click li a": "jumpToFolder"
    },

    initialize: function(options) {
      this.parent = options.parent;
      this.prefix = options.prefix;

      _.bindAll(this, 'jumpToFolder', 'render');
    },

    render: function() {
      var crumbs = this.prefix.split("/");
      crumbs.pop();
      var prefixLastSegment = _.last(crumbs);
      this.$el.html(this.template({folder: prefixLastSegment}));

      _.each(crumbs, function(x) {
        this.$el.find('#breadcrumb').append(this.linkTemplate({title: x}));
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
        this.parent.navigate(links.join("/")+"/");
      } else {
        this.parent.navigate("/");
      }

    }
});

var FileMetaView = baseBucketView.extend({

  el: "#providerHelperView",

  template: _.template($('#file-meta-template').html()),

  events: {

  },

  initialize: function(options) {

  },

  render: function(file) {
    var self = this;
    this.$el.html(self.template(file.toJSON()));

    file.fetch({
      "success": function(model) {
        self.$el.html(self.template(model.toJSON()));
      },
      "error": function() {
        self.$el.html(self.template(model.toJSON()));
      }
    });

    return this;
  }
});

var SideBarItemView = baseBucketView.extend({

  el: "<li>",

  template: _.template($('#files-sidebar-bucket-template').html()),

  events: {
    "click a": "changeBucket"
  },

  changeBucket: function(e) {
    e.preventDefault();

    app.router.navigate("bucket/" + this.model.id, {trigger: true});
  },

  render: function() {
    this.$el.html(this.template(this.model.toJSON()));

    return this;
  },

});

var SideBarView = baseBucketView.extend({

  el: "#sidebar",

  template: _.template($('#files-sidebar-template').html()),

  initialize: function(options) {
    _.bindAll(this, 'addOne', 'render', 'removeOne');

    this.collection.bind('sync', this.sync);
    this.collection.bind('add', this.addOne);
    this.collection.bind('destroy', this.removeOne);

    this.collection.fetch();
  },

  render: function() {
    this.$el.html(this.template());
    _.each(this.collection.models, function(bucket){
      var bucketItem = new SideBarItemView({model: bucket});
      this.$el.find("#bucket-list").append(bucketItem.render().el);
    }, this);

    return this;
  },

  refresh: function(bucket) {

  },

  sync: function() {

  },

  addOne: function(model) {
    var bucketItem = new SideBarItemView({model: model});
    this.$el.find("#bucket-list").append(bucketItem.render().el);
  },

  removeOne: function(model) {
    // this.$el.find("a[href=/bucket]/"+model.id).parent().destroy();
  }
});
