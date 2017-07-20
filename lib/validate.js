'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');
const lib = require('./index');

const handlerRegex = /\.[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/;

function getEntryKey(serverlessFunction) {
  return serverlessFunction.handler.replace(handlerRegex, '');
};

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
      let entries = {};
      const functions = this.serverless.service.functions;
      if (this.options.function) {
        const serverlessFunction = functions[this.options.function];
        if (!serverlessFunction) {
          throw new this.serverless.classes
          .Error(`Function "${this.options.function}" not found in serverless.yml`);
        }
        const entryKey = getEntryKey(serverlessFunction);
        entries = { [entryKey]: [`./${entryKey}.js`] };
      } else {
        for (const key in functions) {
          const entryKey = getEntryKey(functions[key]);
          entries[entryKey] = [`./${entryKey}.js`];
        }
      }
      lib.entries = entries;
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
