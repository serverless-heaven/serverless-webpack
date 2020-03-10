'use strict';

const _ = require('lodash');
const path = require('path');

module.exports = {
  setOptionsOnConfig(webpackConfig, options) {
    // Default context
    if (!webpackConfig.context) {
      webpackConfig.context = options.servicePath;
    }

    // Default target
    if (!webpackConfig.target) {
      webpackConfig.target = 'node';
    }

    // Default output
    if (!webpackConfig.output || _.isEmpty(webpackConfig.output)) {
      const outputPath = path.join(options.servicePath, '.webpack');
      webpackConfig.output = {
        libraryTarget: 'commonjs',
        path: outputPath,
        filename: '[name].js'
      };
    }

    // Custom output path
    if (options.out) {
      webpackConfig.output.path = path.join(options.servicePath, options.out);
    }

    // In case of individual packaging we have to create a separate config for each function
    if (options.entryFunc) {
      const entryFunc = options.entryFunc;
      webpackConfig.entry = {
        [entryFunc.entry.key]: entryFunc.entry.value
      };
      const compileName = entryFunc.funcName || _.camelCase(entryFunc.entry.key);
      webpackConfig.output.path = path.join(webpackConfig.output.path, compileName);
    } else {
      webpackConfig.output.path = path.join(webpackConfig.output.path, 'service');
    }

    return webpackConfig;
  }
};
