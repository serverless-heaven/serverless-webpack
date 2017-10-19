'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const helpers = require('./helpers');

module.exports = {
  wpwatch() {
    if (helpers.hasEmptyWebpackConfig(this.webpackConfig)) {
      return BbPromise.resolve();
    }

    if (this.options['webpack-no-watch']) {
      // If we do not watch we will just run an ordinary compile
      this.serverless.cli.log('Watch disabled by option.');
      return this.serverless.pluginManager.spawn('webpack:compile');
    }

    this.serverless.cli.log('Bundling with Webpack...');

    const watchOptions = {};
    const usePolling = this.options['webpack-use-polling'];
    if (usePolling) {
      watchOptions.poll = _.isInteger(usePolling) ? usePolling : 3000;
      this.serverless.cli.log(`Enabled polling (${watchOptions.poll} ms)`);
    }

    const compiler = webpack(this.webpackConfig);
    const consoleStats = this.webpackConfig.stats || {
      colors: true,
      hash: false,
      version: false,
      chunks: false,
      children: false
    };

    // This starts the watch and waits for the immediate compile that follows to end or fail.
    const startWatch = (callback) => {
      let firstRun = true;
      compiler.watch(watchOptions, (err, stats) => {
        if (err) {
          if (firstRun) {
            firstRun = false;
            return callback(err);
          }
          throw err;
        }

        if (stats) {
          this.serverless.cli.consoleLog(stats.toString(consoleStats));
        }

        this.serverless.cli.log('Watching for changes...');

        if (firstRun) {
          firstRun = false;
          callback();
        }
      });
    };

    return BbPromise.fromCallback(cb => {
      startWatch(cb);
    });
  },
};
