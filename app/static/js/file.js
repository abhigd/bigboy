// var UploadView = Backbone.View.extend({

//   el: "<input type='file' class='file-input' multiple/>",

//   events: {
//     "change": "startFileUpload"
//   },

//   initialize: function(options) {
//     this.parent = options.parent;
//     this.fileId = "file-input-"+new Date().getTime();
//     this.uploadUrlPath = options.uploadUrlPath || "/files/upload/";
//   },

//   render: function() {
//     this.$el.attr("id", this.fileId);
//     $(this.$el).appendTo('body');
//   },

//   showFilePicker: function() {
//     this.$el.trigger("click");
//   },

//   startFileUpload: function(e) {
//     var self = this;
//     console.log(new Date().getTime());
//     var currentTargetFile = e.currentTarget;

//     _.each(currentTargetFile.files, function(e, i, l) {
//       this.collection.add(
//         new uploadFile({
//           'size': e.size,
//           'title': e.name,
//           'type': e.type,
//           'input_id': currentTargetFile.id,
//           'file_idx': i,
//           'progress': -1
//         })
//       );
//     }, this);

//     $(currentTargetFile).BigBoyUploader({
//       urlPath: this.uploadUrlPath,
//       onComplete: function() {
//         console.log("All files completed");
//         self.parent.trigger('upload-complete', self);
//       },
//       onFileStart: function(fileIdx) {
//         var file = self.collection.findWhere({'input_id': self.fileId, 'file_idx': fileIdx});
//         file.set({uploadStatus: -1, progress:0});
//       },
//       onFileComplete: function(key, fileIdx, result) {
//         var file = self.collection.findWhere({'input_id': self.fileId, 'file_idx': fileIdx});
//         var uploadStatus = result == true?1:0;
//         file.set({progress: 100, key: key, uploadStatus: uploadStatus});

//         console.log("File Completed " + key + " fileIdx " + fileIdx +
//           " status " + result);
//       },
//       onProgress: function(key, fileIdx, progressPercent) {
//         var file = self.collection.findWhere({'input_id': self.fileId, 'file_idx': fileIdx});
//         file.set({progress: progressPercent});
//       }
//     });
//   }
// });

var FileView = Backbone.View.extend({

    el: '<li class="row">',

    events: {
      "click a.file-link": "showFile",
    },

    template: _.template($('#file-template').html()),

    initialize: function() {
      _.bindAll(this, 'showFile', 'renderProgress');

      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this.model, 'change:progress', this.renderProgress);
      // this.listenTo(this.model, 'change:uploadStatus', this.renderUploadStatus);
    },

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));
      this.$el.prop('id', this.model.get("id"));

      return this;
    },

    renderProgress: function(file, progress) {
      // console.log(file);
      this.$el.find('span').html(progress);
    },

    remove: function() {
      this.$el.remove();
    },

    showFile: function() {
      app.router.navigate("files/"+this.model.get("id"), {"trigger": true});

      return false;
    },

});

