;(function(window, $){
  var BigBoyUploader = function(elem, options){
      this.elem = elem;
      this.$elem = $(elem);
      this.options = options;
      this.metadata = this.$elem.data('BigBoyUploader-options');
      this._currentFileInUpload=0;
      this._fileInput = this.elem;
      this._files = this.elem.files;
      this._filesCount = this._files.length;
      this.key = null;

      var reader;

      this._chunker = function(size, step) {
          var pointer = 0,
              end = 0,
              partNumber = 0;

          this.next = function() {
            if (pointer <= size) {
              start = pointer;
              if (size-pointer < step) {
                end = pointer+(size-pointer)
              }else {
                end = pointer+step;
              }
              pointer = pointer+step+1;
              partNumber = partNumber+1;

              return [partNumber, start, end];
            } else {
              throw "End of file";
            }
          }
      };

      this.start = function() {
        if (this._filesCount > 0) {
          this._processNextFile();
        } else {
          // Raise an error
        }
      };

      this._processNextFile = function() {
        if (this._currentFileInUpload == this._filesCount) {
          this.options.onComplete.call(this);
          return;
        }

        var file = this._files[this._currentFileInUpload],
            fileSize = file.size;

        if (fileSize >= 1024*1024*6) {
          this._multiPartUpload(file);
        } else {
          this._formUpload(file);
        }

        this.options.onFileStart.call(this, this._currentFileInUpload);
        this._currentFileInUpload++;
      }

      this._formUpload = function(file) {
        var fileSize = file.size;
        var worker = new Worker('/static/js/formUploadWorker.js?ts='+ new Date().getTime());
        var self = this, initPayload = {"file": file, "urlPath": this.options.urlPath};

        worker.onmessage = function(e) {
          switch (e.data.type) {
            case "key":
              self.key = e.data.data;
              break;
            case "complete":
              self._completeFileUpload(true);
              break;
            case "progress":
              var fileIdx = self._currentFileInUpload - 1;
              self.options.onProgress.call(this, self.key, fileIdx, e.data.data);
              break;
            case "failure":
              console.warn(e.data.data);
              self._completeFileUpload(false);
              break;
            case "debug":
              console.log(e.data)
              break;

          }
        };

        if (this.options.s3_key)
          initPayload.key = this.options.s3_key

        worker.postMessage(initPayload);
      }

      this._multiPartUpload = function(file) {
        var fileSize = file.size,
            fileChunkSize = 1024*1024*5,
            key, upId, fileUploaded=0, workers=[],
            self=this, bucket;
        var initPayload = {'size': fileSize, 'type': file.type, 'name': file.name};
        var chunker2 = new this._chunker(fileSize, fileChunkSize);
        var workerCount = fileSize/fileChunkSize > 4 ? 4: Math.ceil(fileSize/fileChunkSize);

        if (this.options.s3_key)
          initPayload.key = this.options.s3_key

        $.ajax({
          url: this.options.urlPath+"?phase=init",
          type: "POST",
          contentType: "application/json",
          data: JSON.stringify(initPayload),
          processData: false
        }).then(function(data) {
          initWorkers(data);
        });

        var initWorkers = function(data) {
          self.key = data.key;
          upId = data.id;
          bucket = data.bucket;

          for (var i = 0; i < workerCount; i++) {
            var worker = new Worker('/static/js/partUploadWorker.js?ts='+ new Date().getTime());
            worker.onmessage = function(e) {
              switch (e.data.type) {
                case "complete":
                  try {
                    nextChunk = chunker2.next();
                    feedNextChunk(worker, nextChunk);
                  }
                  catch (e) {
                    countWorkers()
                  }
                  break;
                case "progress":
                  fileUploaded = fileUploaded + e.data.data;
                  var percentLoaded = Math.round((fileUploaded / fileSize) * 100);
                  var fileIdx = self._currentFileInUpload - 1;
                  self.options.onProgress.call(self, self.key, fileIdx, percentLoaded);
                  break;
                case "hash":
                  console.log(e.data.data)
                  break;
                case "failure":
                  console.warn(e.data)
                  break;
                case "debug":
                  console.log(e.data)
                  break;
              }
            };

            chunk = chunker2.next();
            feedNextChunk(worker, chunk);
            workers.push(worker);
          }
        };

        var feedNextChunk = function(worker, chunk) {
          var blob = file.slice(chunk[1], chunk[2]+1);
          worker.postMessage({
            'blob': blob,
            'info': [
              chunk[0],
              self.key,
              upId,
              chunk[2]-chunk[1]+1,
              bucket
            ]
          });
        };

        var countWorkers = function() {
          workerCount = workerCount - 1;
          // worker.terminate();
          if (workerCount == 0) {
            finishUpload();
          }
        };

        var finishUpload = function() {
          //TODO: Move start and finish upload to web worker
        $.ajax({
          url: self.options.urlPath+"?phase=complete",
          type: "POST",
          contentType: "application/json",
          data: JSON.stringify({'s3_key': self.key, 'mp_id': upId}),
          processData: false
        }).then(function(data) {
            self._completeFileUpload(true);
          }, function(data) {
            self._completeFileUpload(false);
          });
        };
      }

      this._completeFileUpload = function(success) {
        var fileIdx = this._currentFileInUpload - 1;
        this.options.onFileComplete.call(this, this.key, fileIdx, success);
        this._processNextFile();
      }
    };

  BigBoyUploader.prototype = {
    defaults: {
      message: 'Hello world!',
      urlPath: "/files/upload/",
      onComplete : function() {},
      onProgress: function() {},
      onFileComplete: function() {},
      onFileStart: function() {}
    },

    init: function() {
      this.config = $.extend({}, this.defaults, this.options, this.metadata);
      this.start();

      return this;
    }
  }

  BigBoyUploader.defaults = BigBoyUploader.prototype.defaults;

  $.fn.BigBoyUploader = function(options) {
    return this.each(function() {
      new BigBoyUploader(this, options).init();
    });
  };

  window.BigBoyUploader = BigBoyUploader;

})(window, jQuery);
