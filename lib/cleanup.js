'use strict';

const BbPromise = require('bluebird');
const fse = require('fs-extra');

module.exports = {
  cleanup() {
    const webpackOutputPath = this.webpackOutputPath;

    this.options.verbose && this.serverless.cli.log(`Remove ${webpackOutputPath}`);

    if (this.serverless.utils.dirExistsSync(webpackOutputPath)) {
      fse.removeSync(webpackOutputPath);
    }

    return BbPromise.resolve();
  },
};
