'use strict';

const BbPromise = require('bluebird');
const fs = require('fs');
const path = require('path');
const npm = require('npm-programmatic');

function getProdModules(externalModules, packagePath) {

  const packageJson = require(path.join(process.cwd(), packagePath));

  const prodModules = [];

  // only process the module stated in dependencies section
  if (!packageJson.dependencies) {
    return []
  }

  externalModules.forEach(module => {

    const moduleVersion = packageJson.dependencies[module];

    if (moduleVersion) {
      prodModules.push(`${module}@${moduleVersion}`);
    }
  });

  return prodModules;
}

function getExternalModuleName(module) {

  const path = /^external "(.*)"$/.exec(module.identifier())[1];


  const pathComponents = path.split('/');

  const main = pathComponents[0];

  // this is a package within a namespace
  if (main.charAt(0) == '@') {
    return `${main}/${pathComponents[1]}`
  }

  return main
}

function isExternalModule(module) {
  return module.identifier().indexOf('external ') === 0;
}

function getExternalModules(stats) {

  const externals = new Set();

  stats.compilation.chunks.forEach(function(chunk) {
    // Explore each module within the chunk (built inputs):
    chunk.modules.forEach(function(module) {
      // Explore each source file path that was included into the module:
      if (isExternalModule(module)) {
        externals.add(getExternalModuleName(module));
      }
    });
  });

  return Array.from(externals);
}

module.exports = {
  packExternalModules(stats) {

    const includes = (
      this.serverless.service.custom &&
      this.serverless.service.custom.webpackIncludeModules
    );

    return BbPromise.resolve().then(() => {

      if (!includes) {
        return;
      }

      const packagePath = includes.packagePath || './package.json';

      const externalModules = getExternalModules(stats);

      // this plugin will only install modules stated in dependencies section of package.json
      const prodModules = getProdModules(externalModules, packagePath);

      if (prodModules.length === 0) {
        return;
      }

      this.serverless.cli.log('Packing external modules: ' + prodModules.join(", "));

      const tmpPackageJson = path.join(this.serverless.config.servicePath, 'package.json');
    
      // create a temp package.json in dist directory so that we can install the dependencies later.
      fs.writeFileSync(tmpPackageJson, "{}");

      return new BbPromise((resolve, reject) => {
        npm.install(prodModules, {
          cwd: this.serverless.config.servicePath,
          save: true
        }).then(() => {
          // fs.unlink(tmpPackageJson);
          resolve()
        }).catch(e => {
          // fs.unlink(tmpPackageJson);
          reject(e);
        })
      })
    });
  }
};
