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

        let consoleStats = {
          colors: true,
          hash: false,
          version: false,
          chunks: false,
          children: false
        };

        if (!this.multiCompile) {
          stats = { stats: [stats] };
          if (_.has(this.webpackConfig, 'stats')) {
            consoleStats = this.webpackConfig.stats;
          }
        } else {
          if (_.has(this.webpackConfig, '0.stats')) {
            consoleStats = this.webpackConfig[0].stats;
          }
        }

        const compileOutputPaths = [];

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
