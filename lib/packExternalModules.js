'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const isBuiltinModule = require('is-builtin-module');

const Packagers = require('./packagers');

function rebaseFileReferences(pathToPackageRoot, moduleVersion) {
  if (/^(?:file:[^/]{2}|\.\/|\.\.\/)/.test(moduleVersion)) {
    const filePath = _.replace(moduleVersion, /^file:/, '');
    return _.replace(`${_.startsWith(moduleVersion, 'file:') ? 'file:' : ''}${pathToPackageRoot}/${filePath}`, /\\/g, '/');
  }

  return moduleVersion;
}

/**
 * Add the given modules to a package json's dependencies.
 */
function addModulesToPackageJson(externalModules, packageJson, pathToPackageRoot) {
  _.forEach(externalModules, externalModule => {
    const splitModule = _.split(externalModule, '@');
    // If we have a scoped module we have to re-add the @
    if (_.startsWith(externalModule, '@')) {
      splitModule.splice(0, 1);
      splitModule[0] = '@' + splitModule[0];
    }
    let moduleVersion = _.join(_.tail(splitModule), '@');
    // We have to rebase file references to the target package.json
    moduleVersion = rebaseFileReferences(pathToPackageRoot, moduleVersion);
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies[_.first(splitModule)] = moduleVersion;
  });
}

/**
 * Remove a given list of excluded modules from a module list
 * @this - The active plugin instance
 */
function removeExcludedModules(modules, packageForceExcludes, log) {
  const excludedModules = _.remove(modules, externalModule => {   // eslint-disable-line lodash/prefer-immutable-method
    const splitModule = _.split(externalModule, '@');
    // If we have a scoped module we have to re-add the @
    if (_.startsWith(externalModule, '@')) {
      splitModule.splice(0, 1);
      splitModule[0] = '@' + splitModule[0];
    }
    const moduleName = _.first(splitModule);
    return _.includes(packageForceExcludes, moduleName);
  });

  if (log && !_.isEmpty(excludedModules)) {
    this.serverless.cli.log(`Excluding external modules: ${_.join(excludedModules, ', ')}`);
  }
}

/**
 * Resolve the needed versions of production dependencies for external modules.
 * @this - The active plugin instance
 */
