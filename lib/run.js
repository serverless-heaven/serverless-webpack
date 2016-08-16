'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  loadFunction(stats) {
    const functionName = this.options.function;
    const handlerFilePath = path.join(
      stats.compilation.options.output.path,
      stats.compilation.options.output.filename
    );
    purgeCache(handlerFilePath);
    const handler = require(handlerFilePath);

    return handler[functionName];
  },

  getEvent() {
    return this.options.path
      ? this.serverless.utils.readFileSync(this.options.path)
      : null; // TODO use get-stdin instead
  },

  getContext() {
    const functionName = this.options.function;
    return {
      awsRequestId: guid(),
      invokeid: guid(),
      logGroupName: `/aws/lambda/${functionName}`,
      logStreamName: '2016/02/14/[HEAD]13370a84ca4ed8b77c427af260',
      functionVersion: '$LATEST',
      isDefaultFunctionVersion: true,
      functionName: functionName,
      memoryLimitInMB: '1024',
    };
  },

  run(stats) {
    const functionName = this.options.function;

    this.serverless.cli.log(`Run function ${functionName}...`);

    const handler = this.loadFunction(stats);
    const event = this.getEvent();
    const context = this.getContext();

    return new BbPromise((resolve, reject) => handler(
      event,
      context,
      (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      }
    ));
  },

  watch() {
    const functionName = this.options.function;
    this.serverless.cli.log(`Watch function ${functionName}...`);

    const compiler = webpack(this.webpackConfig);

    compiler.watch({}, (err, stats) => {
      if (err) {
        throw err;
      }
      this.serverless.cli.log(`Run function ${functionName}...`);
      const handler = this.loadFunction(stats);
      const event = this.getEvent();
      const context = this.getContext();
      handler(
        event,
        context,
        (err, res) => {
          if (err) {
            throw err;
          } else {
            console.log(res);
          }
        }
      )
    });

    return BbPromise.resolve();
  },
};

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