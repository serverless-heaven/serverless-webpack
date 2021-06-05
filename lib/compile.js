'use strict';

const _ = require('lodash');
const { Worker } = require('jest-worker');
const lib = require('./index');

function ensureArray(obj) {
  return _.isArray(obj) ? obj : [obj];
}

async function webpackConcurrentCompile(webpackConfigFilePath, configs, concurrency) {
  const worker = new Worker(require.resolve('./compileWorker'), {
    numWorkers: concurrency,
    enableWorkerThreads: true,
    maxRetries: 0,
    exposedMethods: ['compile']
  });
  worker.getStdout().pipe(process.stdout);

  try {
    const stats = await Promise.all(
      _.map(configs, config => {
        return worker.compile({
          webpackConfigFilePath,
          configOverrides: {
            entry: config.entry,
            output: config.output,
            context: config.context,
            node: config.node,
            target: config.target
          },
          entries: lib.entries,
          options: lib.options,
          webpack: lib.webpack,
          // Pass parts of the serverless object that are serializable.
          serverless: {
            serverlessDirPath: lib.serverless.serverlessDirPath,
            version: lib.serverless.version,
            config: {
              servicePath: lib.serverless.config.servicePath
            }
          }
        });
      })
    );
    return _.flatten(stats);
  } finally {
    await worker.end();
  }
}

module.exports = {
  async compile() {
    this.serverless.cli.log('Bundling with Webpack...');

    const configs = ensureArray(this.webpackConfig);

    if (!this.configuration) {
      throw new Error('Missing plugin configuration');
    }
    const concurrency = this.configuration.concurrency;

    const stats = await webpackConcurrentCompile(this.webpackConfigFilePath, configs, concurrency);
    this.compileStats = { stats };
  }
};
