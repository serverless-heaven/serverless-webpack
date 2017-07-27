'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');
const _ = require('lodash');

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

                _.forEach(functionNames, name => {
                  const func = this.serverless.service.getFunction(name);
                  // The location of the artifact property changed from Serverless
                  // 1.17 to 1.18 (damn, the guys should use SemVer!). We have to
                  // use the new one if available here.
                  const artifactParent = func.artifact ? func : func.package;

                  artifactParent.artifact = path.join(
                      this.serverless.config.servicePath,
                      '.serverless',
                      path.basename(artifactParent.artifact)
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
