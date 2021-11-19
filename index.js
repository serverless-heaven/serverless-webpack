'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');

const validate = require('./lib/validate');
const compile = require('./lib/compile');
const wpwatch = require('./lib/wpwatch');
const cleanup = require('./lib/cleanup');
const run = require('./lib/run');
const prepareLocalInvoke = require('./lib/prepareLocalInvoke');
const runPluginSupport = require('./lib/runPluginSupport');
const prepareOfflineInvoke = require('./lib/prepareOfflineInvoke');
const prepareStepOfflineInvoke = require('./lib/prepareStepOfflineInvoke');
const packExternalModules = require('./lib/packExternalModules');
const packageModules = require('./lib/packageModules');
const { isNodeRuntime } = require('./lib/utils');
const lib = require('./lib');

class ServerlessWebpack {
  static get lib() {
    return lib;
  }

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    if (
      ((_.has(this.serverless, 'service.custom.webpack') &&
        _.isString(this.serverless.service.custom.webpack) &&
        _.endsWith(this.serverless.service.custom.webpack, '.ts')) ||
        (_.has(this.serverless, 'service.custom.webpack.webpackConfig') &&
          _.endsWith(this.serverless.service.custom.webpack.webpackConfig, '.ts'))) &&
      !process[Symbol.for('ts-node.register.instance')]
    ) {
      try {
        require('ts-node/register');
      } catch (e) {
        throw new Error('If you want to use TypeScript with serverless-webpack, please add "ts-node" as dependency.');
      }
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
      runPluginSupport,
      prepareOfflineInvoke,
      prepareStepOfflineInvoke
    );

    this.commands = {
      webpack: {
        usage: 'Bundle with Webpack',
        lifecycleEvents: ['webpack'],
        options: {
          out: {
            usage: 'Path to output directory',
            shortcut: 'o',
            type: 'string'
          }
        },
        commands: {
          validate: {
            type: 'entrypoint',
            lifecycleEvents: ['validate']
          },
          compile: {
            type: 'entrypoint',
            lifecycleEvents: ['compile'],
            commands: {
              watch: {
                type: 'entrypoint',
                lifecycleEvents: ['compile']
              }
            }
          },
          package: {
            type: 'entrypoint',
            lifecycleEvents: [ 'packExternalModules', 'packageModules', 'copyExistingArtifacts' ]
          }
        }
      }
    };

    this.hooks = {
      initialize: () => {
        // serverless.processedInput does not exist in serverless@<2.0.0. This ensure the retrocompatibility with serverless v1
        if (this.serverless.processedInput && this.serverless.processedInput.options) {
          this.options = this.serverless.processedInput.options;
        }
      },
      'before:package:createDeploymentArtifacts': () =>
        BbPromise.bind(this)
          .then(() => this.serverless.pluginManager.spawn('webpack:validate'))
          .then(() => (this.skipCompile ? BbPromise.resolve() : this.serverless.pluginManager.spawn('webpack:compile')))
          .then(() => this.serverless.pluginManager.spawn('webpack:package')),

      'after:package:createDeploymentArtifacts': () => BbPromise.bind(this).then(this.cleanup),

      'before:deploy:function:packageFunction': () => {
        const runtime =
          this.serverless.service.getFunction(this.options.function).runtime ||
          this.serverless.service.provider.runtime ||
          'nodejs';

        if (isNodeRuntime(runtime)) {
          return BbPromise.bind(this)
            .then(() => this.serverless.pluginManager.spawn('webpack:validate'))
            .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
            .then(() => this.serverless.pluginManager.spawn('webpack:package'));
        }
      },

      'before:invoke:local:invoke': () =>
        BbPromise.bind(this)
          .then(() => {
            lib.webpack.isLocal = true;

            return this.serverless.pluginManager.spawn('webpack:validate');
          })
          .then(() => (this.skipCompile ? BbPromise.resolve() : this.serverless.pluginManager.spawn('webpack:compile')))
          .then(this.prepareLocalInvoke),

      'after:invoke:local:invoke': () =>
        BbPromise.bind(this).then(() => {
          if (this.options.watch && !this.isWatching) {
            return this.watch('invoke:local');
          }
          return BbPromise.resolve();
        }),

      'before:run:run': () =>
        BbPromise.bind(this)
          .then(() => _.set(this.serverless, 'service.package.individually', false))
          .then(() => this.serverless.pluginManager.spawn('webpack:validate'))
          .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
          .then(this.packExternalModules)
          .then(this.prepareRun),

      'after:run:run': () =>
        BbPromise.bind(this).then(() => {
          if (this.options.watch && !this.isWatching) {
            return this.watch(this.watchRun.bind(this));
          }
          return BbPromise.resolve();
        }),

      'webpack:webpack': () =>
        BbPromise.bind(this)
          .then(() => this.serverless.pluginManager.spawn('webpack:validate'))
          .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
          .then(() => this.serverless.pluginManager.spawn('webpack:package')),

      /*
       * Internal webpack events (can be hooked by plugins)
       */
      'webpack:validate:validate': () => BbPromise.bind(this).then(this.validate),

      'webpack:compile:compile': () => BbPromise.bind(this).then(this.compile),

      'webpack:compile:watch:compile': () => BbPromise.resolve(),

      'webpack:package:packExternalModules': () => BbPromise.bind(this).then(this.packExternalModules),

      'webpack:package:packageModules': () => BbPromise.bind(this).then(this.packageModules),

      'webpack:package:copyExistingArtifacts': () => BbPromise.bind(this).then(this.copyExistingArtifacts),

      'before:offline:start': () =>
        BbPromise.bind(this)
          .tap(() => {
            lib.webpack.isLocal = true;
          })
          .then(this.prepareOfflineInvoke)
          .then(() => (this.skipCompile ? BbPromise.resolve() : this.wpwatch())),

      'before:offline:start:init': () =>
        BbPromise.bind(this)
          .tap(() => {
            lib.webpack.isLocal = true;
          })
          .then(this.prepareOfflineInvoke)
          .then(() => (this.skipCompile ? BbPromise.resolve() : this.wpwatch())),

      'before:step-functions-offline:start': () =>
        BbPromise.bind(this)
          .tap(() => {
            lib.webpack.isLocal = true;
          })
          .then(this.prepareStepOfflineInvoke)
          .then(() => this.serverless.pluginManager.spawn('webpack:compile'))
    };
  }
}

module.exports = ServerlessWebpack;
