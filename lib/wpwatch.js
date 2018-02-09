'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');

module.exports = {
  wpwatch() {
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
    let lastHash = null;
    const startWatch = (callback) => {
      let firstRun = true;
      const watcher = compiler.watch(watchOptions, (err, stats) => {
        if (err) {
          if (firstRun) {
            firstRun = false;
            return callback(err);
          }
          throw err;
        }

        process.env.SLS_DEBUG && this.serverless.cli.log(`Webpack watch invoke: HASH NEW=${stats.hash} CUR=${lastHash}`);

        // If the file hash did not change there were no effective code changes detected
        // (comment changes do not change the compile hash and do not account for a rebuild!)
        // See here: https://webpack.js.org/api/node/#watching (note below watching)
        if (stats && stats.hash === lastHash) {
          if (firstRun) {
            firstRun = false;
            callback();
          }
          return;
        }

        if (stats) {
          lastHash = stats.hash;
          this.serverless.cli.consoleLog(stats.toString(consoleStats));
        }

        if (firstRun) {
          firstRun = false;
          this.serverless.cli.log('Watching for changes...');
          callback();
        } else {
          // We will close the watcher while the compile event is triggered and resume afterwards to prevent race conditions.
          watcher.close(() => {
            return this.serverless.pluginManager.spawn('webpack:compile:watch')
            .then(() => {
              // Resume watching after we triggered the compile:watch event
              return BbPromise.fromCallback(cb => {
                startWatch(cb);
              })
              .then(() => this.serverless.cli.log('Watching for changes...'));
            });
          });
        }
      });
    };

    return BbPromise.fromCallback(cb => {
      startWatch(cb);
    });
  },
};
