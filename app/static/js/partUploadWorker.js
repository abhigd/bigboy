importScripts('md5.js');
importScripts('enc-base64-min.js');
importScripts('lib-typedarrays.js');

self.onmessage = function(e) {
  var data = e.data,
      xhr = new XMLHttpRequest(),
      fileReader = new FileReaderSync(),
      chunkUploadedSinceLastEvent=0;

  var file = fileReader.readAsArrayBuffer(data.blob);
  var hash = CryptoJS.MD5( CryptoJS.lib.WordArray.create(file) );
  var b64_hash = hash.toString(CryptoJS.enc.Base64);

  function post(data) {
    self.postMessage(data)
  }

  function uploadPart(creds) {
    var s3Creds = JSON.parse(creds);
    var xhr = new XMLHttpRequest();
    var length = data.blob.length;

    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        var lastUploadedSize = e.loaded - chunkUploadedSinceLastEvent;
        chunkUploadedSinceLastEvent = e.loaded;
        post({"type": "progress", "data": lastUploadedSize});
      }else {
        post({"type": "debug", "data": "onprogress"});
      }
    };
    xhr.onload = function(e) {
      if (this.status < 299) {
        post({"type": "progress", "data": data.info[3]});
        post({"type": "complete", "data": e.data});
      } else {
        post({"type": "failure", "data": this.statusText});
      }
    };
    xhr.onerror = function(e) {
      post({"type": "failure", "data": xhr.statusText});
    };

    xhr.open('PUT', s3Creds.url, true);
    xhr.setRequestHeader("Content-MD5", b64_hash);
    xhr.setRequestHeader("x-amz-date", s3Creds.headers.date);
    xhr.setRequestHeader("Authorization", s3Creds.headers.authorization);

    xhr.send(data.blob);
  }

  var s3Key = data.info[1]
  var partNumber = data.info[0]
  var uploadId = data.info[2]

  xhr.open('GET', "/files/upload/?phase=part"+
    "&s3_key="+data.info[1]+
    "&mp_id="+data.info[2]+
    "&content_length="+data.info[3]+
    "&part_number="+data.info[0]+
    "&content_hash="+b64_hash+
    "&bucket_name="+data.info[4]);
  xhr.setRequestHeader("Accept", "application/json");
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function(e) {
    uploadPart(xhr.response);
  };
  xhr.send();
};
