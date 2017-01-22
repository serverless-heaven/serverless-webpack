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

  run(stats) {
    const functionName = this.options.function;

    this.serverless.cli.log(`Run function ${functionName}...`);

    const handler = this.loadHandler(stats, functionName);
    const event = this.getEvent();
    const context = this.getContext(functionName);

    return new BbPromise((resolve, reject) => handler(
      event,
      context,
      (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      }
    ));
  },

  watch() {
    const functionName = this.options.function;
    this.serverless.cli.log(`Watch function ${functionName}...`);

    const compiler = webpack(this.webpackConfig);

    compiler.watch({}, (err, stats) => {
      if (err) {
        throw err;
      }
      this.serverless.cli.log(`Run function ${functionName}...`);
      const handler = this.loadHandler(stats, functionName, true);
      const event = this.getEvent();
      const context = this.getContext(functionName);

      handler(
        event,
        context,
        (err, res) => {
          if (err) {
            throw err;
          } else {
            this.serverless.cli.consoleLog(res);
          }
        }
      )
    });

    return BbPromise.resolve();
  },
};
