'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const tty = require('tty');

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
          colors: tty.isatty(process.stdout.fd),
          hash: false,
          version: false,
          chunks: false,
          children: false
        };

        _.forEach(stats.stats, compileStats => {
          const statsOutput = compileStats.toString(consoleStats);
          if (statsOutput) {
            this.serverless.cli.consoleLog(statsOutput);
          }

        const allCompileStats = _.isArray(compileStats.stats)
          ? compileStats.stats
          : [compileStats];

        const errorCount = _.reduce(
          allCompileStats,
          (a, s) => (a += s.compilation.errors.length),
          0,
        );
        if (errorCount > 0) {
          throw new Error('Webpack compilation error, see above');
        }

        compileOutputPaths.push(
          allCompileStats[allCompileStats.length - 1].compilation.compiler
            .outputPath,
        );
      });

        this.compileOutputPaths = compileOutputPaths;
        this.compileStats = stats;

        return BbPromise.resolve();
      });
  },
};
