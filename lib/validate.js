'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');

module.exports = {
  validate() {
    this.webpackConfig = (
      this.serverless.service.custom &&
      this.serverless.service.custom.webpack ||
      'webpack.config.js'
    );

    if (typeof this.webpackConfig === 'string') {
      const webpackConfigFilePath = path.join(this.serverless.config.servicePath, this.webpackConfig);
      if (!this.serverless.utils.fileExistsSync(webpackConfigFilePath)) {
        throw new this.serverless.classes
          .Error('The webpack plugin could not find the configuration file at: ' + webpackConfigFilePath);
      }
      if (this.options.function) {
        process.env.serverlessFunction = this.options.function;
      }
      this.webpackConfig = require(webpackConfigFilePath);
    }

    // Default context
    if (!this.webpackConfig.context) {
      this.webpackConfig.context = this.serverless.config.servicePath;
    }

    // Default output
    if (!this.webpackConfig.output) {
      const outputPath = path.join(this.serverless.config.servicePath, '.webpack');
      const outputFilename = path.basename(
        Array.isArray(this.webpackConfig.entry)
        && this.webpackConfig.entry[this.webpackConfig.entry.length - 1]
        || this.webpackConfig.entry
        || 'handler.js'
      );
      this.webpackConfig.output = {
        libraryTarget: 'commonjs',
        path: outputPath,
        filename: outputFilename,
      };
    }

    // Custom output path
    if (this.options.out) {
      this.webpackConfig.output.path = path.join(this.serverless.config.servicePath, this.options.out);
    }

    fse.removeSync(this.webpackConfig.output.path);

    return BbPromise.resolve();
  },
};
