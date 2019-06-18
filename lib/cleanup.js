'use strict';

const BbPromise = require('bluebird');
const fse = require('fs-extra');

module.exports = {
  cleanup() {
    const webpackOutputPath = this.webpackOutputPath;

    const keepOutputDirectory = this.configuration.keepOutputDirectory;
    if (!keepOutputDirectory) {
      this.options.verbose && this.serverless.cli.log(`Remove ${webpackOutputPath}`);
      if (this.serverless.utils.dirExistsSync(webpackOutputPath)) {
        fse.removeSync(webpackOutputPath);
      }
    } else {
      this.options.verbose && this.serverless.cli.log(`Keeping ${webpackOutputPath}`);
    }

    return BbPromise.resolve();
  }
};
