var uploadFile = Backbone.Model.extend({

});

var uploadFiles = Backbone.Collection.extend({

    model: uploadFile
});

var uploads = new uploadFiles();