var UploadsView = Backbone.View.extend({

    fileId: 'file-upload',
    template: _.template($('#uploads-base-template').html()),

    events: {
      "change input.file-input": "initUpload",
      "click .file-input-wrapper": "showFilePicker"
    },

    initialize: function(options) {

      this.app = options.app;
      _.bindAll(this, 'initUpload', 'startUpload', 'showFilePicker');

      this.listenTo(this.collection, "add", this.addOne);
      this.listenTo(this.collection, "remove", this.removeOne);
      // this.listenTo(this.collection, "change:uploadStatus", this.updateStatus);
      // this.listenTo(this.collection, "change:progress", this.updateProgress);

      this.app.on('upload::begin', this.startUpload);
      var region = bucket_details["region"];

      this.s3 = new AWS.S3({
            accessKeyId: root_creds["access_key"],
            secretAccessKey: root_creds["secret_key"],
            sessionToken: root_creds["session_token"],
            region: region
      });
      this.bucket = bucket_details["name"];
      this.prefix = "";
    },

    render: function() {
      this.$el.append(this.template());

      this.collection.each(function(model) {
        this.addOne(model);
      }, this);

      return this;
    },

    addOne: function(file) {
      var view = new FileView({model: file});
      this.$(".upload-file-list").append(view.render().el);
    },

    removeOne: function(file) {
      file.destroy();
    },

    showFilePicker: function() {
      this.$el.find('input.file-input').trigger("click");
    },

    initUpload: function(e) {
      this.fileTarget = e.currentTarget;
      this.app.trigger('upload::init', this);
    },

    startUpload: function(link) {
      var self = this;
      var currentTargetFile = this.fileTarget;

      _.each(currentTargetFile.files, function(e, i, l) {
        this.collection.add(
          new UploadFile({
            'size': e.size,
            'name': e.name,
            'type': e.type,
            'input_id': currentTargetFile.id,
            'file_idx': i,
            'progress': -1,
            'created': null
          })
        );
      }, this);

      $(currentTargetFile).BigBoyUploader({
        s3: this.s3,
        bucket: this.bucket,
        prefix: link.id,
        onComplete: function() {
          console.log("All files completed");
          self.app.trigger('upload::all::complete', self);
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
          if (result === true) {
            self.collection.remove(file);
            file.set("created", new Date().getTime());
            self.app.trigger("upload::file::complete", file);
            // self.collection.add(file, {at:0});
          }
        },
        onProgress: function(key, fileIdx, progressPercent) {
          var file = self.collection.findWhere({'input_id': self.fileId, 'file_idx': fileIdx});
          file.set({progress: progressPercent});
        }
      });
    },

    onClose: function() {
      _.each(this.uploaders, function(uploader) {
        uploader.close();
      });
    }

});

var FilesView = Backbone.View.extend({

    events: {
      "change .file-select input": "fileSelected",
    },

    template: _.template($('#files-base-template').html()),

    initialize: function() {
      _.bindAll(this, 'sync', 'addOne', 'removeOne');
      _.bindAll(this, 'previous', 'next', 'render');

      this.collection.bind('sync', this.sync);
      this.collection.bind('add', this.addOne);
      this.collection.bind('remove', this.removeOne);

      this.on("selectAll", this.toggleSelectAll);
    },

    render: function() {
      this.$el.append(this.template());

      this.collection.each(function(model) {
        this.addOne(model);
      }, this);

      return this;
    },

    addOne: function(file) {
      var view = new FileView({model: file});
      var idx = this.collection.indexOf(file);
      console.log("Hello");

      if (idx === 0) {
        this.$(".file-list").prepend(view.render().el);
      } else {
        this.$(".file-list").append(view.render().el);
      }

    },

    removeOne: function(file) {
      var id = file.get("id");
      this.$("#"+id).remove();
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
      this.collection.nextPage();

      return false;
    },

});

var FileInfoView = Backbone.View.extend({

    reCreateLink: /(\d+)(d|m|h)/i,

    events: {
    },

    template: _.template($('#file-base-template').html()),

    initialize: function() {
      _.bindAll(this, 'render');

    },

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));

      return this;
    }
});

var LinkView = Backbone.View.extend({

    el: '<li class="row">',

    events: {
    },

    template: _.template($('#link-template').html()),

    initialize: function() {
      _.bindAll(this, 'render');
      var files = new Files();

      var filesView = new FilesView({
        app: this,
        collection: files,
        links: this.links,
        el: linkView.el
      });

      filesView.render();
    },

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));

      return this;
    }
});

var LinksView = Backbone.View.extend({

    events: {
    },

    template: _.template($('#links-template').html()),

    initialize: function() {
      _.bindAll(this, 'render', 'addOne', 'removeOne');

      // this.collection.bind('sync', this.sync);
      this.collection.bind('add', this.addOne);
      this.collection.bind('remove', this.removeOne);
    },

    render: function() {
      this.$el.append(this.template());

      this.collection.each(function(model) {
        this.addOne(model);
      }, this);

      return this;
    },

    addOne: function(link) {
      var view = new LinkView({model: link, app: this.app});
      var idx = this.collection.indexOf(link);

      if (idx === 0) {
        this.$(".file-list").prepend(view.render().el);
      } else {
        this.$(".file-list").append(view.render().el);
      }

    },

    removeOne: function(file) {
      var id = file.get("id");
      this.$("#"+id).remove();
    }

