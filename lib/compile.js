'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const tty = require('tty');

module.exports = {
  compile() {
    this.serverless.cli.log('Bundling with Webpack...');

    const compiler = webpack(this.webpackConfig);

    return BbPromise.fromCallback(cb => compiler.run(cb)).then(stats => {
      if (!this.multiCompile) {
        stats = { stats: [stats] };
      }

      const compileOutputPaths = [];
      const consoleStats = this.webpackConfig.stats ||
        _.get(this, 'webpackConfig[0].stats') || {
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

        if (compileStats.compilation.errors.length) {
          throw new Error('Webpack compilation error, see above');
        }

        compileOutputPaths.push(compileStats.compilation.compiler.outputPath);
      });

      this.compileOutputPaths = compileOutputPaths;
      this.compileStats = stats;

      return BbPromise.resolve();
    });
  }
};
