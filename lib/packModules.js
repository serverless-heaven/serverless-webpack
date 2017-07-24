'use strict';

const BbPromise = require('bluebird');
const fs = require('fs');
const path = require('path');
const npm = require('npm-programmatic');

function getModules(packagePath) {

  const packageJson = require(path.join(process.cwd(), packagePath));

  const modules = [];

  // only process the module stated in dependencies section
  if (!packageJson.dependencies) {
    return []
  }

  Object.keys(packageJson.dependencies).forEach(module => {
    const moduleVersion = packageJson.dependencies[module];

    if (moduleVersion) {
      modules.push(`${module}@${moduleVersion}`);
    }
  });

  return modules;
}

module.exports = {
  packModules() {

    const includes = (
      this.serverless.service.custom &&
      this.serverless.service.custom.webpackIncludeModules
    );

    return BbPromise.resolve().then(() => {

      if (!includes) {
        return;
      }

      const packagePath = includes.packagePath || './package.json';

      // this plugin will only install modules stated in dependencies section of package.json
      const modules = getModules(packagePath);

      if (modules.length === 0) {
        return;
      }

      this.serverless.cli.log('Packing modules: ' + modules.join(", "));

      const tmpPackageJson = path.join(this.serverless.config.servicePath, 'package.json');

      // create a temp package.json in dist directory so that we can install the dependencies later.
      fs.writeFileSync(tmpPackageJson, "{}");

      return new BbPromise((resolve, reject) => {
        npm.install(modules, {
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
