/**
 * Factory for supported packagers.
 *
 * All packagers must implement the following interface:
 *
 * interface Packager {
 *
 * static get lockfileName(): string;
 * static get mustCopyModules(): boolean;
 * static copyPackageSectionNames(packagerOptions: Object): Array<string>;
 * static getPackagerVersion(cwd: string): Promise<Object>
 * static getProdDependencies(cwd: string, depth: number = 1): Promise<Object>;
 * static rebaseLockfile(pathToPackageRoot: string, lockfile: Object): void;
 * static install(cwd: string): Promise<void>;
 * static prune(cwd: string): Promise<void>;
 * static runScripts(cwd: string, scriptNames): Promise<void>;
 *
 * }
 */

const _ = require('lodash');
const npm = require('./npm');
const yarn = require('./yarn');

const registeredPackagers = {
  npm: npm,
  yarn: yarn
};

/**
 * Factory method.
 * @this ServerlessWebpack - Active plugin instance
 * @param {string} packagerId - Well known packager id.
 * @returns {Packager} - Selected packager implementation.
 */
module.exports.get = function (packagerId) {
  if (!_.has(registeredPackagers, packagerId)) {
    const message = `Could not find packager '${packagerId}'`;
    if (this.log) {
      this.log.error(`Could not find packager "${packagerId}"`);
    } else {
      this.serverless.cli.log(`ERROR: ${message}`);
    }
    throw new this.serverless.classes.Error(message);
  }
  return registeredPackagers[packagerId];
};
