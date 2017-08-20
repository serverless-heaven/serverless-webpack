'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');

const validate = require('./lib/validate');
const compile = require('./lib/compile');
const wpwatch = require('./lib/wpwatch');
const cleanup = require('./lib/cleanup');
const run = require('./lib/run');
const prepareLocalInvoke = require('./lib/prepareLocalInvoke');
const prepareOfflineInvoke = require('./lib/prepareOfflineInvoke');
const packExternalModules = require('./lib/packExternalModules');
const packageModules = require('./lib/packageModules');
const lib = require('./lib');

class ServerlessWebpack {

  static get lib() {
    return lib;
  }

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    if (
      _.has(this.serverless, 'service.custom.webpack') &&
      _.endsWith(this.serverless.service.custom.webpack, '.ts')
    ) {
      require('ts-node/register');
    }

    _.assign(
      this,
      validate,
      compile,
      wpwatch,
      cleanup,
      run,
      packExternalModules,
      packageModules,
      prepareLocalInvoke,
      prepareOfflineInvoke
    );

    this.commands = {
      webpack: {
        usage: 'Bundle with Webpack',
        lifecycleEvents: [
          'validate',
          'compile',
        ],
        options: {
          out: {
            usage: 'Path to output directory',
            shortcut: 'o',
          },
        },
        commands: {
          invoke: {
            usage: 'Run a function locally from the webpack output bundle',
            lifecycleEvents: [
              'invoke',
            ],
          },
          watch: {
            usage: 'Run a function from the webpack output bundle every time the source is changed',
            lifecycleEvents: [
              'watch',
            ],
          },
          serve: {
            usage: 'Simulate the API Gateway and serves lambdas locally',
            lifecycleEvents: [
              'serve',
            ],
          },
        },
      },
    };

    this.hooks = {
      'before:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.compile)
        .then(this.packExternalModules)
        .then(this.packageModules),

      'after:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.cleanup),

      'before:deploy:function:packageFunction': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.compile)
        .then(this.packExternalModules)
        .then(this.packageModules),

      'before:invoke:local:invoke': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.compile)
        .then(this.prepareLocalInvoke),

      'after:invoke:local:invoke': () => BbPromise.bind(this)
        .then(() => {
          if (this.options.watch && !this.isWatching) {
            return this.watch();
          }
          return BbPromise.resolve();
        }),

      'webpack:validate': () => BbPromise.bind(this)
        .then(this.validate),

      'webpack:compile': () => BbPromise.bind(this)
        .then(this.compile)
        .then(this.packExternalModules)
        .then(this.packageModules),

      'webpack:invoke:invoke': () => BbPromise.bind(this)
        .then(() => BbPromise.reject(new this.serverless.classes.Error('Use "serverless invoke local" instead.'))),

      'webpack:watch:watch': () => BbPromise.bind(this)
        .then(() => BbPromise.reject(new this.serverless.classes.Error('Use "serverless invoke local --watch" instead.'))),

      'webpack:serve:serve': () => BbPromise.bind(this)
        .then(() => BbPromise.reject(new this.serverless.classes.Error('serve has been removed. Use serverless-offline instead.'))),

      'before:offline:start': () => BbPromise.bind(this)
        .then(this.prepareOfflineInvoke)
        .then(this.compile)
        .then(this.wpwatch),

      'before:offline:start:init': () => BbPromise.bind(this)
        .then(this.prepareOfflineInvoke)
        .then(this.compile)
        .then(this.wpwatch),

    };
  }
}

module.exports = ServerlessWebpack;
