'use strict';

const BbPromise = require('bluebird');
const webpack = require('webpack');
const fs = require('fs');
const path = require('path');

module.exports = {
  copyFunctionArtifact() {
    const packagePath = this.options.package ||
      this.serverless.service.package.path ||
      path.join(this.servicePath || '.', '.serverless');
    const provider = this.serverless.getProvider('aws');
    const artifactFileName = provider.naming.getFunctionArtifactName(this.options.function);
    const artifactFilePath = path.join(packagePath, artifactFileName);
    const webpackPackageFunctionPath = path.join(this.webpackOutputPath, artifactFilePath);
    return new BbPromise((resolve, reject) => {
      const readStream = fs.createReadStream(webpackPackageFunctionPath);

      readStream.once('error', (err) => {
        reject(error);
      });

      readStream.once('end', () => {
        resolve();
      });

      readStream.pipe(fs.createWriteStream(artifactFilePath));
    });
  },
};
