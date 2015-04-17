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
      this.s3 = null;
      this.debug = false;

      var reader;

      this._chunker = function(size, step) {
          var pointer = 0,
              end = 0,
              partNumber = 0;

          this.next = function() {
            if (pointer <= size) {
              start = pointer;
              if (size-pointer < step) {
                end = pointer+(size-pointer);
              }else {
                end = pointer+step;
              }
              pointer = pointer+step+1;
              partNumber = partNumber+1;

              return [partNumber, start, end];
            } else {
              throw "End of file";
            }
          };
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

        if (fileSize >= 1024*1024*5) {
          this._multiPartUpload(file);
        } else {
          this._upload(file);
        }

        this.options.onFileStart.call(this, this._currentFileInUpload);
        this._currentFileInUpload++;
      };

      this._upload = function(file) {
        var fileSize = file.size;
        var worker = new Worker('/static/js/partUploadWorker.js?ts='+ new Date().getTime());
        var self = this;

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
              // console.warn(e.data.data);
              self._completeFileUpload(false, e.data.data);
              break;
            case "debug":
              if (self.debug)
                console.log(e.data);
              break;
          }
        };

        var bucket = this.options.bucket;
        var key = this.options.prefix + file.name;

        var params = {
          Bucket: bucket,
          Key: key,
          ContentType: file.type,
          ServerSideEncryption: 'AES256',
          StorageClass: 'REDUCED_REDUNDANCY'
        };
        var req = self.options.s3.uploadPart(params);

        req.httpRequest.path = "/" + encodeURIComponent(key);
        req.httpRequest.virtualHostedBucket = bucket;
        req.httpRequest.method = "PUT";
        req.httpRequest.headers["Content-Length"] = file.size;
        req.httpRequest.headers["Content-Type"] = file.type;
        req.service.config.getCredentials(function (err, credentials) {
          var date = AWS.util.date.getDate();
          var signer = new AWS.Signers.S3(req.httpRequest);
          var url_part = encodeURIComponent(key);
          var url = "https://"+ bucket +
            ".s3.amazonaws.com/" + url_part;

          signer.addAuthorization(credentials, date);
          worker.postMessage({
            'blob': file,
            'size': file.size,
            'url': url,
            'headers': req.httpRequest.headers
          });
        });
      };

      this._multiPartUpload = function(file) {
        var fileSize = file.size,
            fileChunkSize = 1024*1024*5,
            workers=[], self=this;

        // var initPayload = {'size': fileSize, 'type': file.type, 'name': file.name};
        var chunker2 = new this._chunker(fileSize, fileChunkSize);
        var workerCount = fileSize/fileChunkSize > 4 ? 4: Math.ceil(fileSize/fileChunkSize);

        if (this.options.s3_key)
          initPayload.key = this.options.s3_key;

        var bucket = this.options.bucket;
        var key = this.options.prefix + file.name;

        var params = {
          Bucket: bucket,
          Key: key,
          ContentType: file.type,
          ServerSideEncryption: 'AES256',
          StorageClass: 'REDUCED_REDUNDANCY'
        };

        var req = this.options.s3.createMultipartUpload(params);
        req.send(function(err, data) {
          if (err) console.log(err, err.stack); // an error occurred
          else {
            initWorkers(data);
          }
        });

        var initWorkers = function(data) {
          var key = data.Key;
          var uploadId = data.UploadId;
          var bucket = data.Bucket;
          var fileUploaded = 0;

          for (var i = 0; i < workerCount; i++) {
            var worker = new Worker('/static/js/partUploadWorker.js?ts='+ new Date().getTime());
            worker.onmessage = function(e) {
              switch (e.data.type) {
                case "complete":
                  try {
                    nextChunk = chunker2.next();
                    feedNextChunk(worker, bucket, key, uploadId, nextChunk);
                  }
                  catch (e) {
                    countWorkers(bucket, key, uploadId);
                  }
                  break;
                case "progress":
                  fileUploaded = fileUploaded + e.data.data;
                  var percentLoaded = Math.round((fileUploaded / fileSize) * 100);
                  var fileIdx = self._currentFileInUpload - 1;
                  self.options.onProgress.call(self, self.key, fileIdx, percentLoaded);
                  break;
                case "hash":
                  console.log(e.data.data);
                  break;
                case "failure":
                  console.warn(e.data);
                  break;
                case "debug":
                  if (self.debug)
                    console.log(e.data);
                  break;
              }
            };

            chunk = chunker2.next();
            feedNextChunk(worker, bucket, key, uploadId, chunk);
            workers.push(worker);
          }
        };

        var feedNextChunk = function(worker, bucket, key, uploadId, chunk) {
          var params = {
            Bucket: bucket,
            Key: key,
            PartNumber: chunk[0],
            UploadId: uploadId,
          };
          var blob = file.slice(chunk[1], chunk[2]+1);

          var req = self.options.s3.uploadPart(params);
          req.httpRequest.path = "/" + encodeURIComponent(key) +
            "?partNumber=" + chunk[0] + "&uploadId=" + uploadId;

          req.httpRequest.virtualHostedBucket = bucket;
          req.httpRequest.method = "PUT";
          req.httpRequest.headers["Content-Length"] = chunk[2]-chunk[1]+1;
          req.httpRequest.headers["Content-Type"] = file.type;

          req.service.config.getCredentials(function (err, credentials) {
            var date = AWS.util.date.getDate();
            var signer = new AWS.Signers.S3(req.httpRequest);
            var url_part = encodeURIComponent(key) + "?partNumber=" + chunk[0] +
              "&uploadId=" + uploadId;
            var url = "https://"+ bucket +
              ".s3.amazonaws.com/" + url_part;

            signer.addAuthorization(credentials, date);
            worker.postMessage({
              'blob': file,
              'size': file.size,
              'url': url,
              'headers': req.httpRequest.headers
            });
          });
        };

        var countWorkers = function(bucket, key, uploadId) {
          workerCount = workerCount - 1;
          // worker.terminate();
          if (workerCount === 0) {
            finishUpload(bucket, key, uploadId);
          }
        };

        var finishUpload = function(bucket, key, uploadId) {
          var params = {
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
          };
          self.options.s3.listParts(params, function(err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else {
              var uploadedParts = data.Parts;
              var parts = [];
              uploadedParts.forEach(function(e){
                parts.push({
                  "ETag": e.ETag,
                  "PartNumber": e.PartNumber
                });
              });

              var params = {
                Bucket: data.Bucket,
                Key: data.Key,
                UploadId: data.UploadId,
                MultipartUpload: {
                  Parts: parts
                }
              };
              self.options.s3.completeMultipartUpload(params, function(err, data) {
                if (err) {
                  self._completeFileUpload(false);
                  console.error(err, err.stack); // an error occurred
                }
                else {
                  console.info(data);
                  self._completeFileUpload(true);
                }
              });
            }
          });
          //TODO: Move start and finish upload to web worker
        };
      };

      this._completeFileUpload = function(success) {
        var fileIdx = this._currentFileInUpload - 1;
        this.options.onFileComplete.call(this, this.key, fileIdx, success);
        this._processNextFile();
      };
    };

  BigBoyUploader.prototype = {
    defaults: {
      message: 'Hello world!',
      urlPath: "/files/upload/",
      prefix: "",
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
  };

  BigBoyUploader.defaults = BigBoyUploader.prototype.defaults;

  $.fn.BigBoyUploader = function(options) {
    return this.each(function() {
      new BigBoyUploader(this, options).init();
    });
  };

  window.BigBoyUploader = BigBoyUploader;

})(window, jQuery);
