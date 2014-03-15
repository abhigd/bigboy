var LinkView = Backbone.View.extend({

    events: {
      "click #add-target": "addTarget",
      "change input.file-input": "startFileUpload",
      "click .upload-btn": "showFilePicker",
      "click #link-configure-btn": "toggleConfigure",
      "click #link-search-btn": "showTargetSearch"
    },

    template: _.template($('#link-base-template').html()),

    initialize: function() {
      _.bindAll(this, 'addOne', 'removeOne', 'updateCount', 'addTargetSync');
      _.bindAll(this, 'addTarget', 'updateStatus', 'updateProgress', 'addSearchTargetLink');

      this.targets = new LinkTargets([], {"link": this.model.id});
      this.targets.bind('add', this.addOne);
      this.targets.bind('remove', this.removeOne);
      this.targets.bind('sync', this.addTargetSync);

      this.searchTargets = new LinkSearchTargets([], {
        "link": this.model.id
      });
      this.searchTargets.bind('add', this.addSearchTargetLink);

      this.uploads = new uploadFiles;
      var uploader = new uploadView({
        collection: this.uploads,
        parent: this,
        uploadUrlPath: "/link/"+this.model.id+"/upload/"
      });
      this.uploader = uploader;

      this.listenTo(this.uploads, "change:uploadStatus", this.updateStatus);
      this.listenTo(this.uploads, "change:progress", this.updateProgress);
      this.listenTo(this.uploads, "add", this.updateCount);
      this.listenTo(this.uploads, "remove", this.updateCount);

      var configureView = new LinkConfigureView({
        model: this.model,
      });
      this.configureView = configureView;

      this.on("undo", function(target) {
        this.targets.create({"target_id": target.id}, {wait: true});
        // alert("Triggered " + target.id);
      }, this);

    },

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));

      var targets = this.model.get('targets');
      this.targets.set(targets);

      this.uploader.render();
      this.$el.find('#link-configure').append(this.configureView.render().el);

      if (this.model.get("expired")) {
        var pager = new LinkMessageView({
          model: this.model,
          parent: this,
          msgTemplate: _.template("This link has expired."),
          msgType: "warning"
        });
        this.$el.find('#link-messages').html(pager.render().el);
        this.$el.find("#link-configure").show();
      }

      return this;
    },

    addTarget: function() {
      var target = this.$('#add-target-text').val();
      this.targets.create({"target_id": target}, {wait: true});
    },

    addTargetSync: function(target) {
      var pager = new LinkMessageView({
        model: target,
        parent: this,
        msgTemplate: _.template("<%= title %> has been added.")
      });
      this.$el.find('#link-messages').html(pager.render().el);
    },

    addOne: function(target) {
      var linkTargetView = new LinkTargetView({model: target});
      this.$el.find('#link-targets').prepend(linkTargetView.render().el);
    },

    removeOne: function(target) {
      var pager = new LinkMessageView({
        model: target,
        parent: this,
        undo: true,
        msgTemplate: _.template("<%= title %> has been removed.")
      });
      this.$el.find('#link-messages').html(pager.render().el);
      this.searchTargets.fetch();
    },

    showFilePicker: function(e) {
      // TODO: Check if there is a pending upload
      this.uploader.showFilePicker();
    },

    updateStatus: function(file) {
      var result = file.get('uploadStatus');

      if (result == 1) {
        this.uploads.remove(file);
        files.create(file.attributes, {wait: true});
        var target = file.get("key");
        this.targets.create({"target_id": target}, {wait: true});
      }
    },

    updateProgress: function(file) {
      var progress = file.get("progress");
      this.$el.find(".upload-indicator .progress .progress-bar").css({"width": progress+"%"})
    },

    updateCount: function(file) {
      var count = this.uploads.length;
      this.$el.find(".upload-indicator .count").html(count);
    },

    onClose: function() {
      this.uploader.close();
    },

    toggleConfigure: function() {
      this.$el.find("#link-configure").toggle();
    },

    showTargetSearch: function() {
      this.$el.find('#link-search-targets').toggle();
      this.searchTargets.fetch();
    },

    addSearchTargetLink: function(target) {
      var linkSearchTargetView = new LinkSearchTargetView({
        model: target,
        parent: this
      });

      this.$el.find('#link-search-targets').prepend(
        linkSearchTargetView.render().el
      );
    }

});

var LinkTargetView = Backbone.View.extend({

  events: {
      "click .target-delete": "deleteTarget",
      "click .target-approve": "approveTarget",
  },

  tagName: 'li',

  template: _.template($('#link-target-template').html()),

  initialize: function() {
    _.bindAll(this, 'deleteTarget', 'render', 'removeTarget', 'approveTarget');
    this.model.bind('change', this.render);
    this.model.bind('destroy', this.removeTarget);
  },

  removeTarget: function() {
    this.$el.remove();
  },

  deleteTarget: function() {
    this.model.destroy({wait: true});
  },

  approveTarget: function() {
    this.model.save([{approved: true}], {wait: true});

    return false;
  },

  render: function() {
    this.$el.html(this.template(this.model.toJSON()));

    return this;
  }
});

