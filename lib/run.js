'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const webpack = require('webpack');
const utils = require('./utils');

module.exports = {
  loadHandler(stats, functionId, purge) {
    const handler = this.serverless.service.functions[functionId].handler.split('.');
    const moduleFileName = `${handler[0]}.js`;
    const handlerFilePath = path.join(
      path.resolve(stats.compilation.options.output.path),
      moduleFileName
    );
    if (purge) {
      utils.purgeCache(handlerFilePath);
    }
    //set environment before requiring, as imported modules will be immediately
    this.setEnvironmentVars(functionId);
    const module = require(handlerFilePath);
    const functionObjectPath = handler.slice(1);
    let func = module;
    for (let p of functionObjectPath) {
      func = func[p];
    }
    return func;
  },

  getEvent() {
    return this.options.path
      ? this.serverless.utils.readFileSync(this.options.path)
      : null; // TODO use get-stdin instead
  },

  getContext(functionName) {
    return {
      awsRequestId: utils.guid(),
      invokeid: utils.guid(),
      logGroupName: `/aws/lambda/${functionName}`,
      logStreamName: '2016/02/14/[HEAD]13370a84ca4ed8b77c427af260',
      functionVersion: '$LATEST',
      isDefaultFunctionVersion: true,
      functionName: functionName,
      memoryLimitInMB: '1024',
    };
  },

  setEnvironmentVars(functionName) {
    const providerEnvVars = this.serverless.service.provider.environment || {};
    const functionEnvVars = this.serverless.service.functions[functionName].environment || {};

    Object.assign(process.env, providerEnvVars, functionEnvVars);
  },

  watch() {
    const functionName = this.options.function;
    this.serverless.cli.log(`Watch function ${functionName}...`);

    const compiler = webpack(this.webpackConfig);

    compiler.watch({}, (err, stats) => {
      if (err) {
        throw err;
      }

      this.serverless.cli.log('Sources changed.');
      BbPromise.try(() => {
        // Currently the plugin bends the service path to point to the webpack
        // directory in the compile step. This has to be reverted here so that
        // the webpack configuration can be found.
        // We have to think about changing the whole servicePath approach, so
        // that the plugin can use the given one and does not change it while
        // processing.
        if (this.originalServicePath) {
          this.serverless.config.servicePath = this.originalServicePath;
        }
      })
      .then(() => this.serverless.pluginManager.spawn('invoke:local'))
      .then(() => this.serverless.cli.log('Waiting for changes ...'));
    });
  },
};
