'use strict';

const tty = require('tty');

const defaultStatsConfig = {
  colors: tty.isatty(process.stdout.fd),
  hash: false,
  version: false,
  chunks: false,
  children: false
};

module.exports = function (stats, statsConfig, consoleLog) {
  const statsOutput = stats.toString(statsConfig || defaultStatsConfig);
  if (statsOutput) {
    consoleLog(statsOutput);
  }
};
