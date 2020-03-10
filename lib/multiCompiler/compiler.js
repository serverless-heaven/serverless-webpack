'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const workerFarm = require('worker-farm');

module.exports = {
  multiCompiler(options) {
    const workerOptions = {
      maxCallsPerWorker: 1
    };
    const workerThreadSourcePath = require.resolve('./workerThread');
    const methods = ['runWebpack'];

    const workers = workerFarm(workerOptions, workerThreadSourcePath, methods);

    const configOptions = options.configOptions;

    const threads = _.map(options.entryFunctions, entryFunc => {
      const webpackConfigFilePath = options.webpackConfigFilePath;
      const workerOptions = {
        webpackConfigFilePath,
        configOptions: {
          ...configOptions,
          entryFunc
        },
        consoleStats: options.consoleStats
      };

      if (!webpackConfigFilePath) {
        workerOptions.webpackConfig = options.webpackConfig;
      }

      return BbPromise.fromCallback(cb => {
        workers.runWebpack(workerOptions, cb);
      });
    });

    return Promise.all(threads).then(stats => {
      return {
        stats
      };
    });
  }
};
