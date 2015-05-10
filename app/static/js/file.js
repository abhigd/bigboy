var UploadView = Backbone.View.extend({

    el: '<li class="row">',

    events: {
      "click a.file-link": "showFile",
    },

    template: _.template($('#upload-file-template').html()),

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
      this.$el.find('span').html(progress);
    },

    remove: function() {
      this.$el.remove();
    },

    showFile: function() {
      // app.router.navigate("files/"+this.model.get("id"), {"trigger": true});

      return false;
    },

});

var UploadsView = Backbone.View.extend({

    fileId: 'file-upload',
    template: _.template($('#uploads-template').html()),

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
      var view = new UploadView({model: file});
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
      var prefix = link.id+"/";
      var self = this;
      var currentTargetFile = this.fileTarget;

      _.each(currentTargetFile.files, function(e, i, l) {
        var key = prefix+e.name;
        this.collection.add(
          new UploadFile({
            'key': key,
            'size': e.size,
            'name': e.name,
            'type': e.type,
            'input_id': currentTargetFile.id,
            'file_idx': i,
            'progress': -1,
            'created_at': null
          })
        );
      }, this);

      $(currentTargetFile).BigBoyUploader({
        s3: this.s3,
        bucket: this.bucket,
        prefix: prefix,
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

          if (result === true) {
            self.collection.remove(file);
            file.set("created", new Date().getTime());
            self.app.trigger("upload::file::complete", file);
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

var FileView = Backbone.View.extend({

    el: '<li class="row">',

    events: {
    },

    template: _.template($('#file-template').html()),

    initialize: function() {

      this.listenTo(this.model, 'destroy', this.remove);
    },

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));
      this.$el.prop('id', this.model.get("id"));

      return this;
    },

    remove: function() {
      this.$el.remove();
    }
});

var FilesView = Backbone.View.extend({

    events: {
      "change .file-select input": "fileSelected",
    },

    template: _.template($('#files-template').html()),

    initialize: function(options) {
      this.link = options.link;
      this.app = options.app;

      _.bindAll(this, 'sync', 'addOne', 'removeOne');
      _.bindAll(this, 'previous', 'next', 'render');
      _.bindAll(this, 'detach', 'attach');

      this.collection.bind('sync', this.sync);
      this.collection.bind('add', this.addOne);
      this.collection.bind('remove', this.removeOne);

      this.app.on("upload::all::complete", this.detach);
      this.app.on("upload::begin", this.attach);
    },

    render: function() {
      this.$el.append(this.template());

      this.collection.each(function(model) {
        this.addOne(model);
      }, this);

      return this;
    },

    attach: function(link) {
      console.log("My link id is " + this.link.id);
      if (link.id == this.link.id) {
        console.log("file::Attaching to all upload events");
        this.app.on("upload::file::complete", this.addOne);
      } else {
        console.log("file::Skipping this link event " + link.id);
      }
    },

    detach: function(link) {
      console.log("file::Detaching all events");
      this.app.off("upload::file::complete");
      this.app.off("upload::all::complete");
    },

    addOne: function(file) {
      var view = new FileView({model: file});
      var idx = this.collection.indexOf(file);

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
      // this.fileSelected();
      // app.fileApp.trigger("toggle-selectAll", false);
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

    template: _.template($('#file-template').html()),

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

    initialize: function(options) {
      this.app = options.app;

      this.files = new Files([], {link: this.model});

      _.bindAll(this, 'render');

      this.filesView = new FilesView({
        app: this.app,
        collection: this.files,
        link: this.model,
        el: this.el
      });

    },

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));
      this.filesView.render();
      this.files.fetch();

      return this;
    }
});

var LinksView = Backbone.View.extend({

    events: {
    },

    template: _.template($('#links-template').html()),

    initialize: function(options) {
      this.app = options.app;
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
        this.$(".links-list").prepend(view.render().el);
      } else {
        this.$(".links-list").append(view.render().el);
      }

    },

    removeOne: function(file) {
      var id = file.get("id");
      this.$("#"+id).remove();
    }

});
