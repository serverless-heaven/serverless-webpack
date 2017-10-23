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
          'webpack'
        ],
        options: {
          out: {
            usage: 'Path to output directory',
            shortcut: 'o',
          },
        },
        commands: {
          validate: {
            type: 'entrypoint',
            lifecycleEvents: [
              'validate',
            ],
          },
          compile: {
            type: 'entrypoint',
            lifecycleEvents: [
              'compile',
            ],
          },
          package: {
            type: 'entrypoint',
            lifecycleEvents: [
              'packExternalModules',
              'packageModules'
            ],
          },
        },
      },
    };

    this.hooks = {
      'before:package:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(() => this.serverless.pluginManager.spawn('webpack:validate'))
        .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
        .then(() => this.serverless.pluginManager.spawn('webpack:package')),

      'after:package:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.cleanup),

      'before:deploy:function:packageFunction': () => BbPromise.bind(this)
        .then(() => this.serverless.pluginManager.spawn('webpack:validate'))
        .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
        .then(() => this.serverless.pluginManager.spawn('webpack:package')),

      'before:invoke:local:invoke': () => BbPromise.bind(this)
        .then(() => this.serverless.pluginManager.spawn('webpack:validate'))
        .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
        .then(this.prepareLocalInvoke),

      'after:invoke:local:invoke': () => BbPromise.bind(this)
        .then(() => {
          if (this.options.watch && !this.isWatching) {
            return this.watch();
          }
          return BbPromise.resolve();
        }),

      'webpack:webpack': () => BbPromise.bind(this)
        .then(() => this.serverless.pluginManager.spawn('webpack:validate'))
        .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
        .then(() => this.serverless.pluginManager.spawn('webpack:package')),

      /*
       * Internal webpack events (can be hooked by plugins)
       */
      'webpack:validate:validate': () => BbPromise.bind(this)
        .then(this.validate),

      'webpack:compile:compile': () => BbPromise.bind(this)
        .then(this.compile),

      'webpack:package:packExternalModules': () => BbPromise.bind(this)
        .then(this.packExternalModules),

      'webpack:package:packageModules': () => BbPromise.bind(this)
        .then(this.packageModules),

      'before:offline:start': () => BbPromise.bind(this)
        .then(this.prepareOfflineInvoke)
        .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
        .then(this.wpwatch),

      'before:offline:start:init': () => BbPromise.bind(this)
        .then(this.prepareOfflineInvoke)
        .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
        .then(this.wpwatch),

    };
  }
}

module.exports = ServerlessWebpack;
