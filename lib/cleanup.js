'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const fse = require('fs-extra');

module.exports = {
  cleanup() {
    const webpackOutputPath = this.webpackOutputPath;
    const keepOutputDirectory = this.keepOutputDirectory || this.configuration.keepOutputDirectory;
    const cli = this.options.verbose ? this.serverless.cli : { log: _.noop };

    if (!keepOutputDirectory) {
      if (this.log) {
        this.log.verbose(`Remove ${webpackOutputPath}`);
      } else {
        cli.log(`Remove ${webpackOutputPath}`);
      }
      if (this.serverless.utils.dirExistsSync(webpackOutputPath)) {
        // Remove async to speed up process
        fse
          .remove(webpackOutputPath)
          .then(() => {
            if (this.log) {
              this.log.verbose(`Removing ${webpackOutputPath} done`);
            } else {
              cli.log(`Removing ${webpackOutputPath} done`);
            }
            return null;
          })
          .catch(error => {
            if (this.log) {
              this.log.error(`Error occurred while removing ${webpackOutputPath}: ${error}`);
            } else {
              cli.log(`Error occurred while removing ${webpackOutputPath}: ${error}`);
            }
          });
      }
    } else {
      if (!this.log) {
        cli.log(`Keeping ${webpackOutputPath}`);
      }
    }

    return BbPromise.resolve();
  }
};
