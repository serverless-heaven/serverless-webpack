'use strict';

// That file is only used by the e2e tests

const path = require('path');

function replacePluginLockReference(lockPath, pluginPackagePath, utils) {
  return utils.replaceInJson(lockPath, lock => {
    const pluginPackage = lock.packages['../..'];
    const installedPackage = lock.packages['node_modules/serverless-webpack'] || {};

    if (!pluginPackage || !lock.packages['']?.devDependencies) {
      throw new Error('Unexpected package-lock structure for serverless-webpack local file dependency.');
    }

    lock.packages[''].devDependencies['serverless-webpack'] = `file:${pluginPackagePath}`;
    delete lock.packages['../..'];
    lock.packages['node_modules/serverless-webpack'] = {
      ...pluginPackage,
      ...installedPackage,
      resolved: `file:${pluginPackagePath}`
    };
    delete lock.packages['node_modules/serverless-webpack'].link;

    return lock;
  });
}

module.exports = async (originalFixturePath, fixturePath, utils) => {
  const pluginPath = path.resolve(originalFixturePath, '..', '..');

  const SLS_CONFIG_PATH = path.join(fixturePath, 'serverless.yml');
  const WEBPACK_CONFIG_PATH = path.join(fixturePath, 'webpack.config.js');
  const PACKAGE_JSON_PATH = path.join(fixturePath, 'package.json');
  const LOCK_PATH = path.join(fixturePath, 'package-lock.json');

  await Promise.all([
    utils.replaceInFile(SLS_CONFIG_PATH, '- serverless-webpack', `- ${pluginPath}`),
    utils.replaceInFile(WEBPACK_CONFIG_PATH, "'serverless-webpack'", `'${pluginPath}'`),
    utils.replaceInFile(PACKAGE_JSON_PATH, 'file:../..', `file:${utils.pluginPackagePath}`),
    replacePluginLockReference(LOCK_PATH, utils.pluginPackagePath, utils)
  ]);

  const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';

  return utils.spawnProcess(command, ['install'], { cwd: __dirname });
};
