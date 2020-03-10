'use strict';

const _ = require('lodash');
const isBuiltinModule = require('is-builtin-module');

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
 * Find the original module that required the transient dependency. Returns
 * undefined if the module is a first level dependency.
 * @param {Object} issuer - Module issuer
 */
function findExternalOrigin(issuer) {
  if (!_.isNil(issuer) && _.startsWith(issuer.rawRequest, './')) {
    return findExternalOrigin(issuer.issuer);
  }
  return issuer;
}

function getExternalModules(chunks) {
  if (!chunks) {
    return [];
  }
  const externals = new Set();
  for (const chunk of chunks) {
    if (!chunk.modules) {
      continue;
    }

    // Explore each module within the chunk (built inputs):
    for (const module of chunk.modulesIterable) {
      if (isExternalModule(module)) {
        externals.add({
          origin: _.get(findExternalOrigin(module.issuer), 'rawRequest'),
          external: getExternalModuleName(module)
        });
      }
    }
  }
  return Array.from(externals);
}

module.exports = {
  processWebpackStats(stats, consoleOptions) {
    const chunks = stats.compilation.chunks;
    const externalModules = getExternalModules(chunks);

    const normalizedStats = stats.toJson('normal');
    const cliOutput = stats.toString(consoleOptions);

    return {
      cliOutput,
      outputPath: normalizedStats.outputPath,
      errors: normalizedStats.errors,

      externalModules
    };
  }
};
