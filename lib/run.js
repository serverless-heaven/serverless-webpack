const _ = require('lodash');
const webpack = require('webpack');

module.exports = {
  watch(command) {
    const functionName = this.options.function;
    const watchProgress = this.log && this.progress.get('webpack');
    if (functionName) {
      if (this.log) {
        this.log.verbose(`[Webpack] Watch function "${functionName}"`);
        watchProgress.notice(`[Webpack] Watch function "${functionName}"`);
      } else {
        this.serverless.cli.log(`Watch function ${functionName}...`);
      }
    } else {
      if (this.log) {
        this.log.verbose('[Webpack] Watch service');
        watchProgress.notice('[Webpack] Watch service');
      } else {
        this.serverless.cli.log('Watch service...');
      }
    }

    const compiler = webpack(this.webpackConfig);
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

    return new Promise((_resolve, reject) => {
      compiler.watch(watchOptions, (err /*, stats */) => {
        if (err) {
          reject(err);
          return;
        }

        let action;

        try {
          if (this.originalServicePath) {
            process.chdir(this.originalServicePath);
            this.serverless.config.servicePath = this.originalServicePath;
          }

          if (!this.isWatching) {
            this.isWatching = true;
          } else {
            if (this.log) {
              this.log('Sources changed.');
            } else {
              this.serverless.cli.log('Sources changed.');
            }
            if (_.isFunction(command)) {
              action = command();
            } else {
              if (this.log) {
                this.log.verbose(`Invoke ${command}`);
              } else {
                this.options.verbose && this.serverless.cli.log(`Invoke ${command}`);
              }
              action = this.serverless.pluginManager.spawn(command);
            }
          }
        } catch (error) {
          reject(error);
          return;
        }

        Promise.resolve(action).then(() => {
          if (this.log) {
            if (functionName) {
              this.log.verbose(`[Webpack] Watch function "${functionName}"`);
              watchProgress.notice(`[Webpack] Watch function "${functionName}"`);
            } else {
              this.log.verbose('[Webpack] Watch service');
              watchProgress.notice('[Webpack] Watch service');
            }
          } else {
            this.serverless.cli.log('Waiting for changes ...');
          }
        }, reject);
      });
    });
  }
};
