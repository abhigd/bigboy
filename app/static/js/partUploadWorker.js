self.onmessage = function(e) {
  var data = e.data;

  function post(data) {
    self.postMessage(data);
  }

  function uploadPart(blob, length, url, headers) {
    var xhr = new XMLHttpRequest(),
    chunkUploadedSinceLastEvent=0;

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
        post({"type": "progress", "data": length});
        post({"type": "complete", "data": e.data});
      } else {
        post({"type": "failure", "data": this.statusText});
      }
    };
    xhr.onerror = function(e) {
      post({"type": "failure", "data": xhr.statusText});
    };

    xhr.open('PUT', url, true);
    xhr.setRequestHeader("Content-Type", headers["Content-Type"]);
    xhr.setRequestHeader("x-amz-date", headers["X-Amz-Date"]);
    xhr.setRequestHeader("Authorization", headers["Authorization"]);
    xhr.setRequestHeader("x-amz-security-token", headers["x-amz-security-token"]);
    xhr.setRequestHeader("x-amz-user-agent", headers["X-Amz-User-Agent"]);

    xhr.send(blob);
  }

  uploadPart(data.blob, data.size, data.url, data.headers);
};