function getProdModules(externalModules, packagePath, dependencyGraph, forceExcludes) {
  const packageJsonPath = path.join(process.cwd(), packagePath);
  const packageJson = require(packageJsonPath);
  const prodModules = [];

  // only process the module stated in dependencies section
  if (!packageJson.dependencies) {
    return [];
  }

  // Get versions of all transient modules
  _.forEach(externalModules, module => {
    let moduleVersion = packageJson.dependencies[module.external];

    if (moduleVersion) {
      prodModules.push(`${module.external}@${moduleVersion}`);

      // Check if the module has any peer dependencies and include them too
      try {
        const modulePackagePath = path.join(
          path.dirname(path.join(process.cwd(), packagePath)),
          'node_modules',
          module.external,
          'package.json'
        );
        const peerDependencies = require(modulePackagePath).peerDependencies;
        if (!_.isEmpty(peerDependencies)) {
          this.options.verbose && this.serverless.cli.log(`Adding explicit peers for dependency ${module.external}`);
          const peerModules = getProdModules.call(this, _.map(peerDependencies, (value, key) => ({ external: key })), packagePath, dependencyGraph, forceExcludes);
          Array.prototype.push.apply(prodModules, peerModules);
        }
      } catch (e) {
        this.serverless.cli.log(`WARNING: Could not check for peer dependencies of ${module.external}`);
      }
    } else {
      if (!packageJson.devDependencies || !packageJson.devDependencies[module.external]) {
        // Add transient dependencies if they appear not in the service's dev dependencies
        const originInfo = _.get(dependencyGraph, 'dependencies', {})[module.origin] || {};
        moduleVersion = _.get(_.get(originInfo, 'dependencies', {})[module.external], 'version');
        if (!moduleVersion) {
          this.serverless.cli.log(`WARNING: Could not determine version of module ${module.external}`);
        }
        prodModules.push(moduleVersion ? `${module.external}@${moduleVersion}` : module.external);
      } else if (packageJson.devDependencies && packageJson.devDependencies[module.external] && !_.includes(forceExcludes, module.external)) {
        // To minimize the chance of breaking setups we whitelist packages available on AWS here. These are due to the previously missing check
        // most likely set in devDependencies and should not lead to an error now.
        const ignoredDevDependencies = ['aws-sdk'];

        if (!_.includes(ignoredDevDependencies, module.external)) {
          // Runtime dependency found in devDependencies but not forcefully excluded
          this.serverless.cli.log(`ERROR: Runtime dependency '${module.external}' found in devDependencies. Move it to dependencies or use forceExclude to explicitly exclude it.`);
          throw new this.serverless.classes.Error(`Serverless-webpack dependency error: ${module.external}.`);
        }

        this.options.verbose && this.serverless.cli.log(`INFO: Runtime dependency '${module.external}' found in devDependencies. It has been excluded automatically.`);
      }
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

function getExternalModules(stats) {
  const externals = new Set();

  _.forEach(stats.compilation.chunks, chunk => {
    // Explore each module within the chunk (built inputs):
    chunk.forEachModule(module => {
      if (isExternalModule(module)) {
        externals.add({
          origin: _.get(findExternalOrigin(module.issuer), 'rawRequest'),
          external: getExternalModuleName(module)
        });
      }
    });
  });

  return Array.from(externals);
}

module.exports = {
  /**
   * We need a performant algorithm to install the packages for each single
   * function (in case we package individually).
   * (1) We fetch ALL packages needed by ALL functions in a first step
   * and use this as a base npm checkout. The checkout will be done to a
   * separate temporary directory with a package.json that contains everything.
   * (2) For each single compile we copy the whole node_modules to the compile
   * directory and create a (function) compile specific package.json and store
   * it in the compile directory. Now we start npm again there, and npm will just
   * remove the superfluous packages and optimize the remaining dependencies.
   * This will utilize the npm cache at its best and give us the needed results
   * and performance.
   */
  packExternalModules() {

    const stats = this.compileStats;

    const includes = this.configuration.includeModules;

    if (!includes) {
      return BbPromise.resolve();
    }

    // Read plugin configuration
    const packageForceIncludes = _.get(includes, 'forceInclude', []);
    const packageForceExcludes = _.get(includes, 'forceExclude', []);
    const packagePath = includes.packagePath || './package.json';
    const packageJsonPath = path.join(process.cwd(), packagePath);
    const packageScripts = _.reduce(this.configuration.packagerOptions.scripts || [], (__, script, index) => {
      __[`script${index}`] = script;
      return __;
    }, {});

    // Determine and create packager
    return BbPromise.try(() => Packagers.get.call(this, this.configuration.packager))
    .then(packager => {
      // Fetch needed original package.json sections
      const sectionNames = packager.copyPackageSectionNames;
      const packageJson = this.serverless.utils.readFileSync(packageJsonPath);
      const packageSections = _.pick(packageJson, sectionNames);
      if (!_.isEmpty(packageSections)) {
        this.options.verbose && this.serverless.cli.log(`Using package.json sections ${_.join(_.keys(packageSections), ', ')}`);
      }

      // Get first level dependency graph
      this.options.verbose && this.serverless.cli.log(`Fetch dependency graph from ${packageJsonPath}`);

      return packager.getProdDependencies(path.dirname(packageJsonPath), 1)
      .then(dependencyGraph => {
        const problems = _.get(dependencyGraph, 'problems', []);
        if (this.options.verbose && !_.isEmpty(problems)) {
          this.serverless.cli.log(`Ignoring ${_.size(problems)} NPM errors:`);
          _.forEach(problems, problem => {
            this.serverless.cli.log(`=> ${problem}`);
          });
        }
  
        // (1) Generate dependency composition
        const compositeModules = _.uniq(_.flatMap(stats.stats, compileStats => {
          const externalModules = _.concat(
            getExternalModules.call(this, compileStats),
            _.map(packageForceIncludes, whitelistedPackage => ({ external: whitelistedPackage }))
          );
          return getProdModules.call(this, externalModules, packagePath, dependencyGraph, packageForceExcludes);
        }));
        removeExcludedModules.call(this, compositeModules, packageForceExcludes, true);
  
        if (_.isEmpty(compositeModules)) {
          // The compiled code does not reference any external modules at all
          this.serverless.cli.log('No external modules needed');
          return BbPromise.resolve();
        }
  
        // (1.a) Install all needed modules
        const compositeModulePath = path.join(this.webpackOutputPath, 'dependencies');
        const compositePackageJson = path.join(compositeModulePath, 'package.json');
  
        // (1.a.1) Create a package.json
        const compositePackage = _.defaults({
          name: this.serverless.service.service,
          version: '1.0.0',
          description: `Packaged externals for ${this.serverless.service.service}`,
          private: true,
          scripts: packageScripts
        }, packageSections);
        const relPath = path.relative(compositeModulePath, path.dirname(packageJsonPath));
        addModulesToPackageJson(compositeModules, compositePackage, relPath);
        this.serverless.utils.writeFileSync(compositePackageJson, JSON.stringify(compositePackage, null, 2));
  
        // (1.a.2) Copy package-lock.json if it exists, to prevent unwanted upgrades
        const packageLockPath = path.join(path.dirname(packageJsonPath), packager.lockfileName);
        let hasPackageLock = false;
        return BbPromise.fromCallback(cb => fse.pathExists(packageLockPath, cb))
        .then(exists => {
          if (exists) {
            this.serverless.cli.log('Package lock found - Using locked versions');
            try {
              let packageLockFile = this.serverless.utils.readFileSync(packageLockPath);
              packageLockFile = packager.rebaseLockfile(relPath, packageLockFile);
              if (_.isObject(packageLockFile)) {
                packageLockFile = JSON.stringify(packageLockFile, null, 2);
              }
  
              this.serverless.utils.writeFileSync(path.join(compositeModulePath, packager.lockfileName), packageLockFile);
              hasPackageLock = true;
            } catch(err) {
              this.serverless.cli.log(`Warning: Could not read lock file: ${err.message}`);
            }
          }
          return BbPromise.resolve();
        })
        .then(() => {
          const start = _.now();
          this.serverless.cli.log('Packing external modules: ' + compositeModules.join(', '));
          return packager.install(compositeModulePath, this.configuration.packagerOptions)
          .then(() => this.options.verbose && this.serverless.cli.log(`Package took [${_.now() - start} ms]`))
          .return(stats.stats);
        })
        .mapSeries(compileStats => {
          const modulePath = compileStats.compilation.compiler.outputPath;
  
          // Create package.json
          const modulePackageJson = path.join(modulePath, 'package.json');
          const modulePackage = _.defaults({
            name: this.serverless.service.service,
            version: '1.0.0',
            description: `Packaged externals for ${this.serverless.service.service}`,
            private: true,
            scripts: packageScripts,
            dependencies: {}
          }, packageSections);
          const prodModules = getProdModules.call(this,
            _.concat(
              getExternalModules.call(this, compileStats),
              _.map(packageForceIncludes, whitelistedPackage => ({ external: whitelistedPackage }))
            ), packagePath, dependencyGraph, packageForceExcludes);
          removeExcludedModules.call(this, prodModules, packageForceExcludes);
          const relPath = path.relative(modulePath, path.dirname(packageJsonPath));
          addModulesToPackageJson(prodModules, modulePackage, relPath);
          this.serverless.utils.writeFileSync(modulePackageJson, JSON.stringify(modulePackage, null, 2));
  
          // GOOGLE: Copy modules only if not google-cloud-functions
          //         GCF Auto installs the package json
          if (_.get(this.serverless, 'service.provider.name') === 'google') {
            return BbPromise.resolve();
          }
  
          const startCopy = _.now();
          return BbPromise.try(() => {
            // Only copy dependency modules if demanded by packager
            if (packager.mustCopyModules) {
              return BbPromise.fromCallback(callback => fse.copy(path.join(compositeModulePath, 'node_modules'), path.join(modulePath, 'node_modules'), callback));
            }
            return BbPromise.resolve();
          })
          .then(() => hasPackageLock ?
            BbPromise.fromCallback(callback => fse.copy(path.join(compositeModulePath, packager.lockfileName), path.join(modulePath, packager.lockfileName), callback)) :
            BbPromise.resolve()
          )
          .tap(() => this.options.verbose && this.serverless.cli.log(`Copy modules: ${modulePath} [${_.now() - startCopy} ms]`))
          .then(() => {
            // Prune extraneous packages - removes not needed ones
            const startPrune = _.now();
            return packager.prune(modulePath, this.configuration.packagerOptions)
            .tap(() => this.options.verbose && this.serverless.cli.log(`Prune: ${modulePath} [${_.now() - startPrune} ms]`));
          })
          .then(() => {
            // Prune extraneous packages - removes not needed ones
            const startRunScripts = _.now();
            return packager.runScripts(modulePath, _.keys(packageScripts))
            .tap(() => this.options.verbose && this.serverless.cli.log(`Run scripts: ${modulePath} [${_.now() - startRunScripts} ms]`));
          });
        })
        .return();
      });
    });
  }
};
