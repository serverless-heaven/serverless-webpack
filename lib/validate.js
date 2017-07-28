'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');
const lib = require('./index');
const _ = require('lodash');

/**
 * For automatic entry detection we sort the found files to solve ambiguities.
 * This should cover most of the cases. For complex setups the user should
 * build his own entries with help of the other exports.
 */
const preferredExtensions = [
  '.js',
  '.ts',
  '.jsx'
];

module.exports = {
  validate() {
    const getEntryExtension = fileName => {
      const files = glob.sync(`${fileName}.*`, {
        cwd: this.serverless.config.servicePath,
        nodir: true
      });

      if (_.isEmpty(files)) {
        // If we cannot find any handler we should terminate with an error
        throw new this.serverless.classes.Error(`No matching handler found for '${fileName}'. Check your service definition.`);
      }

      // Move preferred file extensions to the beginning
      const sortedFiles = _.uniq(
        _.concat(
          _.sortBy(
            _.filter(files, file => _.includes(preferredExtensions, path.extname(file))),
            a => _.size(a)
          ),
          files
        )
      );

      if (_.size(sortedFiles) > 1) {
        this.serverless.cli.log(`WARNING: More than one matching handlers found for '${fileName}'. Using '${_.first(sortedFiles)}'.`);
      }
      return path.extname(_.first(sortedFiles));
    }

    const getEntryForFunction = serverlessFunction => {
      const handler = serverlessFunction.handler;
      const handlerFile = /(.*)\..*?$/.exec(handler)[1];

      const ext = getEntryExtension(handlerFile);

      // Create a valid entry key
      return {
        [handlerFile]: `./${handlerFile}${ext}`
      };
    };

    this.webpackConfig = (
      this.serverless.service.custom &&
      this.serverless.service.custom.webpack ||
      'webpack.config.js'
    );

		// Expose entries - must be done before requiring the webpack configuration
    const entries = {};
    const functions = this.serverless.service.getAllFunctions();
    if (this.options.function) {
			const serverlessFunction = this.serverless.service.getFunction(this.options.function);
      const entry = getEntryForFunction(serverlessFunction);
      _.merge(entries, entry);
    } else {
      _.forEach(functions, func => {
        const entry = getEntryForFunction(this.serverless.service.getFunction(func));
        _.merge(entries, entry);
      });
    }
    lib.entries = entries;

    // Expose service file and options
    lib.serverless = this.serverless;
    lib.options = this.options;

    if (_.isString(this.webpackConfig)) {
      const webpackConfigFilePath = path.join(this.serverless.config.servicePath, this.webpackConfig);
      if (!this.serverless.utils.fileExistsSync(webpackConfigFilePath)) {
        throw new this.serverless.classes
          .Error('The webpack plugin could not find the configuration file at: ' + webpackConfigFilePath);
      }
      this.webpackConfig = require(webpackConfigFilePath);
    }

    // Default context
    if (!this.webpackConfig.context) {
      this.webpackConfig.context = this.serverless.config.servicePath;
    }

    // Default output
    if (!this.webpackConfig.output) {
      const outputPath = path.join(this.serverless.config.servicePath, '.webpack');
      this.webpackConfig.output = {
        libraryTarget: 'commonjs',
        path: outputPath,
        filename: '[name].js',
      };
    }

    // Custom output path
    if (this.options.out) {
      this.webpackConfig.output.path = path.join(this.serverless.config.servicePath, this.options.out);
    }

    fse.removeSync(this.webpackConfig.output.path);

    return BbPromise.resolve();
  },
};
