'use strict';
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
 * static getPackagerVersion(cwd: string): BbPromise<Object>
 * static getProdDependencies(cwd: string, depth: number = 1): BbPromise<Object>;
 * static rebaseLockfile(pathToPackageRoot: string, lockfile: Object): void;
 * static install(cwd: string): BbPromise<void>;
 * static prune(cwd: string): BbPromise<void>;
 * static runScripts(cwd: string, scriptNames): BbPromise<void>;
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
 * @returns {BbPromise<Packager>} - Promised packager to allow packagers be created asynchronously.
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
