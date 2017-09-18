'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');

module.exports = {
  watch() {
    const functionName = this.options.function;
    this.serverless.cli.log(`Watch function ${functionName}...`);

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

      BbPromise.try(() => {  // eslint-disable-line promise/catch-or-return, promise/no-promise-in-callback
        if (this.originalServicePath) {
          process.chdir(this.originalServicePath);
          this.serverless.config.servicePath = this.originalServicePath;
        }

        if (!this.isWatching) {
          this.isWatching = true;
          return BbPromise.resolve();
        }

        this.serverless.cli.log('Sources changed.');
        return this.serverless.pluginManager.spawn('invoke:local');
      })
      .then(() => this.serverless.cli.log('Waiting for changes ...'));
    });
  },
};
