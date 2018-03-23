'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

/**
 * Remove the specified module from the require cache.
 * @param {string} moduleName 
 */
function purgeCache(moduleName) {
  return searchAndProcessCache(moduleName, function (mod) {
    delete require.cache[mod.id];
  })
  .then(() => {
    _.forEach(_.keys(module.constructor._pathCache), function(cacheKey) {
      if (cacheKey.indexOf(moduleName)>0) {
        delete module.constructor._pathCache[cacheKey];
      }
    });
    return BbPromise.resolve();
  });
}

function searchAndProcessCache(moduleName, processor) {
  let mod_src = require.resolve(moduleName);
  const visitedModules = [];
  if (mod_src && ((mod_src = require.cache[mod_src]) !== undefined)) {
    const modStack = [mod_src];

    while (!_.isEmpty(modStack)) {
      const mod = modStack.pop();
      if (!_.includes(visitedModules, mod)) {
        visitedModules.push(mod);
        Array.prototype.push.apply(modStack, mod.children);
        processor(mod);
      }
    }
  }
  return BbPromise.resolve();
}

module.exports = {
  guid,
  purgeCache,
  searchAndProcessCache,
};
