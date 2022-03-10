'use strict';

const fs = require('fs');
const path = require('path');

module.exports = originalFixturePath => {
  const pluginPath = path.resolve(originalFixturePath, '..', '..');

  const SLS_CONFIG_PATH = path.join(__dirname, 'serverless.yml');
  const slsConfig = fs.readFileSync(SLS_CONFIG_PATH);
  // eslint-disable-next-line lodash/prefer-lodash-method
  const updatedSlsConfig = String(slsConfig).replace('- serverless-webpack', `- ${pluginPath}`);
  fs.writeFileSync(SLS_CONFIG_PATH, updatedSlsConfig);

  const WEBPACK_CONFIG_PATH = path.join(__dirname, 'webpack.config.js');
  const webpackConfig = fs.readFileSync(WEBPACK_CONFIG_PATH);
  // eslint-disable-next-line lodash/prefer-lodash-method
  const updatedWebpackConfig = String(webpackConfig).replace("'serverless-webpack'", `'${pluginPath}'`);
  fs.writeFileSync(WEBPACK_CONFIG_PATH, updatedWebpackConfig);
};
