'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const tty = require('tty');

const defaultStatsConfig = {
  colors: tty.isatty(process.stdout.fd),
  hash: false,
  version: false,
  chunks: false,
  children: false
};

function ensureArray(obj) {
  return _.isArray(obj) ? obj : [obj];
}

function getStatsLogger(statsConfig, consoleLog) {
  return stats => {
    const statsOutput = stats.toString(statsConfig || defaultStatsConfig);
    if (statsOutput) {
      consoleLog(statsOutput);
    }
  };
}

function webpackCompile(config, logStats) {
  return BbPromise.fromCallback(cb => webpack(config).run(cb)).then(stats => {
    // ensure stats in any array in the case of concurrent build.
    stats = stats.stats ? stats.stats : [stats];

    _.forEach(stats, compileStats => {
      logStats(compileStats);
      if (compileStats.hasErrors()) {
        throw new Error('Webpack compilation error, see stats above');
      }
    });

    return stats;
  });
}

function webpackConcurrentCompile(configs, logStats, concurrency) {
  return BbPromise.map(configs, config => webpackCompile(config, logStats), { concurrency }).then(stats =>
    _.flatten(stats)
  );
}

module.exports = {
  compile() {
    this.serverless.cli.log('Bundling with Webpack...');

    const configs = ensureArray(this.webpackConfig);
    const logStats = getStatsLogger(configs[0].stats, this.serverless.cli.consoleLog);

    if (!this.configuration) {
      return BbPromise.reject('Missing plugin configuration');
    }
    const concurrency = this.configuration.concurrency;

    return webpackConcurrentCompile(configs, logStats, concurrency).then(stats => {
      this.compileStats = { stats };
      return BbPromise.resolve();
    });
  }
};