var LinkSearchTargetView = Backbone.View.extend({
  events: {
    "click a.list-group-item": "addTarget"
  },

  initialize: function(options) {
    _.bindAll(this, 'removeTarget', 'addTarget', 'removeSearchTarget');
    this.parent = options.parent;
    this.model.bind('remove', this.removeTarget);
    this.parent.targets.bind("add", this.removeSearchTarget);
  },

  removeTarget: function(target) {
    this.$el.remove();
  },

  removeSearchTarget: function(target) {
    this.parent.searchTargets.remove(target);
  },

  template: _.template($('#link-search-target-template').html()),

  render: function() {
    this.$el.html(this.template(this.model.toJSON()));

    return this;
  },

  addTarget: function(e) {
    var target = this.model.id;
    this.parent.targets.create({"target_id": target}, {wait: true});

    e.preventDefault();
  }
});

var LinksView = Backbone.View.extend({
  template: _.template($('#links-base-template').html()),

  render: function() {
    this.$el.html(this.template());

    return this;
  }
});

var LinkMessageView = Backbone.View.extend({
  template: _.template($('#link-message-template').html()),

  events: {
    "click .link-undo": "undo",
    "click .link-close": "close"
  },

  initialize: function(options) {
    this.parent = options.parent;
    this.msgTemplate = options.msgTemplate;
    this.showUndo = options.undo || false;
    this.msgType = options.msgType || "info"

    // var self = this;
    // setTimeout(function() {
    //   self.close();
    // }, 3000)
  },

  render: function() {
    var message = this.msgTemplate(this.model.toJSON());
    this.$el.html(this.template({
      "message": message,
      "undo": this.showUndo,
      "type": this.msgType
    }));

    return this;
  },

  undo: function() {
    this.parent.trigger('undo', this.model);
  }
});

var LinkConfigureView = Backbone.View.extend({
  reExpiresIn: /(\d+)(d|m|h)/i,
  reMaxUploadSize: /(\d+)(k|m|g)/i,

  template: _.template($('#link-configure-template').html()),

  events: {
    "click #toggle-sharing": "toggleSharing",
    "click #toggle-downloads": "toggleDownloads",
    "click #toggle-uploads": "toggleUploads",
    "change #expiry": "setExpiry",
    "change #max_upload_size": "setMaxUploadSize",
    "change #max_uploads": "setMaxUploads",
    "change #max_target_downloads": "setTargetDownloads"
  },

  initialize: function() {
    _.bindAll(this, 'render', 'saveLink', 'toggleSharing');
    this.model.bind('change', this.render);
  },

  render: function() {
    this.$el.html(this.template(this.model.toJSON()));

    return this;
  },

  toggleDownloads: function(e) {
    var downloads_enabled = this.model.get("allow_downloads");

    this.$el.find("input[name=allow_downloads]").val(!downloads_enabled);
    this.saveLink(e);
  },

  toggleUploads: function(e) {
    var uploads_enabled = this.model.get("allow_uploads");

    this.$el.find("input[name=allow_uploads]").val(!uploads_enabled);
    this.saveLink(e);
  },

  toggleSharing: function(e) {
    var expires_in = this.model.get("expires_in");
    var now = new Date().getTime()/1000;

    if (expires_in > now) {
      // Link has not expired, so expire it.
      this.$el.find( "input[name=expires_in]" ).val(parseInt(now));
    } else {
      // Extend by one hour
      var expiresIn = parseInt(new Date((now + 3600)*1000).getTime()/1000);
      this.$el.find( "input[name=expires_in]" ).val(expiresIn);
    }

    this.saveLink(e);
  },

  saveLink: function(e) {
    _.each(this.$el.find("input[type=hidden]"), function(e, index) {
      if (this.model.get(e.name) != e.value) {
        this.model.set(e.name, e.value)
      }
    }, this);

    this.model.save([], {wait: true});
    e.preventDefault();
  },

  setExpiry: function(e) {
    var input = e.currentTarget.value;
    if (this.reExpiresIn.test(input)) {
      var matches = input.match(this.reExpiresIn);
      var count = matches[1];
      var discriminator = matches[2].toLowerCase();
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
      var expiresInHelp = new Date((now + delta)*1000).toLocaleString();
      this.$el.find( "input[name=expires_in]" ).val(parseInt(expiresIn));

      this.saveLink(e);
    }
  },

  setTargetDownloads: function(e) {
    var input = e.currentTarget.value;

    this.$el.find( "input[name=max_target_downloads]" ).val(input);
    this.saveLink(e);
  },

  setMaxUploads: function(e) {
    var input = e.currentTarget.value;

    this.$el.find( "input[name=max_uploads]" ).val(input);
    this.saveLink(e);
  },

  setMaxUploadSize: function(e) {
    var input = e.currentTarget.value;

    if (this.reMaxUploadSize.test(input)) {
      var matches = input.match(this.reMaxUploadSize);
      var count = matches[1];
      var discriminator = matches[2].toLowerCase();

      switch (discriminator) {
        case "k":
          var multiplier = 1024;
          break;
        case "m":
          var multiplier = 1024*1024;
          break;
        case "g":
          var multiplier = 1024*1024*1024;
          break;
      }

      var size = parseInt(count)*multiplier;
      this.$el.find( "input[name=max_upload_size]" ).val(size);
      this.saveLink(e);
     }
  }
});
