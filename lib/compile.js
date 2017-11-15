'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');

module.exports = {
  compile() {
    this.serverless.cli.log('Bundling with Webpack...');

    const compiler = webpack(this.webpackConfig);

    return BbPromise
      .fromCallback(cb => compiler.run(cb))
      .then(stats => {

        if (!this.multiCompile) {
          stats = { stats: [stats] };
        }

        const compileOutputPaths = [];
        const consoleStats = this.webpackConfig.stats || _.get(this, 'webpackConfig[0].stats') || {
          colors: true,
          hash: false,
          version: false,
          chunks: false,
          children: false
        };

        _.forEach(stats.stats, compileStats => {
          this.serverless.cli.consoleLog(compileStats.toString(consoleStats));

          if (compileStats.compilation.errors.length) {
            throw new Error('Webpack compilation error, see above');
          }

          compileOutputPaths.push(compileStats.compilation.compiler.outputPath);
        });

        this.compileOutputPaths = compileOutputPaths;
        this.compileStats = stats;

        return BbPromise.resolve();
      });
  },
};
