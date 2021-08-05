'use strict';

const _ = require('lodash');
const webpack = require('webpack');
const BbPromise = require('bluebird');
const path = require('path');
const rechoir = require('rechoir');
const interpret = require('interpret');
const tty = require('tty');
const isBuiltinModule = require('is-builtin-module');
const log = require('@serverless/utils/log');
const lib = require('./index');

const defaultStatsConfig = {
  colors: tty.isatty(process.stdout.fd),
  hash: false,
  version: false,
  chunks: false,
  children: false
};

function getStatsLogger(statsConfig) {
  return stats => {
    const statsOutput = stats.toString(statsConfig || defaultStatsConfig);
    if (statsOutput) {
      console.log(statsOutput);
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

async function webpackCompile({
  webpackConfigFilePath,
  configOverrides,
  options,
  entries,
  serverless,
  webpack: libWebpack
}) {
  const functionName = configOverrides.output.path.split(path.sep).pop();
  log(`Start compiling ${functionName}`);

  // Setup globals for webpack config.
  lib.options = options;
  lib.entries = entries;
  lib.serverless = serverless;
  lib.webpack = libWebpack;

  rechoir.prepare(
    {
      ...interpret.extensions,
      ..._.mapKeys(interpret.extensions, (value, key) => `.config${key}`)
    },
    webpackConfigFilePath
  );

  let webpackConfig = require(webpackConfigFilePath);
  if (webpackConfig.default) {
    webpackConfig = webpackConfig.default;
  }
  if (_.isFunction(webpackConfig.then)) {
    webpackConfig = await webpackConfig;
  }
  const config = { ...webpackConfig, ...configOverrides };
  const logStats = getStatsLogger(config.stats);
  let stats = await BbPromise.fromCallback(cb => webpack(config).run(cb));
  // ensure stats in any array in the case of concurrent build.
  stats = stats.stats ? stats.stats : [stats];

  _.forEach(stats, compileStats => {
    logStats(compileStats);
    if (compileStats.hasErrors()) {
      throw new Error('Webpack compilation error, see stats above');
    }
  });

  log(`Finished compiling ${functionName}`);

  return _.map(stats, compileStats => ({
    outputPath: compileStats.compilation.compiler.outputPath,
    externalModules: getExternalModules(compileStats)
  }));
}

module.exports = { compile: webpackCompile };
