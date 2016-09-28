'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');

module.exports = {
  cleanup() {
    const webpackOutputPath = this.webpackOutputPath;
    const artifact = path.basename(this.serverless.service.package.artifact);

    const source = path.join(webpackOutputPath, '.serverless', artifact);
    const destination = path.join(this.serverless.config.servicePath, '.serverless', artifact);
    const moveArtifact = new BbPromise((resolve, reject) => {
      if (this.originalServicePath) {
        this.serverless.config.servicePath = this.originalServicePath;
        fse.move(
            source,
            destination,
          (err) => {
            if (err) {
              reject(err);
            } else {
              this.serverless.service.package.artifact = destination;
              resolve();
            }
          }
        );
      } else {
        resolve();
      }
    });

    return moveArtifact
      .then(() => {
        if (this.serverless.utils.dirExistsSync(webpackOutputPath)) {
          fse.removeSync(webpackOutputPath);
        }
      })
      .then(() => BbPromise.resolve());
  },
};
