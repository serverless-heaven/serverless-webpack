'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');

module.exports = {
  cleanup() {
    const webpackOutputPath = this.webpackOutputPath;

    const moveArtifact = new BbPromise((resolve, reject) => {
      if (this.originalServicePath) {
        this.serverless.config.servicePath = this.originalServicePath;
        fse.copy(
          path.join(webpackOutputPath, '.serverless'),
          path.join(this.serverless.config.servicePath, '.serverless'),
          (err) => {
            if (err) {
              reject(err);
            } else {
              if (this.serverless.service.package.individually) {
                const functionNames = this.serverless.service.getAllFunctions();
                functionNames.forEach(name => {
                  this.serverless.service.functions[name].artifact = path.join(
                      this.serverless.config.servicePath,
                      '.serverless',
                      path.basename(this.serverless.service.functions[name].artifact)
                  );
                });
                resolve();
                return;
              }

              this.serverless.service.package.artifact = path.join(
                this.serverless.config.servicePath,
                '.serverless',
                path.basename(this.serverless.service.package.artifact)
              );
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
