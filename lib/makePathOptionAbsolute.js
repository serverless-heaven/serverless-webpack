'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const _ = require('lodash');

module.exports = {
  makePathOptionAbsolute() {
    const originalPath = this.serverless.config.serverless.processedInput.options.path;
    if (originalPath) {
      const absolutePath = path.resolve(originalPath);
      this.serverless.config.serverless.processedInput.options.path = absolutePath;
    }

    // Set service path to compiled code for local invoke.
    if (_.get(this.serverless, 'service.package.individually')) {
      this.serverless.config.servicePath = path.join(this.webpackOutputPath, this.options.function);
    } else {
      this.serverless.config.servicePath = path.join(this.webpackOutputPath, 'service');
    }

    return BbPromise.resolve();
  }
};
