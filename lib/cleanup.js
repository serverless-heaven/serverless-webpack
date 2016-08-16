'use strict';

const BbPromise = require('bluebird');
const fse = require('fs-extra');

module.exports = {
  cleanup() {
    const webpackOutputPath = this.webpackOutputPath;

    if (this.serverless.utils.dirExistsSync(webpackOutputPath)) {
      fse.removeSync(webpackOutputPath);
    }
    return BbPromise.resolve();
  },
};
