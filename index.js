'use strict';

const BbPromise = require('bluebird');

const validate = require('./lib/validate');
const compile = require('./lib/compile');
const cleanup = require('./lib/cleanup');

class ServerlessWebpack {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    Object.assign(
      this,
      validate,
      compile,
      cleanup
    );

    this.hooks = {
      'before:deploy:createDeploymentPackage': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.compile),

      'after:deploy:deploy': () => BbPromise.bind(this)
        .then(this.cleanup),
    };
  }
}

module.exports = ServerlessWebpack;
