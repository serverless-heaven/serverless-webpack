'use strict';

const webpack = require('webpack');
const { setOptionsOnConfig } = require('../processConfig');
const { processWebpackStats } = require('../processWebpackStats');

module.exports = {
  runWebpack(options, callback) {
    const webpackConfigFilePath = options.webpackConfigFilePath;
    const configOptions = options.configOptions;
    const consoleStats = options.consoleStats;

    let webpackConfig = null;
    try {
      if (webpackConfigFilePath) {
        webpackConfig = require(webpackConfigFilePath);
      } else if (options.webpackConfig) {
        webpackConfig = options.webpackConfig;
      } else {
        throw new Error('Missing config');
      }
    } catch (error) {
      callback(new Error('Failed to load config'));
      return;
    }

    const entryConfig = setOptionsOnConfig(webpackConfig, configOptions);

    const compiler = webpack(entryConfig);

    compiler.run((error, stats) => {
      if (error) {
        callback(new Error('Failed to compile'));

        return;
      }

      const result = processWebpackStats(stats, consoleStats);

      callback(null, result);
    });
  }
};
