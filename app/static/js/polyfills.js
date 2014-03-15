if ( !Array.prototype.forEach ) {
  Array.prototype.forEach = function(fn, scope) {
    for(var i = 0, len = this.length; i < len; ++i) {
      fn.call(scope, this[i], i, this);
    }
  };
}

if ( !File.prototype.slice ) {
    if ( File.prototype.webkitSlice ) {
        File.prototype.slice = File.prototype.webkitSlice
    }
}