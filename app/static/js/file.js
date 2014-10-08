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
    console.log(new Date().getTime());
    var currentTargetFile = e.currentTarget;

    _.each(currentTargetFile.files, function(e, i, l) {
      this.collection.add(
        new uploadFile({
          'size': e.size,
          'title': e.name,
          'type': e.type,
          'input_id': currentTargetFile.id,
          'file_idx': i,
          'progress': -1
        })
      );
    }, this);

    $(currentTargetFile).BigBoyUploader({
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
      if (this.model.get("source")) {
        this.$el.html(this.fileTemplate(this.model.toJSON()));
        this.renderFileMeta();
      } else {
        this.$el.html(this.uploadTemplate(this.model.toJSON()));
      }
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
      // app.router.navigate("files/"+this.model.get("id"), {"trigger": true});
      if (this.model.get("type") == "folder") {
        this.parent.trigger("navigate", this.model.get("id"));
      }else{
        //Let the app router handle it
      }

      e.preventDefault();
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

var uploaderView = Backbone.View.extend({

    collection: uploads,

    uploaders: [],

    events: {
      // "change input.file-input": "startFileUpload"
    },

    template: _.template('<div class="upload-file-list container-fluid"></div>'),

    initialize: function() {

      _.bindAll(this, 'showFilePicker', 'updateStatus', 'updateProgress');
      _.bindAll(this, 'uploadComplete');

      this.listenTo(this.collection, "add", this.addOne);
      this.listenTo(this.collection, "remove", this.removeOne);
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

      if (result == 1) {
        files.create(file.attributes, {wait: true});
        this.collection.remove(file);
      }
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
      var uploader = new uploadView({collection: uploads, parent: this});
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

    initialize: function() {
      _.bindAll(this, 'sync', 'addOne', 'deleteFiles');
      _.bindAll(this, 'previous', 'next', 'fileSelected', 'render');
      _.bindAll(this, 'toggleSelectAll', 'navigate');

      this.bucket_name = "meer-sg-1";
      var s3 = this.getS3();
      this.collection = new BucketKeys([], {
        bucket: this.bucket_name,
        s3: s3
      });

      this.collection.bind('sync', this.sync);
      this.collection.bind('add', this.addOne);
      // this.collection.bind('reset', this.reset);

      this.on("selectAll", this.toggleSelectAll);
      this.on("navigate", this.navigate);
      this.collection.fetch({prefix: this.currentFolder});
    },

    render: function() {
      this.$el.addClass('file-list container-fluid');
      var breadView = new FileBreadCrumbView({
        collection: this.collection
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
      var now = new Date().getTime()/1000;
      var expiresIn = new Date((now + 3600)*1000).getTime()/1000;
      var selectedFiles = this.$('.el-icon-check input');
      var targets = [];

      _.each(selectedFiles, function(elem) {
          var id = this.$(elem).data("id");
          targets.push(id);
      }, this);

      var link = new Link({
        "target": targets.join(),
        "expires_in": expiresIn
      });

      link.save({}, {success: function(model){
        var linkId = model.id;
        app.router.navigate("link/"+linkId, {"trigger": true});
      }, wait: true});

      //   this.links.create({
      //     "target": target,
      //     "expires_in": expiresIn
      //   }, {wait: true});

      //     var f = files.get(id);
      //     f.destroy({wait: true});
      //     files.remove(f);
      //     app.fileApp.trigger("toggle-selectAll", false);
      // files.fetch();
    },

    toggleSelectAll: function(isChecked) {
        this.$el.find(".file-selector input").prop('checked', isChecked).change();
    },

    navigate: function(path) {
      this.collection.fetch({prefix: path, reset: true});
    }
});

var FileBreadCrumbView = Backbone.View.extend({

    el: "#actionbar-breadcrumb",

    template: _.template($('#file-bread-template').html()),
    linkTemplate: _.template($('#file-bread-link-template').html()),

    events: {
      "click li a": "jumpToFolder",
    },

    initialize: function() {
      _.bindAll(this, 'jumpToFolder', 'render');

      this.listenTo(this.collection, 'reset', this.render);
    },

    render: function() {
      var crumbs = this.collection.currentPrefix.split("/");
      this.$el.html(this.template());

      _.each(crumbs, function(x) {
        this.$el.find('.breadcrumb').append(this.linkTemplate({title: x}));
      }, this);

    },

    jumpToFolder: function(e) {
      var id = $(e.currentTarget).attr("id");
      var crumbs = $(e.currentTarget).parent().prevAll();
      var links = [id];

      _.each(crumbs, function(x) {
        links.unshift($(x).find("a").attr("id"));
      });

      console.log(links.join("/")+"/");
      this.collection.fetch({prefix: links.join("/")+"/", reset: true});
    }
});

var FileInfoView = Backbone.View.extend({

    reCreateLink: /(\d+)(d|m|h)/i,

    events: {
      "click #tab-tools": "switchTab",
      "click #tab-versions": "switchTab",
      "click #tab-about": "switchTab",
      "click #create-share-link-button": "createShareLink",
      "click #delete-shares-button": "deleteShares"
    },

    // versionsTemplate: $('#file-info-versions-template').html(),
    // usageTemplate: _.template($('#file-info-usage-template').html()),
    template: _.template($('#file-base-template').html()),

    initialize: function() {
      _.bindAll(this, 'render', 'renderVersionsTab');
      _.bindAll(this, 'renderAboutTab', 'toggleDeleteButton');

      this.links = this.model.links();

      this.on("toggle-delete", this.toggleDeleteButton);
    },

    hide: function() {
      this.$el.hide();
    },

    show: function() {
      this.$el.show();
    },

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));

      this.renderAboutTab();
      this.renderVersionsTab();
      this.renderUsageTab();

      return this;
    },

    renderAboutTab: function() {
      var aboutTab = new fileInfoAboutTabView({
        model: this.model,
        collection: this.links,
        parent: this
      });
      this.$el.find("#tab-about-pane").html(aboutTab.render().el);
    },

    renderVersionsTab: function() {
      // var versionsTab  = new fileVersionsTabView({collection: this.model});
      // this.$el.find("#tab-versions-pane").append(versionsTab.render().el);
    },

    renderToolsTab: function() {

    },

    renderUsageTab: function() {
      // this.$el.find("#tab-usage-pane").html(this.usageTemplate(this.model.toJSON()));
    },

    switchTab: function(e) {
      var id = $(e.currentTarget).attr("id");

      switch (id) {
          case "tab-versions":
            this.model.versions().fetch();
            break;
      }
    },

    createShareLink: function() {
      var input = this.$el.find("#create-share-link-input").val();

      if (this.reCreateLink.test(input)) {
        var matches = input.match(this.reCreateLink);
        var count = matches[1];
        var discriminator = matches[2];
        var now = new Date().getTime()/1000;

        switch (discriminator) {
          case "d":
            var delta = count*86400;
            break;
          case "m":
            var delta = count*60;
            break;
          case "h":
            var delta = count*3600;
            break;
        }
        var expiresIn = new Date((now + delta)*1000).getTime()/1000;
        var target = this.model.id;
        this.links.create({
          "target": target,
          "expires_in": expiresIn
        }, {wait: true});
      }
    },

    toggleDeleteButton: function(enableButton) {
      if (enableButton) {
        this.$el.find("#delete-shares-button").removeClass("disabled");
      } else {
        this.$el.find("#delete-shares-button").addClass("disabled");
      }
    },

    deleteShares: function() {
      var selected = this.$('.el-icon-check input');

      _.each(selected, function(elem) {
        var model = this.links.get(this.$(elem).data("id"));

        var target = this.model.id;
        model.destroy({"target": target, wait: true});
        // this.links.remove(model);
      }, this);

      this.links.fetch();
    }
});

var fileInfoAboutTabView = FileInfoView.extend({

    reCreateLink: /(\d+)(d|m|h)/i,

    events: {
      "change .file-share-select input": "toggleDeleteButton",
    },

    template: _.template($('#file-info-about-template').html()),

    initialize: function(options) {
      _.bindAll(this, 'render', 'deleteShares');
      _.bindAll(this, 'addShareLink', 'removeShareLink');
      _.bindAll(this, 'renderShareLinksCount');

      this.collection.bind('add', this.addShareLink);
      this.collection.bind('remove', this.removeShareLink);
      this.collection.bind('sync', this.renderShareLinksCount);

      this.parent = options.parent;
    },

    render: function() {
      // $('#tab-about-pane').html(this.template(this.model.toJSON()))
      this.$el.html(this.template(this.model.toJSON()));
      // this.links = this.model.links();
      var self = this;

      var ownerView = new UserInlineView({
        "target": this.$el.find("#file-owner"),
        "userId": this.model.get("owner")
      });

      return this;
    },

    renderShareLinks: function() {

    },

    addShareLink: function(link) {
      var view = new FileLinkView({model: link});
      this.$el.find("#file-share-links").append(view.render().el);
      this.$el.find("#file-links-count").html(this.collection.length);
    },

    removeShareLink: function() {
      this.$el.find("#file-links-count").html(this.collection.length);
    },

    renderShareLinksCount: function() {
      this.$el.find("#file-links-count").html(this.collection.length);
      this.toggleDeleteButton();
    },

    toggleDeleteButton : function() {
      if (this.$el.find('.el-icon-check').length > 0) {
        this.parent.trigger('toggle-delete', true);
        // this.$el.find("#delete-shares-button").removeClass("disabled");
      } else {
        this.parent.trigger('toggle-delete', false);
        // this.constructor.trigger('toggle-delete', false);
        // this.$el.find("#delete-shares-button").addClass("disabled");
      }
    }

});

var FileLinkView = Backbone.View.extend({

    tagName: "li",

    events: {
      "click .file-share-select": "toggleFileSelectCheckBox",
      "click .file-share-link-help a": "showLinkView"
    },

    template: _.template($('#file-share-link-template').html()),

    initialize: function(options) {
      _.bindAll(this, 'render', 'toggleFileSelectCheckBox', 'remove');
      this.listenTo(this.model, 'destroy', this.remove);
    },

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));

      return this;
    },

    showLinkView: function() {
      app.router.navigate("link/"+this.model.get("id"), {"trigger": true});

      return false;
    },

    remove: function() {
      this.$el.remove();
    },

    toggleFileSelectCheckBox: function() {
      var isChecked = this.$el.find('.file-share-select input')[0].checked;

      if (!isChecked) {
        this.$el.find(".file-share-select").addClass("el-icon-check").removeClass("el-icon-check-empty");
      } else {
        this.$el.find(".file-share-select").addClass("el-icon-check-empty").removeClass("el-icon-check");
      }

      this.$el.find('.file-share-select input').prop('checked', !(isChecked)).change();
    }

});


