'use strict';

const BbPromise = require('bluebird');

const validate = require('./lib/validate');
const compile = require('./lib/compile');
const wpwatch = require('./lib/wpwatch');
const cleanup = require('./lib/cleanup');
const run = require('./lib/run');
const serve = require('./lib/serve');
const packExternalModules = require('./lib/packExternalModules');

class ServerlessWebpack {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    Object.assign(
      this,
      validate,
      compile,
      wpwatch,
      cleanup,
      run,
      serve,
      packExternalModules
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
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: true,
              },
              path: {
                usage: 'Path to JSON file holding input data',
                shortcut: 'p',
              },
            },
          },
          watch: {
            usage: 'Run a function from the webpack output bundle every time the source is changed',
            lifecycleEvents: [
              'watch',
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: true,
              },
              path: {
                usage: 'Path to JSON file holding input data',
                shortcut: 'p',
              },
            },
          },
          serve: {
            usage: 'Simulate the API Gateway and serves lambdas locally',
            lifecycleEvents: [
              'serve',
            ],
            options: {
              port: {
                usage: 'The local server port',
                shortcut: 'p',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'before:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.compile)
        .then(this.packExternalModules),

      'after:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.cleanup),

      'webpack:validate': () => BbPromise.bind(this)
        .then(this.validate),

      'webpack:compile': () => BbPromise.bind(this)
        .then(this.compile)
        .then(this.packExternalModules),

      'webpack:invoke:invoke': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.compile)
        .then(this.run)
        .then(out => this.serverless.cli.consoleLog(out)),

      'webpack:watch:watch': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.watch),

      'webpack:serve:serve': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.serve),

      'before:offline:start': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.wpwatch),
    };
  }
}

module.exports = ServerlessWebpack;
