'use strict';

const BbPromise = require('bluebird');
const path = require('path');

module.exports = {
  prepareRun() {
    this.originalServicePath = this.serverless.config.servicePath;
    this.originalWebpackOutputPath = this.webpackOutputPath;

    this.serverless.config.servicePath = path.join(this.webpackOutputPath, 'service');

    // Set service path as CWD to allow accessing bundled files correctly
    process.chdir(this.serverless.config.servicePath);

    // Prevent a respawn to delete our output directory
    this.keepOutputDirectory = true;

    return BbPromise.resolve();
  },

  watchRun() {
    // Redeploy functions to the event gateway
    // We have to use the internal functions here, because the run plugin
    // does not offer any detailed hooks that could be overridden to do
    // a deploy only. Running the whole run command will lead to an error
    // because the functions are already registered in the event gateway
    const deployFunctionsToLocalEmulator = require(path.join(
      this.serverless.config.serverlessPath,
      'plugins',
      'run',
      'utils',
      'deployFunctionsToLocalEmulator'
    ));
    const getLocalRootUrl = require(path.join(
      this.serverless.config.serverlessPath,
      'plugins',
      'run',
      'utils',
      'getLocalRootUrl'
    ));

    // Reset configuration
    this.serverless.config.servicePath = this.originalServicePath;
    this.webpackOutputPath = this.originalWebpackOutputPath;
    this.webpackConfig.output.path = this.webpackOutputPath;
    process.chdir(this.serverless.config.servicePath);

    return this.hooks['before:run:run']().then(() =>
      deployFunctionsToLocalEmulator(
        this.serverless.service,
        this.serverless.config.servicePath,
        getLocalRootUrl(this.options.lport)
      )
    );
  }
};
