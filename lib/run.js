'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');

module.exports = {
  watch(command) {
    const functionName = this.options.function;
    if (functionName) {
      this.serverless.cli.log(`Watch function ${functionName}...`);
    } else {
      this.serverless.cli.log('Watch service...');
    }

    const compiler = webpack(this.webpackConfig);
    const watchOptions = {};
    const usePolling = this.options['webpack-use-polling'];
    if (usePolling) {
      watchOptions.poll = _.isInteger(usePolling) ? usePolling : 3000;
      this.serverless.cli.log(`Enabled polling (${watchOptions.poll} ms)`);
    }

    compiler.watch(watchOptions, (err /*, stats */) => {
      if (err) {
        throw err;
      }
      // eslint-disable-next-line promise/catch-or-return, promise/no-promise-in-callback
      BbPromise.try(() => {
        if (this.originalServicePath) {
          process.chdir(this.originalServicePath);
          this.serverless.config.servicePath = this.originalServicePath;
        }

        if (!this.isWatching) {
          this.isWatching = true;
          return BbPromise.resolve();
        }

        this.serverless.cli.log('Sources changed.');
        if (_.isFunction(command)) {
          return command();
        }
        this.options.verbose && this.serverless.cli.log(`Invoke ${command}`);
        return this.serverless.pluginManager.spawn(command);
      }).then(() => this.serverless.cli.log('Waiting for changes ...'));
    });
  }
};
