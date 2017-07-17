'use strict';

const BbPromise = require('bluebird');
const path = require('path');

module.exports = {
  makePathOptionAbsolute() {
    const originalPath = this.serverless.config.serverless.processedInput.options.path;
    if (originalPath) {
      const absolutePath = path.resolve(originalPath);
      this.serverless.config.serverless.processedInput.options.path = absolutePath;
    };
    return BbPromise.resolve();
  }
};
