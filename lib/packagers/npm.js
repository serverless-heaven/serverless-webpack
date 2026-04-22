/**
 * NPM packager.
 */

const _ = require('lodash');
const Utils = require('../utils');
const { join } = require('node:path');
const fse = require('fs-extra');
const fs = require('node:fs');

class NPM {
  static get lockfileName() {
    return 'package-lock.json';
  }

  static get mustCopyModules() {
    return true;
  }

  static copyPackageSectionNames(packagerOptions) {
    const options = packagerOptions || {};
    return options.copyPackageSectionNames || [];
  }

  static async getPackagerVersion(cwd) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['-v'];

    try {
      const processOutput = await Utils.spawnProcess(command, args, { cwd });
      return processOutput.stdout;
    } catch (err) {
      return err.stdout;
    }
  }

  static async getProdDependencies(cwd, depth, packagerOptions) {
    // Try to use NPM lockfile v2 when possible
    const options = packagerOptions || {};
    const lockPath = join(cwd, options.lockFile || NPM.lockfileName);
    if (fse.pathExistsSync(lockPath)) {
      const lock = Utils.safeJsonParse(fs.readFileSync(lockPath, 'utf8'));
      if (lock && lock.lockfileVersion === 2) {
        return lock;
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

    let depJson;

    try {
      const processOutput = await Utils.spawnProcess(command, args, {
        cwd: cwd
      });
      depJson = processOutput.stdout;
    } catch (err) {
      if (err instanceof Utils.SpawnError) {
        // Only exit with an error if we have critical npm errors for 2nd level inside
        // ignoring any extra output from npm >= 7
        const lines = _.split(err.stderr, '\n');
        const errors = _.takeWhile(lines, line => line !== '{');
        const failed = _.reduce(
          errors,
          (hasFailed, error) => {
            if (hasFailed) {
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
          depJson = err.stdout;
        } else {
          if (process.env.SLS_DEBUG) {
            console.error(`DEBUG: ${err.stdout}\nSTDERR: ${err.stderr}`);
          }
          throw err;
        }
      } else {
        throw err;
      }
    }

    return JSON.parse(depJson);
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

  static async install(cwd, packagerOptions) {
    if (packagerOptions.noInstall) {
      return;
    }

    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['install'];

    if (packagerOptions.ignoreScripts) {
      args.push('--ignore-scripts');
    }

    await Utils.spawnProcess(command, args, { cwd });
  }

  static async prune(cwd) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    const args = ['prune'];

    await Utils.spawnProcess(command, args, { cwd });
  }

  static async runScripts(cwd, scriptNames) {
    const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
    for (const scriptName of scriptNames) {
      const args = ['run', scriptName];
      await Utils.spawnProcess(command, args, { cwd });
    }
  }
}

module.exports = NPM;
