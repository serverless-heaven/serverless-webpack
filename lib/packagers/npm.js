'use strict';
/**
 * NPM packager.
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const childProcess = require('child_process');

class NPM {
  static get lockfileName() {  // eslint-disable-line lodash/prefer-constant
    return 'package-lock.json';
  }

  static get mustCopyModules() {  // eslint-disable-line lodash/prefer-constant
    return true;
  }

  static getProdDependencies(cwd, depth, maxExecBufferSize) {
    // Get first level dependency graph
    const command = `npm ls -prod -json -depth=${depth || 1}`;  // Only prod dependencies

    const ignoredNpmErrors = [
      { npmError: 'extraneous', log: false },
      { npmError: 'missing', log: false },
      { npmError: 'peer dep missing', log: true },
    ];

    return BbPromise.fromCallback(cb => {
      childProcess.exec(command, {
        cwd: cwd,
        maxBuffer: maxExecBufferSize,
        encoding: 'utf8'
      }, (err, stdout, stderr) => {
        if (err) {
          // Only exit with an error if we have critical npm errors for 2nd level inside
          const errors = _.split(stderr, '\n');
          const failed = _.reduce(errors, (failed, error) => {
            if (failed) {
              return true;
            }
            return !_.isEmpty(error) && !_.some(ignoredNpmErrors, ignoredError => _.startsWith(error, `npm ERR! ${ignoredError.npmError}`));
          }, false);

          if (failed) {
            return cb(err);
          }
        }
        return cb(null, stdout);
      });
    })
    .then(depJson => BbPromise.try(() => JSON.parse(depJson)));
  }

  static _rebaseFileReferences(pathToPackageRoot, moduleVersion) {
    if (/^file:[^/]{2}/.test(moduleVersion)) {
      const filePath = _.replace(moduleVersion, /^file:/, '');
      return _.replace(`file:${pathToPackageRoot}/${filePath}`, /\\/g, '/');
    }
  
    return moduleVersion;
  }
  
  static rebaseLockfile(pathToPackageRoot, lockfile) {
    if (lockfile.version) {
      lockfile.version = NPM._rebaseFileReferences(pathToPackageRoot, lockfile.version);
    }
  
    if (lockfile.dependencies) {
      _.forIn(lockfile.dependencies, lockedDependency => {
        NPM.rebaseLockfile(pathToPackageRoot, lockedDependency);
      });
    }
  }
  
  static install(cwd, maxExecBufferSize) {
    return BbPromise.fromCallback(cb => {
      childProcess.exec('npm install', {
        cwd: cwd,
        maxBuffer: maxExecBufferSize,
        encoding: 'utf8'
      }, cb);
    })
    .return();
  }

  static prune(cwd, maxExecBufferSize) {
    return BbPromise.fromCallback(cb => {
      childProcess.exec('npm prune', {
        cwd: cwd,
        maxBuffer: maxExecBufferSize,
        encoding: 'utf8'
      }, cb);
    })
    .return();
  }

  static runScripts(cwd, maxExecBufferSize, scriptNames) {
    return BbPromise.mapSeries(scriptNames, scriptName => BbPromise.fromCallback(cb => {
      childProcess.exec(`npm run ${scriptName}`, {
        cwd: cwd,
        maxBuffer: maxExecBufferSize,
        encoding: 'utf8'
      }, cb);
    }))
    .return();
  }
}

module.exports = NPM;
