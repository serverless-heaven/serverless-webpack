'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const _ = require('lodash');
const helpers = require('./helpers');

module.exports = {
  prepareLocalInvoke() {
    if (!helpers.hasNodeRuntime(this.options.function, this.serverless)) {
      return BbPromise.resolve();
    }

    const originalPath = this.serverless.config.serverless.processedInput.options.path;
    if (originalPath) {
      const absolutePath = path.resolve(originalPath);
      this.serverless.config.serverless.processedInput.options.path = absolutePath;
    }

    // Set service path to compiled code for local invoke.
    this.originalServicePath = this.serverless.config.servicePath;
    if (_.get(this.serverless, 'service.package.individually')) {
      this.serverless.config.servicePath = path.join(this.webpackOutputPath, this.options.function);
    } else {
      this.serverless.config.servicePath = path.join(this.webpackOutputPath, 'service');
    }

    // Set service path as CWD to allow accessing bundled files correctly
    process.chdir(this.serverless.config.servicePath);

    return BbPromise.resolve();
  }
};
