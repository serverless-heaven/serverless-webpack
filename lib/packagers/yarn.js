/**
 * Yarn packager.
 *
 * Yarn specific packagerOptions (default):
 *   flat (false) - Use --flat with install
 *   ignoreScripts (false) - Do not execute scripts during install
 *   noNonInteractive (false) - Disable interactive mode when using Yarn 2 or above
 *   noFrozenLockfile (false) - Do not require an up-to-date yarn.lock
 *   networkConcurrency (8) - Specify number of concurrent network requests
 */

const _ = require('lodash');
const Utils = require('../utils');
const findWorkspaceRoot = require('find-yarn-workspace-root');

class Yarn {
  static get lockfileName() {
    return 'yarn.lock';
  }

  static get mustCopyModules() {
    return false;
  }

  static copyPackageSectionNames(packagerOptions) {
    const options = packagerOptions || {};
    return options.copyPackageSectionNames || ['resolutions'];
  }

  static isBerryVersion(version) {
    const versionNumber = version.charAt(0);
    const mainVersion = parseInt(versionNumber, 10);
    return mainVersion > 1;
  }

  static async getPackagerVersion(cwd) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['-v'];

    try {
      const processOutput = await Utils.spawnProcess(command, args, { cwd });
      return processOutput.stdout;
    } catch (err) {
      return err.stdout;
    }
  }

  static async getProdDependencies(cwd, depth) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['list', `--depth=${depth || 1}`, '--json', '--production'];

    // If we need to ignore some errors add them here
    const ignoredYarnErrors = [];

    let stdout;

    try {
      const processOutput = await Utils.spawnProcess(command, args, {
        cwd: findWorkspaceRoot(cwd) || cwd
      });
      stdout = processOutput.stdout;
    } catch (err) {
      if (err instanceof Utils.SpawnError) {
        // Only exit with an error if we have critical npm errors for 2nd level inside
        const errors = _.split(err.stderr, '\n');
        const failed = _.reduce(
          errors,
          (hasFailed, error) => {
            if (hasFailed) {
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
          stdout = err.stdout;
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

    const lines = Utils.splitLines(stdout);
    const parsedLines = _.map(lines, Utils.safeJsonParse);
    const parsedTree = _.find(parsedLines, line => line && line.type === 'tree');

    const convertTrees = trees =>
      _.reduce(
        trees,
        (__, tree) => {
          const splitModule = _.split(tree.name, '@');
          // If we have a scoped module we have to re-add the @
          if (_.startsWith(tree.name, '@')) {
            splitModule.splice(0, 1);
            splitModule[0] = `@${splitModule[0]}`;
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
    return {
      problems: [],
      dependencies: convertTrees(trees)
    };
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

  static async install(cwd, packagerOptions, version) {
    if (packagerOptions.noInstall) {
      return;
    }
    const isBerry = Yarn.isBerryVersion(version);

    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['install'];
    // Convert supported packagerOptions
    if (!packagerOptions.noNonInteractive && !isBerry) {
      args.push('--non-interactive');
    }
    if (!packagerOptions.noFrozenLockfile) {
      if (isBerry) {
        args.push('--immutable');
      } else {
        args.push('--frozen-lockfile');
      }
    }
    if (packagerOptions.ignoreScripts) {
      args.push('--ignore-scripts');
    }
    if (packagerOptions.networkConcurrency) {
      args.push(`--network-concurrency ${packagerOptions.networkConcurrency}`);
    }

    await Utils.spawnProcess(command, args, { cwd });
  }

  // "Yarn install" prunes automatically
  static prune(cwd, packagerOptions, version) {
    return Yarn.install(cwd, packagerOptions, version);
  }

  static async runScripts(cwd, scriptNames) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    for (const scriptName of scriptNames) {
      const args = ['run', scriptName];
      await Utils.spawnProcess(command, args, { cwd });
    }
  }
}

module.exports = Yarn;
