'use strict';

const BbPromise = require('bluebird');
const webpack = require('webpack');

module.exports = {
  wpwatch() {
    this.serverless.cli.log('Watching with Webpack...');

    const compiler = webpack(this.webpackConfig);
    compiler.watch({}, (err, stats) => {
        if (err) {
          throw err;
        }

        if (stats) {
            console.log("Webpack rebuilt");
        }
      });

    return BbPromise.resolve();
  },
};
