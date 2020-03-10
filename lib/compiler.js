'use strict';

const BbPromise = require('bluebird');
const webpack = require('webpack');

const { processWebpackStats } = require('./processWebpackStats');
const { setOptionsOnConfig } = require('./processConfig');

module.exports = {
  compiler(options) {
    const webpackConfig = options.webpackConfig;
    const configOptions = options.configOptions;
    const consoleStats = options.consoleStats;

    const config = setOptionsOnConfig(webpackConfig, configOptions);

    const compiler = webpack(config);

    return BbPromise.fromCallback(cb => compiler.run(cb)).then(stats => {
      const result = processWebpackStats(stats, consoleStats);

      return {
        stats: [result]
      };
    });
  }
};
