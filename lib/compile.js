'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const tty = require('tty');
const isBuiltinModule = require('is-builtin-module');

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

function getExternalModuleName(module) {
  const path = /^external "(.*)"$/.exec(module.identifier())[1];
  const pathComponents = path.split('/');
  const main = pathComponents[0];

  // this is a package within a namespace
  if (main.charAt(0) == '@') {
    return `${main}/${pathComponents[1]}`;
  }

  return main;
}

function isExternalModule(module) {
  return _.startsWith(module.identifier(), 'external ') && !isBuiltinModule(getExternalModuleName(module));
}

/**
 * Gets the module issuer. The ModuleGraph api does not exists in webpack@4
 * so falls back to using module.issuer.
 */
function getIssuerCompat(moduleGraph, module) {
  if (moduleGraph) {
    return moduleGraph.getIssuer(module);
  }

  return module.issuer;
}

/**
 * Find the original module that required the transient dependency. Returns
 * undefined if the module is a first level dependency.
 * @param {Object} moduleGraph - Webpack module graph
 * @param {Object} issuer - Module issuer
 */
function findExternalOrigin(moduleGraph, issuer) {
  if (!_.isNil(issuer) && _.startsWith(issuer.rawRequest, './')) {
    return findExternalOrigin(moduleGraph, getIssuerCompat(moduleGraph, issuer));
  }
  return issuer;
}

function getExternalModules({ compilation }) {
  const externals = new Set();
  for (const module of compilation.modules) {
    if (isExternalModule(module)) {
      externals.add({
        origin: _.get(
          findExternalOrigin(compilation.moduleGraph, getIssuerCompat(compilation.moduleGraph, module)),
          'rawRequest'
        ),
        external: getExternalModuleName(module)
      });
    }
  }
  return Array.from(externals);
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

    return _.map(stats, compileStats => ({
      outputPath: compileStats.compilation.compiler.outputPath,
      externalModules: getExternalModules(compileStats)
    }));
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
