'use strict';

// That file is only used by the e2e tests

const path = require('path');

module.exports = async (originalFixturePath, fixturePath, utils) => {
  const pluginPath = path.resolve(originalFixturePath, '..', '..');

  const SLS_CONFIG_PATH = path.join(fixturePath, 'serverless.yml');
  const WEBPACK_CONFIG_PATH = path.join(fixturePath, 'webpack.config.js');
  const PACKAGE_JSON_PATH = path.join(fixturePath, 'package.json');
  const LOCK_PATH = path.join(fixturePath, 'package-lock.json');

  await Promise.all([
    utils.replaceInFile(SLS_CONFIG_PATH, '- serverless-webpack', `- ${pluginPath}`),
    utils.replaceInFile(WEBPACK_CONFIG_PATH, "'serverless-webpack'", `'${pluginPath}'`),
    utils.replaceInFile(PACKAGE_JSON_PATH, 'file:../..', `file:${pluginPath}`),
    utils.replaceInFile(LOCK_PATH, '../..', `${pluginPath}`)
  ]);

  const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';

  return utils.spawnProcess(command, ['install'], { cwd: __dirname });
};
