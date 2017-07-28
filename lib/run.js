'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const webpack = require('webpack');
const utils = require('./utils');

module.exports = {
  watch() {
    const functionName = this.options.function;
    this.serverless.cli.log(`Watch function ${functionName}...`);

    const compiler = webpack(this.webpackConfig);

    compiler.watch({}, (err, stats) => {
      if (err) {
        throw err;
      }

      BbPromise.try(() => {
        // Currently the plugin bends the service path to point to the webpack
        // directory in the compile step. This has to be reverted here so that
        // the webpack configuration can be found.
        // We have to think about changing the whole servicePath approach, so
        // that the plugin can use the given one and does not change it while
        // processing.
        if (this.originalServicePath) {
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
