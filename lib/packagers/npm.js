'use strict';
/**
 * NPM packager.
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const Utils = require('../utils');
const { join } = require('path');
const fse = require('fs-extra');
const fs = require('fs');

class NPM {
  // eslint-disable-next-line lodash/prefer-constant
  static get lockfileName() {
    return 'package-lock.json';
  }

  static get copyPackageSectionNames() {
    return [];
  }

  // eslint-disable-next-line lodash/prefer-constant
  static get mustCopyModules() {
    return true;
  }

  static getProdDependencies(cwd, depth, packagerOptions) {
    // Try to use NPM lockfile v2 when possible
    const options = packagerOptions || {};
    const lockPath = join(cwd, options.lockFile || NPM.lockfileName);
    if (fse.pathExistsSync(lockPath)) {
      const lock = Utils.safeJsonParse(fs.readFileSync(lockPath));
      if (lock.lockfileVersion === 2) {
        return BbPromise.resolve(lock);
      }
    }

    // Get first level dependency graph
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = [
      'ls',
      '-prod', // Only prod dependencies
      '-json',
      `-depth=${depth || 1}`
    ];

    const ignoredNpmErrors = [
      { npmError: 'code ELSPROBLEMS', log: false }, // npm >= 7
      { npmError: 'extraneous', log: false },
      { npmError: 'missing', log: false },
      { npmError: 'peer dep missing', log: true }
    ];

    return Utils.spawnProcess(command, args, {
      cwd: cwd
    })
      .catch(err => {
        if (err instanceof Utils.SpawnError) {
          // Only exit with an error if we have critical npm errors for 2nd level inside
          // ignoring any extra output from npm >= 7
          const lines = _.split(err.stderr, '\n');
          const errors = _.takeWhile(lines, line => line !== '{');
          const failed = _.reduce(
            errors,
            (failed, error) => {
              if (failed) {
                return true;
              }
              return (
                !_.isEmpty(error) &&
                !_.some(ignoredNpmErrors, ignoredError => _.startsWith(error, `npm ERR! ${ignoredError.npmError}`))
              );
            },
            false
          );

          if (!failed && !_.isEmpty(err.stdout)) {
            return BbPromise.resolve({ stdout: err.stdout });
          }
        }

        return BbPromise.reject(err);
      })
      .then(processOutput => processOutput.stdout)
      .then(depJson => BbPromise.try(() => JSON.parse(depJson)));
  }

  static _rebaseFileReferences(pathToPackageRoot, moduleVersion) {
    if (/^file:[^/]{2}/.test(moduleVersion)) {
      const filePath = _.replace(moduleVersion, /^file:/, '');
      return _.replace(`file:${pathToPackageRoot}/${filePath}`, /\\/g, '/');
    }

    return moduleVersion;
  }

  /**
   * We should not be modifying 'package-lock.json'
   * because this file should be treated as internal to npm.
   *
   * Rebase package-lock is a temporary workaround and must be
   * removed as soon as https://github.com/npm/npm/issues/19183 gets fixed.
   */
  static rebaseLockfile(pathToPackageRoot, lockfile) {
    if (lockfile.version) {
      lockfile.version = NPM._rebaseFileReferences(pathToPackageRoot, lockfile.version);
    }

    if (lockfile.dependencies) {
      _.forIn(lockfile.dependencies, lockedDependency => {
        NPM.rebaseLockfile(pathToPackageRoot, lockedDependency);
      });
    }

    return lockfile;
  }

  static install(cwd, packagerOptions) {
    if (packagerOptions.noInstall) {
      return BbPromise.resolve();
    }

    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['install'];

    return Utils.spawnProcess(command, args, { cwd }).return();
  }

  static prune(cwd) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['prune'];

    return Utils.spawnProcess(command, args, { cwd }).return();
  }

  static runScripts(cwd, scriptNames) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    return BbPromise.mapSeries(scriptNames, scriptName => {
      const args = ['run', scriptName];

      return Utils.spawnProcess(command, args, { cwd });
    }).return();
  }
}

module.exports = NPM;
