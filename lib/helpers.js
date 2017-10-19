'use strict';

const _ = require('lodash');

function hasNodeRuntime(funcName, serverless) {
  const serverlessFunction = serverless.service.getFunction(funcName);
  const runtime = serverlessFunction.runtime || serverless.service.provider.runtime;

  return !runtime || /^nodejs/.test(runtime);
}

function hasEmptyWebpackConfig(config) {
  return (_.isEmpty(config) || (!_.isArray(config) && _.isEmpty(config.entry)));
}

module.exports = {
  hasNodeRuntime,
  hasEmptyWebpackConfig,
};
