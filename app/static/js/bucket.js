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

var BucketsView = baseBucketView.extend({

  el: "#bucket-app #bucket-list",

  events: {

  },

  template: _.template($('#bucket-render-buckets').html()),

  initialize: function() {
    _.bindAll(this, 'addOne', 'removeOne');
    // _.bindAll(this, 'addTarget', 'updateStatus', 'updateProgress', 'addSearchTargetLink');

    var buckets = new Buckets();
    buckets.fetch();

    buckets.bind('add', this.addOne);
    // buckets.bind('remove', this.removeOne);
    // this.bind('sync', this.addTargetSync);

  },

  render: function() {
    this.$el.append(this.template({"account_id": "root"}));

    return this;
  },

  addOne: function(model) {
    var bucketItemView = new BucketItemView({model: model});

    this.$el.find("ul").append(bucketItemView.render().el);
  },

  removeOne: function() {

  }
});

var BucketItemView = baseBucketView.extend({

  tagName: 'li',

  events: {
    "click" : "renderBucketRoot"
  },

  initialize: function(options) {

  },

  template: _.template($("#bucket-render-bucket-item").html()),

  render: function() {
    this.$el.html(this.template(this.model.toJSON()));

    return this;
  },

  renderBucketRoot: function() {
    // Render the root directory of a bucket. This view also manages
    // the left and right views of this bucket which the user uses
    // to navigate back and forth in a bucket.

    var v = new BucketWrapperView({model: this.model});
    v.render();
  }

});


var BucketWrapperView = baseBucketView.extend({

  events: {

  },

  initialize: function() {
    this.bucket_name = this.model.get("name");
    var s3 = this.getS3();

    this.leftPaneKeys = new BucketKeys([], {
      bucket: this.bucket_name,
      s3: s3
    });

    this.rightPaneKeys = new BucketKeys([], {
      bucket: this.bucket_name,
      s3: s3
    });

    this.leftPaneView = new BucketKeysView({
      el: "#bucket-app #left-pane",
      collection: this.leftPaneKeys,
    });

    this.rightPaneView = new BucketKeysView({
      el: "#bucket-app #right-pane",
      collection: this.rightPaneKeys,
    });
  },

  render: function() {
    this.leftPaneView.render();
    this.leftPaneKeys.fetch({prefix: "", delimiter: "/"});

    return this;
  }

});

var BucketKeysView = baseBucketView.extend({

  events: {
    "click #more": "renderMore"
  },

  initialize: function(options) {
    _.bindAll(this, 'addOne', 'removeOne', 'render', 'renderMore');

    this.bucket_name = options.bucket_name;
    this.collection.bind('add', this.addOne);
    this.collection.bind('reset', this.addPrefixes);

  },

  template: _.template($("#bucket-render-keys").html()),

  render: function() {
    this.$el.html(this.template());

    return this;
  },

  renderMore: function(e){
    this.collection.fetchNextPage();

    e.preventDefault();
  },

  addOne: function(model) {
    var bucketKeyItemView = new BucketKeyItemView({model: model});

    this.$el.find("ul.bucket-keys-pane").append(bucketKeyItemView.render().el);
  },

  addPrefixes: function() {
    console.log("prefix add");
  },

  removeOne: function(model) {
    console.log("remove key");
  }
});

var BucketKeyItemView = baseBucketView.extend({

  tagName: "li",

  events: {
    "click a": "renderSubKeys",
  },

  template: _.template($("#bucket-render-key-item").html()),

  render: function() {
    this.$el.html(this.template(this.model.toJSON()));

    return this;
  },

  renderSubKeys: function() {

  }
});

var v = new BucketsView();
v.render();
