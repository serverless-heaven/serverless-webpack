'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const logStats = require('./logStats');

module.exports = {
  wpwatch() {
    if (this.options['webpack-no-watch']) {
      // If we do not watch we will just run an ordinary compile
      if (!this.log) {
        this.serverless.cli.log('Watch disabled by option.');
      }
      return this.serverless.pluginManager.spawn('webpack:compile');
    }

    const watchProgress = this.log && this.progress.get('webpack');
    if (this.log) {
      this.log.verbose('[Webpack] Building with Webpack');
      watchProgress.update('[Webpack] Building with Webpack');
    } else {
      this.serverless.cli.log('Bundling with Webpack...');
    }

    const watchOptions = {};
    const usePolling = this.options['webpack-use-polling'];
    if (usePolling) {
      watchOptions.poll = _.isInteger(usePolling) ? usePolling : 3000;
      if (this.log) {
        this.log(`Enabled polling (${watchOptions.poll} ms)`);
      } else {
        this.serverless.cli.log(`Enabled polling (${watchOptions.poll} ms)`);
      }
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

    const consoleStats = this.webpackConfig.stats;
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

        if (this.log) {
          this.log.verbose(`Webpack watch invoke: HASH NEW=${stats && stats.hash} CUR=${lastHash}`);
        } else {
          process.env.SLS_DEBUG &&
            this.serverless.cli.log(`Webpack watch invoke: HASH NEW=${stats && stats.hash} CUR=${lastHash}`);
        }

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
          try {
            logStats(stats, consoleStats, this.serverless.cli.consoleLog, {
              log: this.log,
              ServerlessError: this.serverless.classes.Error
            });
          } catch (error) {
            if (this.log) {
              this.log.error(error.message);
            }
          }
        }

        if (firstRun) {
          firstRun = false;
          if (this.log) {
            this.log.verbose('[Webpack] Watch service...');
            watchProgress.notice('[Webpack] Watch service...');
          } else {
            this.serverless.cli.log('Watching for changes...');
          }
          callback();
        } else if (canEmit && currentCompileWatch === null) {
          // eslint-disable-next-line promise/no-promise-in-callback
          currentCompileWatch = BbPromise.resolve(this.serverless.pluginManager.spawn('webpack:compile:watch')).then(
            () => !this.log && this.serverless.cli.log('Watching for changes...')
          );
        }
      });
    };

    return BbPromise.fromCallback(cb => {
      startWatch(cb);
    });
  }
};
