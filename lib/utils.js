'use strict';

const BbPromise = require('bluebird');
const path = require('path');

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function purgeCache(moduleName) {
  searchCache(moduleName, function (mod) {
    delete require.cache[mod.id];
  });
  Object.keys(module.constructor._pathCache).forEach(function(cacheKey) {
    if (cacheKey.indexOf(moduleName)>0) {
     delete module.constructor._pathCache[cacheKey];
    }
  });
}

function searchCache(moduleName, callback) {
  var mod = require.resolve(moduleName);
  if (mod && ((mod = require.cache[mod]) !== undefined)) {
    (function traverse(mod) {
      mod.children.forEach(function (child) {
        traverse(child);
      });
      callback(mod);
    }(mod));
  }
}

function makeProcessedInputPathAbsolutePath() {
  var originalPath = this.serverless.config.serverless.processedInput.options.path
  if (originalPath) {
    var absolutePath = path.resolve(originalPath)
    this.serverless.config.serverless.processedInput.options.path = absolutePath
  }
  return BbPromise.resolve();
}

module.exports = {
  guid,
  purgeCache,
  searchCache,
  makeProcessedInputPathAbsolutePath
};
