'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const findWorkspaceRoot = require('find-yarn-workspace-root');

const Packagers = require('./packagers');
const { isProviderGoogle } = require('./utils');

function rebaseFileReferences(pathToPackageRoot, moduleVersion) {
  if (/^(?:file:[^/]{2}|\.\/|\.\.\/)/.test(moduleVersion)) {
    const filePath = _.replace(moduleVersion, /^file:/, '');
    return _.replace(
      `${_.startsWith(moduleVersion, 'file:') ? 'file:' : ''}${pathToPackageRoot}/${filePath}`,
      /\\/g,
      '/'
    );
  }

  return moduleVersion;
}

/**
 * Add the given modules to a package json's dependencies.
 */
function addModulesToPackageJson(externalModules, packageJson, pathToPackageRoot) {
  _.forEach(externalModules.sort(), externalModule => {
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
  // eslint-disable-next-line lodash/prefer-immutable-method
  const excludedModules = _.remove(modules, externalModule => {
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
    if (this.log) {
      this.log(`Excluding external modules: ${_.join(excludedModules, ', ')}`);
    } else {
      this.serverless.cli.log(`Excluding external modules: ${_.join(excludedModules, ', ')}`);
    }
  }
}

/**
 * Resolve the needed versions of production dependencies for external modules.
 * @this - The active plugin instance
 */
function getProdModules(externalModules, packagePath, nodeModulesRelativeDir, dependencyGraph, forceExcludes) {
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

      let nodeModulesBase = path.join(path.dirname(path.join(process.cwd(), packagePath)), 'node_modules');

      if (nodeModulesRelativeDir) {
        const customNodeModulesDir = path.join(process.cwd(), nodeModulesRelativeDir, 'node_modules');

        if (fse.pathExistsSync(customNodeModulesDir)) {
          nodeModulesBase = customNodeModulesDir;
        } else {
          if (this.log) {
            this.log.warning(`${customNodeModulesDir} dose not exist. Please check nodeModulesRelativeDir setting`);
          } else {
            this.serverless.cli.log(
              `WARNING: ${customNodeModulesDir} dose not exist. Please check nodeModulesRelativeDir setting`
            );
          }
        }
      }

      // Check if the module has any peer dependencies and include them too
      try {
        const modulePackagePath = path.join(nodeModulesBase, module.external, 'package.json');

        const peerDependencies = require(modulePackagePath).peerDependencies;
        if (!_.isEmpty(peerDependencies)) {
          if (this.log) {
            this.log.verbose(`Adding explicit peers for dependency ${module.external}`);
          } else {
            this.options.verbose && this.serverless.cli.log(`Adding explicit peers for dependency ${module.external}`);
          }

          const peerDependenciesMeta = require(modulePackagePath).peerDependenciesMeta;

          if (!_.isEmpty(peerDependenciesMeta)) {
            _.forEach(peerDependencies, (value, key) => {
              if (peerDependenciesMeta[key] && peerDependenciesMeta[key].optional === true) {
                if (this.log) {
                  this.log.verbose(
                    `Skipping peers dependency ${key} for dependency ${module.external} because it's optional`
                  );
                } else {
                  this.options.verbose &&
                    this.serverless.cli.log(
                      `Skipping peers dependency ${key} for dependency ${module.external} because it's optional`
                    );
                }
                _.unset(peerDependencies, key);
              }
            });
          }

          if (!_.isEmpty(peerDependencies)) {
            const peerModules = getProdModules.call(
              this,
              _.map(peerDependencies, (value, key) => ({ external: key })),
              packagePath,
              nodeModulesRelativeDir,
              dependencyGraph,
              forceExcludes
            );
            Array.prototype.push.apply(prodModules, peerModules);
          }
        }
      } catch (e) {
        if (this.log) {
          this.log.warning(
            `Could not check for peer dependencies of ${module.external}. Set nodeModulesRelativeDir if node_modules is in different directory.`
          );
        } else {
          this.serverless.cli.log(
            `WARNING: Could not check for peer dependencies of ${module.external}. Set nodeModulesRelativeDir if node_modules is in different directory.`
          );
        }
      }
    } else {
      if (!packageJson.devDependencies || !packageJson.devDependencies[module.external]) {
        // Add transient dependencies if they appear not in the service's dev dependencies
        const originInfo = _.get(dependencyGraph, 'dependencies', {})[module.origin] || {};
        moduleVersion = _.get(_.get(originInfo, 'dependencies', {})[module.external], 'version');
        if (!moduleVersion) {
          // eslint-disable-next-line lodash/path-style
          moduleVersion = _.get(dependencyGraph, ['dependencies', module.external, 'version']);
        }
        if (!moduleVersion) {
          if (this.log) {
            this.log.warning(`Could not determine version of module ${module.external}`);
          } else {
            this.serverless.cli.log(`WARNING: Could not determine version of module ${module.external}`);
          }
        }
        prodModules.push(moduleVersion ? `${module.external}@${moduleVersion}` : module.external);
      } else if (
        packageJson.devDependencies &&
        packageJson.devDependencies[module.external] &&
        !_.includes(forceExcludes, module.external)
      ) {
        // To minimize the chance of breaking setups we whitelist packages available on AWS here. These are due to the previously missing check
        // most likely set in devDependencies and should not lead to an error now.
        const ignoredDevDependencies = ['aws-sdk'];

        if (!_.includes(ignoredDevDependencies, module.external)) {
          // Runtime dependency found in devDependencies but not forcefully excluded
          if (this.log) {
            this.log.error(
              `Runtime dependency '${module.external}' found in devDependencies. Move it to dependencies or use forceExclude to explicitly exclude it.`
            );
          } else {
            this.serverless.cli.log(
              `ERROR: Runtime dependency '${module.external}' found in devDependencies. Move it to dependencies or use forceExclude to explicitly exclude it.`
            );
          }
          throw new this.serverless.classes.Error(`Serverless-webpack dependency error: ${module.external}.`);
        }
        if (this.log) {
          this.log.verbose(
            `Runtime dependency '${module.external}' found in devDependencies. It has been excluded automatically.`
          );
        } else {
          this.options.verbose &&
            this.serverless.cli.log(
              `INFO: Runtime dependency '${module.external}' found in devDependencies. It has been excluded automatically.`
            );
        }
      }
    }
  });

  return prodModules;
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
    if (this.skipCompile) {
      return BbPromise.resolve();
    }

    const stats = this.compileStats;

    const includes = this.configuration.includeModules;

    if (!includes) {
      return BbPromise.resolve();
    }
    if (this.log) {
      this.log.verbose('Packing external modules');
      this.progress.get('webpack').notice('[Webpack] Packing external modules');
    }

    // Read plugin configuration
    const packageForceIncludes = _.get(includes, 'forceInclude', []);
    const packageForceExcludes = _.get(includes, 'forceExclude', []);
    const packagePath = includes.packagePath || './package.json';
    const nodeModulesRelativeDir = includes.nodeModulesRelativeDir;
    const packageJsonPath = path.join(process.cwd(), packagePath);
    const packageScripts = _.reduce(
      this.configuration.packagerOptions.scripts || [],
      (__, script, index) => {
        __[`script${index}`] = script;
        return __;
      },
      {}
    );

    // Determine and create packager
    return BbPromise.try(() => Packagers.get.call(this, this.configuration.packager)).then(packager => {
      // Fetch needed original package.json sections
      const sectionNames = packager.copyPackageSectionNames(this.configuration.packagerOptions);
      const packageJson = this.serverless.utils.readFileSync(packageJsonPath);
      const packageSections = _.pick(packageJson, sectionNames);
      if (!_.isEmpty(packageSections)) {
        if (this.log) {
          this.log.verbose(`Using package.json sections ${_.join(_.keys(packageSections), ', ')}`);
        } else {
          this.options.verbose &&
            this.serverless.cli.log(`Using package.json sections ${_.join(_.keys(packageSections), ', ')}`);
        }
      }

      // Get first level dependency graph
      if (this.log) {
        this.log.verbose(`Fetch dependency graph from ${packageJsonPath}`);
      } else {
        this.options.verbose && this.serverless.cli.log(`Fetch dependency graph from ${packageJsonPath}`);
      }

      return packager
        .getProdDependencies(path.dirname(packageJsonPath), 1, this.configuration.packagerOptions)
        .then(dependencyGraph => {
          const problems = _.get(dependencyGraph, 'problems', []);
          if (this.options.verbose && !_.isEmpty(problems)) {
            if (this.log) {
              this.log.verbose(`Ignoring ${_.size(problems)} NPM errors:`);
            } else {
              this.serverless.cli.log(`Ignoring ${_.size(problems)} NPM errors:`);
            }
            _.forEach(problems, problem => {
              if (this.log) {
                this.log.verbose(`=> ${problem}`);
              } else {
                this.serverless.cli.log(`=> ${problem}`);
              }
            });
          }

          // (1) Generate dependency composition
          const compositeModules = _.uniq(
            _.flatMap(stats.stats, compileStats => {
              const externalModules = _.concat(
                compileStats.externalModules,
                _.map(packageForceIncludes, whitelistedPackage => ({
                  external: whitelistedPackage
                }))
              );
              return getProdModules.call(
                this,
                externalModules,
                packagePath,
                nodeModulesRelativeDir,
                dependencyGraph,
                packageForceExcludes
              );
            })
          );
          removeExcludedModules.call(this, compositeModules, packageForceExcludes, true);

          if (_.isEmpty(compositeModules)) {
            // The compiled code does not reference any external modules at all
            if (this.log) {
              this.log('No external modules needed');
            } else {
              this.serverless.cli.log('No external modules needed');
            }
            return BbPromise.resolve();
          }

          // (1.a) Install all needed modules
          const compositeModulePath = path.join(this.webpackOutputPath, 'dependencies');
          const compositePackageJson = path.join(compositeModulePath, 'package.json');

          // (1.a.1) Create a package.json
          const compositePackage = _.defaults(
            {
              name: this.serverless.service.service,
              version: '1.0.0',
              description: `Packaged externals for ${this.serverless.service.service}`,
              private: true,
              scripts: packageScripts
            },
            packageSections
          );
          const relPath = path.relative(compositeModulePath, path.dirname(packageJsonPath));
          addModulesToPackageJson(compositeModules, compositePackage, relPath);
          this.serverless.utils.writeFileSync(compositePackageJson, JSON.stringify(compositePackage, null, 2));

          // (1.a.2) Copy package-lock.json if it exists, to prevent unwanted upgrades
          const packagerOptions = this.configuration.packagerOptions || {};
          const packageLockPath = path.join(
            findWorkspaceRoot(path.dirname(packageJsonPath)) || path.dirname(packageJsonPath),
            packagerOptions.lockFile || packager.lockfileName
          );
          let hasPackageLock = false;
          return BbPromise.fromCallback(cb => fse.pathExists(packageLockPath, cb))
            .then(exists => {
              if (exists) {
                if (this.log) {
                  this.log('Package lock found - Using locked versions');
                } else {
                  this.serverless.cli.log('Package lock found - Using locked versions');
                }
                try {
                  let packageLockFile = this.serverless.utils.readFileSync(packageLockPath);
                  packageLockFile = packager.rebaseLockfile(relPath, packageLockFile);
                  if (_.isObject(packageLockFile)) {
                    packageLockFile = JSON.stringify(packageLockFile, null, 2);
                  }

                  this.serverless.utils.writeFileSync(
                    path.join(compositeModulePath, packager.lockfileName),
                    packageLockFile
                  );
                  hasPackageLock = true;
                } catch (err) {
                  if (this.log) {
                    this.log.warning(`Could not read lock file: ${err.message}`);
                  } else {
                    this.serverless.cli.log(`Warning: Could not read lock file: ${err.message}`);
                  }
                }
              }
              return BbPromise.resolve();
            })
            .then(() => {
              const start = _.now();
              if (this.log) {
                this.log('Packing external modules: ' + compositeModules.join(', '));
              } else {
                this.serverless.cli.log('Packing external modules: ' + compositeModules.join(', '));
              }

              return packager.getPackagerVersion(compositeModulePath).then(version => {
                return packager
                  .install(compositeModulePath, this.configuration.packagerOptions, version)
                  .then(() => {
                    if (this.log) {
                      this.log.verbose(`Package took [${_.now() - start} ms]`);
                    } else {
                      this.options.verbose && this.serverless.cli.log(`Package took [${_.now() - start} ms]`);
                    }
                    return null;
                  })
                  .return(stats.stats);
              });
            })
            .mapSeries(compileStats => {
              const modulePath = compileStats.outputPath;

              // Create package.json
              const modulePackageJson = path.join(modulePath, 'package.json');
              const modulePackage = _.defaults(
                {
                  name: this.serverless.service.service,
                  version: '1.0.0',
                  description: `Packaged externals for ${this.serverless.service.service}`,
                  private: true,
                  scripts: packageScripts,
                  dependencies: {}
                },
                packageSections
              );
              const prodModules = getProdModules.call(
                this,
                _.concat(
                  compileStats.externalModules,
                  _.map(packageForceIncludes, whitelistedPackage => ({
                    external: whitelistedPackage
                  }))
                ),
                packagePath,
                nodeModulesRelativeDir,
                dependencyGraph,
                packageForceExcludes
              );
              removeExcludedModules.call(this, prodModules, packageForceExcludes);
              const relPath = path.relative(modulePath, path.dirname(packageJsonPath));
              addModulesToPackageJson(prodModules, modulePackage, relPath);
              this.serverless.utils.writeFileSync(modulePackageJson, JSON.stringify(modulePackage, null, 2));

              // GOOGLE: Copy modules only if not google-cloud-functions
              //         GCF Auto installs the package json
              if (isProviderGoogle(this.serverless)) {
                return BbPromise.resolve();
              }

              const startCopy = _.now();
              return BbPromise.try(() => {
                // Only copy dependency modules if demanded by packager
                if (packager.mustCopyModules) {
                  return BbPromise.fromCallback(callback =>
                    fse.copy(
                      path.join(compositeModulePath, 'node_modules'),
                      path.join(modulePath, 'node_modules'),
                      callback
                    )
                  );
                }
                return BbPromise.resolve();
              })
                .then(() =>
                  hasPackageLock
                    ? BbPromise.fromCallback(callback =>
                        fse.copy(
                          path.join(compositeModulePath, packager.lockfileName),
                          path.join(modulePath, packager.lockfileName),
                          callback
                        )
                      )
                    : BbPromise.resolve()
                )
                .tap(() => {
                  if (this.log) {
                    this.log.verbose(`Copy modules: ${modulePath} [${_.now() - startCopy} ms]`);
                  } else {
                    this.options.verbose &&
                      this.serverless.cli.log(`Copy modules: ${modulePath} [${_.now() - startCopy} ms]`);
                  }
                })
                .then(() => {
                  // Prune extraneous packages - removes not needed ones
                  const startPrune = _.now();
                  return packager.getPackagerVersion(modulePath).then(version => {
                    return packager.prune(modulePath, this.configuration.packagerOptions, version).tap(() => {
                      if (this.log) {
                        this.log.verbose(`Prune: ${modulePath} [${_.now() - startPrune} ms]`);
                      } else {
                        this.options.verbose &&
                          this.serverless.cli.log(`Prune: ${modulePath} [${_.now() - startPrune} ms]`);
                      }
                    });
                  });
                })
                .then(() => {
                  // Prune extraneous packages - removes not needed ones
                  const startRunScripts = _.now();
                  return packager.runScripts(modulePath, _.keys(packageScripts)).tap(() => {
                    if (this.log) {
                      this.log.verbose(`Run scripts: ${modulePath} [${_.now() - startRunScripts} ms]`);
                    } else {
                      this.options.verbose &&
                        this.serverless.cli.log(`Run scripts: ${modulePath} [${_.now() - startRunScripts} ms]`);
                    }
                  });
                });
            })
            .return();
        });
    });
  }
};
