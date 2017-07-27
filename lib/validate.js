'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const lib = require('./index');
const _ = require('lodash');

function listFiles(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = listFiles(path.join(dir, file), filelist);
    }
    else {
      filelist.push(file);
    }
  });
  return filelist;
}

function getEntryExtension(fileName, files) {
  const fileFullName = files.find(file => file.startsWith(fileName));
  return path.extname(fileFullName);
}

function getEntryForFunction(serverlessFunction, files) {
	const handler = serverlessFunction.handler;
  const handlerFile = /(.*)\..*?$/.exec(handler)[1];
  
  const ext = getEntryExtension(handlerFile, files);

	// Create a valid entry key
	return {
		[handlerFile]: `./${handlerFile}${ext}`
	};
};

module.exports = {
  validate() {
    this.webpackConfig = (
      this.serverless.service.custom &&
      this.serverless.service.custom.webpack ||
      'webpack.config.js'
    );

		// Expose entries - must be done before requiring the webpack configuration
    const entries = {};
    const functions = this.serverless.service.getAllFunctions();
    const allFilesInServicePath = listFiles(this.serverless.config.servicePath);
    if (this.options.function) {
			const serverlessFunction = this.serverless.service.getFunction(this.options.function);
      const entry = getEntryForFunction(serverlessFunction, allFilesInServicePath);
      _.merge(entries, entry);
    } else {
      _.forEach(functions, func => {
        const entry = getEntryForFunction(this.serverless.service.getFunction(func), allFilesInServicePath);
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
      const outputFilename = path.basename(
        _.isArray(this.webpackConfig.entry)
        && this.webpackConfig.entry[this.webpackConfig.entry.length - 1]
        || this.webpackConfig.entry
        || 'handler.js'
      );
      this.webpackConfig.output = {
        libraryTarget: 'commonjs',
        path: outputPath,
        filename: outputFilename,
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
