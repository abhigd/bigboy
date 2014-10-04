module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      main: {
        files: [
          {src: "vendor/underscore/underscore.js", dest: "app/static/js/underscore.min.js"},
          {src: "vendor/backbone/backbone.js", dest: "app/static/js/backbone.min.js"},
        ]
      }
    },
    bower: {
      install: {
        options: {
          targetDir: './vendor',
          install: true,
          verbose: false,
          cleanTargetDir: false,
          cleanBowerDir: false,
          bowerOptions: {},
          copy: true
        }
      }
    },
    less: {
      development: {
        options: {
          paths: ["vendor"]
        },
        files: {
          "app/static/css/index.css": "app/static/css/styles.less"
        }
      }
    },
    copy: {
      vendor: {
        files: [
          {src: "vendor/jquery/dist/jquery.min.js", dest: "app/static/js/jquery.min.js"},
          {src: "vendor/bootstrap/dist/js/bootstrap.min.js", dest: "app/static/js/bootstrap.min.js"},
          {src: "vendor/crypto-js-evanvosberg/build/rollups/md5.js", dest: "app/static/js/md5.js"},
          {src: "vendor/crypto-js-evanvosberg/build/components/enc-base64-min.js", dest: "app/static/js/enc-base64-min.js"},
          {src: "vendor/crypto-js-evanvosberg/src/lib-typedarrays.js", dest: "app/static/js/lib-typedarrays.js"},
          {src: "vendor/aws-sdk/aws-sdk.js", dest: "app/static/js/aws-sdk.js"}
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-bower-task');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-copy');

  // Default task(s).
  grunt.registerTask('default', ['bower:install', 'uglify:main', 'copy:vendor']);

};
