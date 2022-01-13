'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const isBuiltinModule = require('is-builtin-module');
const logStats = require('./logStats');

function ensureArray(obj) {
  return _.isArray(obj) ? obj : [obj];
}

function getStatsLogger(statsConfig, consoleLog, { log, ServerlessError }) {
  return stats => {
    logStats(stats, statsConfig, consoleLog, { log, ServerlessError });
  };
}

function isIndividialPackaging() {
  return _.get(this.serverless, 'service.package.individually');
}

function getExternalModuleName(module) {
  const pathArray = /^external .*"(.*?)"$/.exec(module.identifier());
  if (!pathArray) {
    throw new Error(`Unable to extract module name from Webpack identifier: ${module.identifier()}`);
  }

  const path = pathArray[1];
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
 * Find if module exports are used. The ModuleGraph api does not exists in webpack@4
 * so falls back to using module.issuer
 * @param {Object} moduleGraph - Webpack module graph
 * @param {Object} module - Module
 */
function getUsedExportsCompat(moduleGraph, module) {
  if (moduleGraph) {
    return moduleGraph.getUsedExports(module);
  }

  return module.usedExports;
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

function isUsedExports(moduleGraph, module) {
  // set of used exports, or true (when namespace object is used), or false (when unused), or null (when unknown)
  // @see https://github.com/webpack/webpack/blob/896efde07d775043765a300961c8b932349254bb/lib/ExportsInfo.js#L463-L466
  const usedExports = getUsedExportsCompat(moduleGraph, module);

  // Only returns false when unused
  return usedExports !== false;
}

function getExternalModules({ compilation }) {
  const externals = new Set();
  for (const module of compilation.modules) {
    if (isExternalModule(module) && isUsedExports(compilation.moduleGraph, module)) {
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

    _.forEach(stats, logStats);

    return _.map(stats, compileStats => ({
      outputPath: compileStats.compilation.compiler.outputPath,
      externalModules: getExternalModules(compileStats)
    }));
  });
}

function webpackConcurrentCompile(configs, logStats, concurrency, ServerlessError) {
  const errors = [];
  return BbPromise.map(
    configs,
    config => {
      if (isIndividialPackaging.call(this) && _.get(config, 'cache.type') === 'filesystem') {
        const clonedConfig = _.clone(config);
        const entryFunc = _.find(this.entryFunctions, ['entry.key', _.keys(config.entry)[0]]);
        clonedConfig.cache.name = entryFunc.func.name;
        return webpackCompile(clonedConfig, logStats, ServerlessError).catch(error => {
          errors.push(error);
          return error.stats;
        });
      }
      return webpackCompile(config, logStats, ServerlessError).catch(error => {
        errors.push(error);
        return error.stats;
      });
    },
    { concurrency }
  ).then(stats => {
    if (errors.length) {
      if (!this.log) {
        if (errors.length === 1) {
          throw errors[0];
        }
        throw new ServerlessError('Webpack compilation errors, see stats above');
      }
      throw new ServerlessError(
        `Webpack compilation failed:\n\n${_.join(
          _.map(errors, error => error.message),
          '\n\n'
        )}`
      );
    }
    return _.flatten(stats);
  });
}

module.exports = {
  compile() {
    if (this.log) {
      this.log.verbose('[Webpack] Building with Webpack');
      this.progress.get('webpack').update('[Webpack] Building with Webpack');
    } else {
      this.serverless.cli.log('Bundling with Webpack...');
    }

    const configs = ensureArray(this.webpackConfig);
    if (configs[0] === undefined) {
      return BbPromise.reject('Unable to find Webpack configuration');
    }

    const logStats = getStatsLogger(configs[0].stats, this.serverless.cli.consoleLog, {
      log: this.log,
      ServerlessError: this.serverless.classes.Error
    });

    if (!this.configuration) {
      return BbPromise.reject(new this.serverless.classes.Error('Missing plugin configuration'));
    }
    const concurrency = this.configuration.concurrency;

    return webpackConcurrentCompile
      .call(this, configs, logStats, concurrency, this.serverless.classes.Error)
      .then(stats => {
        this.compileStats = { stats };
        return BbPromise.resolve();
      });
  }
};
