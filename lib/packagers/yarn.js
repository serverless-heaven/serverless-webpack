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
const Utils = require('../utils');

class Yarn {
  // eslint-disable-next-line lodash/prefer-constant
  static get lockfileName() {
    return 'yarn.lock';
  }

  static get copyPackageSectionNames() {
    return ['resolutions'];
  }

  // eslint-disable-next-line lodash/prefer-constant
  static get mustCopyModules() {
    return false;
  }

  static getProdDependencies(cwd, depth) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = [ 'list', `--depth=${depth || 1}`, '--json', '--production' ];

    // If we need to ignore some errors add them here
    const ignoredYarnErrors = [];

    return Utils.spawnProcess(command, args, {
      cwd: cwd
    })
      .catch(err => {
        if (err instanceof Utils.SpawnError) {
          // Only exit with an error if we have critical npm errors for 2nd level inside
          const errors = _.split(err.stderr, '\n');
          const failed = _.reduce(
            errors,
            (failed, error) => {
              if (failed) {
                return true;
              }
              return (
                !_.isEmpty(error) &&
                !_.some(ignoredYarnErrors, ignoredError => _.startsWith(error, `npm ERR! ${ignoredError.npmError}`))
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
      .then(depJson => BbPromise.try(() => JSON.parse(depJson)))
      .then(parsedTree => {
        const convertTrees = trees =>
          _.reduce(
            trees,
            (__, tree) => {
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
            },
            {}
          );

        const trees = _.get(parsedTree, 'data.trees', []);
        const result = {
          problems: [],
          dependencies: convertTrees(trees)
        };
        return result;
      });
  }

  static rebaseLockfile(pathToPackageRoot, lockfile) {
    const fileVersionMatcher = /[^"/]@(?:file:)?((?:\.\/|\.\.\/).*?)[":,]/gm;
    const replacements = [];
    let match;

    // Detect all references and create replacement line strings
    while ((match = fileVersionMatcher.exec(lockfile)) !== null) {
      replacements.push({
        oldRef: match[1],
        newRef: _.replace(`${pathToPackageRoot}/${match[1]}`, /\\/g, '/')
      });
    }

    // Replace all lines in lockfile
    return _.reduce(replacements, (__, replacement) => _.replace(__, replacement.oldRef, replacement.newRef), lockfile);
  }

  static install(cwd, packagerOptions) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = [ 'install', '--frozen-lockfile', '--non-interactive' ];

    // Convert supported packagerOptions
    if (packagerOptions.ignoreScripts) {
      args.push('--ignore-scripts');
    }

    return Utils.spawnProcess(command, args, { cwd }).return();
  }

  // "Yarn install" prunes automatically
  static prune(cwd, packagerOptions) {
    return Yarn.install(cwd, packagerOptions);
  }

  static runScripts(cwd, scriptNames) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    return BbPromise.mapSeries(scriptNames, scriptName => {
      const args = [ 'run', scriptName ];

      return Utils.spawnProcess(command, args, { cwd });
    }).return();
  }
}

module.exports = Yarn;
