'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const tty = require('tty');

const { compiler } = require('./compiler');
const { multiCompiler } = require('./multiCompiler/compiler');

module.exports = {
  compile() {
    this.serverless.cli.log('Bundling with Webpack...');
    const consoleStats = this.webpackConfig.stats ||
      _.get(this, 'webpackConfig[0].stats') || {
      colors: tty.isatty(process.stdout.fd),
      hash: false,
      version: false,
      chunks: false,
      children: false
    };

    const configOptions = {
      servicePath: this.serverless.config.servicePath,
      out: this.options.out
    };

    const compileOptions = {
      webpackConfigFilePath: this.webpackConfigFilePath,
      webpackConfig: this.webpackConfig,

      entryFunctions: this.entryFunctions,

      configOptions,
      consoleStats
    };

    if (this.multiCompile) {
      this.options.verbose && this.serverless.cli.log('Using multi-thread function compiler');
    }

    const webpackCompiler = this.multiCompile ? multiCompiler(compileOptions) : compiler(compileOptions);

    return webpackCompiler.then(stats => {
      const compileOutputPaths = [];

      _.forEach(stats.stats, compileStats => {
        const statsOutput = compileStats.cliOutput;
        if (statsOutput) {
          this.serverless.cli.consoleLog(statsOutput);
        }

        if (compileStats.errors.length) {
          throw new Error('Webpack compilation error, see above');
        }

        compileOutputPaths.push(compileStats.outputPath);
      });

      this.compileOutputPaths = compileOutputPaths;
      this.compileStats = stats;

      return BbPromise.resolve();
    });
  }
};
