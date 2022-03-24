'use strict';

const _ = require('lodash');
const tty = require('tty');

const defaultStatsConfig = {
  colors: tty.isatty(process.stdout.fd),
  hash: false,
  version: false,
  chunks: false,
  children: false
};

module.exports = function (stats, statsConfig, consoleLog, { log, ServerlessError }) {
  const statsOutput = stats.toString(statsConfig || defaultStatsConfig);
  if (!log) {
    if (statsOutput) {
      consoleLog(statsOutput);
    }
  } else {
    if (statsConfig) {
      if (!statsOutput) {
        return;
      }
      log();
      log(`${_.split(_.trim(statsOutput), '\n').join('\n  ')}`);
    } else {
      const warningsOutput = stats.toString({
        all: false,
        errors: false,
        errorsCount: false,
        warnings: true,
        warningsCount: false,
        logging: 'warn'
      });
      if (warningsOutput) {
        log.warning();
        log.warning(`${_.split(_.trim(_.replace(warningsOutput, /WARNING /g, '')), '\n').join('\n  ')}`);
      }
    }
  }
  if (!stats.hasErrors()) {
    return;
  }
  if (!log) {
    throw _.assign(new ServerlessError('Webpack compilation error, see stats above'), { stats });
  }
  const errorsOutput = stats.toString({
    all: false,
    errors: true,
    errorsCount: false,
    errorDetails: true,
    warnings: false,
    warningsCount: false,
    logging: 'error'
  });
  if (errorsOutput) {
    throw _.assign(
      new ServerlessError(`${_.split(_.trim(_.replace(errorsOutput, /ERROR /g, '')), '\n').join('\n  ')}`),
      { stats }
    );
  }
};
