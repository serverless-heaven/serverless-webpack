'use strict';

const _ = require('lodash');

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
  _.forEach(_.keys(module.constructor._pathCache), function(cacheKey) {
    if (cacheKey.indexOf(moduleName)>0) {
      delete module.constructor._pathCache[cacheKey];
    }
  });
}

function searchCache(moduleName, callback) {
  let mod = require.resolve(moduleName);
  if (mod && ((mod = require.cache[mod]) !== undefined)) {
    (function traverse(mod) {
      _.forEach(mod.children, function (child) {
        traverse(child);
      });
      callback(mod);
    }(mod));
  }
}

module.exports = {
  guid,
  purgeCache,
  searchCache,
};
