'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');

module.exports = {
  wpwatch() {
    this.serverless.cli.log('Watching with Webpack...');

    const watchOptions = {};
    const usePolling = this.options['webpack-use-polling'];
    if (usePolling) {
      watchOptions.poll = _.isInteger(usePolling) ? usePolling : 3000;
      this.serverless.cli.log(`Enabled polling (${watchOptions.poll} ms)`);
    }

    const compiler = webpack(this.webpackConfig);
    compiler.watch(watchOptions, (err, stats) => {
      if (err) {
        throw err;
      }

      if (stats) {
        console.log(stats.toString());   // eslint-disable-line no-console
      }
    });

    return BbPromise.resolve();
  },
};
