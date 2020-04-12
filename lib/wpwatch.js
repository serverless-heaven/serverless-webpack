'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const tty = require('tty');

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

    let currentCompileWatch = null;

    // This allows us to hold the compile until "webpack:compile:watch" has resolved
    const beforeCompile = () =>
      new BbPromise(resolve => {
        // eslint-disable-next-line promise/catch-or-return
        BbPromise.resolve(currentCompileWatch)
          // Forwarding the error to the then so we don't display it twice
          // (once when it was originally thrown, and once when the promise rejects)
          .catch(error => error)
          .then(error => {
            if (error) {
              return null;
            }

            currentCompileWatch = null;
            resolve();
            return null;
          });
      });

    const compiler = webpack(this.webpackConfig);

    // Determine if we can use hooks or if we should fallback to the plugin api
    const hasHooks = compiler.hooks && compiler.hooks.beforeCompile;
    const hasPlugins = compiler.plugin;
    const canEmit = hasHooks || hasPlugins;

    if (hasHooks) {
      compiler.hooks.beforeCompile.tapPromise('webpack:compile:watch', beforeCompile);
    } else if (hasPlugins) {
      compiler.plugin('before-compile', (compilationParams, callback) => {
        beforeCompile()
          .then(callback) // eslint-disable-line promise/no-callback-in-promise
          .catch(_.noop);
      });
    }

    const consoleStats = this.webpackConfig.stats || {
      colors: tty.isatty(process.stdout.fd),
      hash: false,
      version: false,
      chunks: false,
      children: false
    };

    // This starts the watch and waits for the immediate compile that follows to end or fail.
    let lastHash = null;

    const startWatch = callback => {
      let firstRun = true;
      compiler.watch(watchOptions, (err, stats) => {
        if (err) {
          if (firstRun) {
            firstRun = false;
            return callback(err);
          }
          throw err;
        }

        process.env.SLS_DEBUG &&
          this.serverless.cli.log(`Webpack watch invoke: HASH NEW=${stats.hash} CUR=${lastHash}`);

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
          const statsOutput = stats.toString(consoleStats);
          if (statsOutput) {
            this.serverless.cli.consoleLog(stats.toString(consoleStats));
          }
        }

        if (firstRun) {
          firstRun = false;
          this.serverless.cli.log('Watching for changes...');
          callback();
        } else if (canEmit && currentCompileWatch === null) {
          // eslint-disable-next-line promise/no-promise-in-callback
          currentCompileWatch = BbPromise.resolve(this.serverless.pluginManager.spawn('webpack:compile:watch')).then(
            () => this.serverless.cli.log('Watching for changes...')
          );
        }
      });
    };

    return BbPromise.fromCallback(cb => {
      startWatch(cb);
    });
  }
};
