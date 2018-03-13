'use strict';
/**
 * Yarn packager.
 * 
 * Yarn specific packagerOptions (default):
 *   flat (false) - Use --flat with install
 *   ignoreScripts (false) - Do not execute scripts during install
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const childProcess = require('child_process');

class Yarn {
  static get lockfileName() {  // eslint-disable-line lodash/prefer-constant
    return 'yarn.lock';
  }

  static get mustCopyModules() {  // eslint-disable-line lodash/prefer-constant
    return false;
  }

  static getProdDependencies(cwd, depth, maxExecBufferSize) {
    const command = `yarn list --depth=${depth || 1} --json --production`;  // Only prod dependencies

    // If we need to ignore some errors add them here
    const ignoredYarnErrors = [];

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
            return !_.isEmpty(error) && !_.some(ignoredYarnErrors, ignoredError => _.startsWith(error, `error ${ignoredError.yarnError}`));
          }, false);

          if (failed) {
            return cb(err);
          }
        }
        return cb(null, stdout);
      });
    })
    .then(depJson => BbPromise.try(() => JSON.parse(depJson)))
    .then(parsedTree => {
      const convertTrees = trees => _.reduce(trees, (__, tree) => {
        const splitModule = _.split(tree.name, '@');
        // If we have a scoped module we have to re-add the @
        if (_.startsWith(tree.name, '@')) {
          splitModule.splice(0, 1);
          splitModule[0] = '@' + splitModule[0];
        }
        __[_.first(splitModule)] = {
          version: _.join(_.tail(splitModule), '@'),
          dependencies: convertTrees(tree.children)
        };
        return __;
      }, {});

      const trees = _.get(parsedTree, 'data.trees', []);
      const result = {
        problems: [],
        dependencies: convertTrees(trees) 
      };
      return result;
    });
  }

  // TODO: Check if we need that for Yarn
  static rebaseLockfile(/* pathToPackageRoot, lockfile */) {
  }

  static install(cwd, maxExecBufferSize, packagerOptions) {
    let command = 'yarn install --frozen-lockfile --non-interactive';
    // Convert supported packagerOptions
    if (packagerOptions.ignoreScripts) {
      command += ' --ignore-scripts';
    }
    return BbPromise.fromCallback(cb => {
      childProcess.exec(command, {
        cwd: cwd,
        maxBuffer: maxExecBufferSize,
        encoding: 'utf8'
      }, cb);
    })
    .return();
  }

  // "Yarn install" prunes automatically
  static prune(cwd, maxExecBufferSize, packagerOptions) {
    return Yarn.install(cwd, maxExecBufferSize, packagerOptions);
  }

  static runScripts(cwd, maxExecBufferSize, scriptNames) {
    return BbPromise.mapSeries(scriptNames, scriptName => BbPromise.fromCallback(cb => {
      childProcess.exec(`yarn run ${scriptName}`, {
        cwd: cwd,
        maxBuffer: maxExecBufferSize,
        encoding: 'utf8'
      }, cb);
    }))
    .return();
  }
}

module.exports = Yarn;
