'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');
const lib = require('./index');
const _ = require('lodash');
const Configuration = require('./Configuration');
const { getAllNodeFunctions, isNodeRuntime } = require('./utils');

/**
 * For automatic entry detection we sort the found files to solve ambiguities.
 * This should cover most of the cases. For complex setups the user should
 * build his own entries with help of the other exports.
 */
const preferredExtensions = ['.js', '.ts', '.jsx', '.tsx'];

module.exports = {
  validate() {
    const getHandlerFileAndFunctionName = functionDefinition => {
      const { handler: handlerProp, image: imageProp } = functionDefinition;

      if (handlerProp) {
        return handlerProp;
      }

      if (imageProp && typeof imageProp == 'string') return imageProp;

      if (!imageProp || !imageProp.command || imageProp.command.length < 1) {
        const docsLink = 'https://www.serverless.com/blog/container-support-for-lambda';
        throw new this.serverless.classes.Error(
          `Either function.handler or function.image must be defined. Pass the handler name (i.e. 'index.handler') as the value for function.image.command[0]. For help see: ${docsLink}`
        );
      }

      return imageProp.command[0];
    };

    const getHandlerFile = handler => {
      // Check if handler is a well-formed path based handler.
      const handlerEntry = /(.*)\..*?$/.exec(handler);
      if (handlerEntry) {
        return handlerEntry[1];
      }
    };

    const getEntryExtension = fileName => {
      const files = glob.sync(`${fileName}.*`, {
        cwd: this.serverless.config.servicePath,
        nodir: true,
        ignore: this.configuration.excludeFiles ? this.configuration.excludeFiles : undefined
      });

      if (_.isEmpty(files)) {
        // If we cannot find any handler we should terminate with an error
        throw new this.serverless.classes.Error(
          `No matching handler found for '${fileName}' in '${this.serverless.config.servicePath}'. Check your service definition.`
        );
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
        if (this.log) {
          this.log.warning(`More than one matching handlers found for "${fileName}". Using "${_.first(sortedFiles)}"`);
        } else {
          this.serverless.cli.log(
            `WARNING: More than one matching handlers found for '${fileName}'. Using '${_.first(sortedFiles)}'.`
          );
        }
      }
      return path.extname(_.first(sortedFiles));
    };

    const getEntryForFunction = (name, serverlessFunction) => {
      const handler = getHandlerFileAndFunctionName(serverlessFunction);

      const handlerFile = getHandlerFile(handler);
      if (!handlerFile) {
        if (_.get(this.serverless, 'service.provider.name') !== 'google') {
          if (this.log) {
            this.log.warning();
            this.log.warning(
              `Entry for ${name}@${handler} could not be retrieved.\nPlease check your service config if you want to use lib.entries.`
            );
          } else {
            this.serverless.cli.log(
              `\nWARNING: Entry for ${name}@${handler} could not be retrieved.\nPlease check your service config if you want to use lib.entries.`
            );
          }
        }
        return {};
      }
      const ext = getEntryExtension(handlerFile);

      // Create a valid entry key
      return {
        [handlerFile]: `./${handlerFile}${ext}`
      };
    };

    // Initialize plugin configuration
    this.configuration = new Configuration(this.serverless.service.custom);
    if (this.log) {
      this.log.verbose(`Using configuration:\n${JSON.stringify(this.configuration, null, 2)}`);
    } else {
      this.options.verbose &&
        this.serverless.cli.log(`Using configuration:\n${JSON.stringify(this.configuration, null, 2)}`);
    }
    if (this.configuration.hasLegacyConfig) {
      if (this.log) {
        this.log.warning('Legacy configuration detected. Consider to use "custom.webpack" as object (see README).');
      } else {
        this.serverless.cli.log(
          'Legacy configuration detected. Consider to use "custom.webpack" as object (see README).'
        );
      }
    }

    this.webpackConfig = this.configuration.config || this.configuration.webpackConfig;

    if (this.webpackConfig.includeModules && this.webpackConfig.packagerOptions.noInstall) {
      throw new this.serverless.classes.Error(
        '"includeModules" requires an installation, and cannot be used with "packagerOptions.noInstall".'
      );
    }

    // Expose entries - must be done before requiring the webpack configuration
    const entries = {};

    const functions = getAllNodeFunctions.call(this);
    if (this.options.function) {
      const serverlessFunction = this.serverless.service.getFunction(this.options.function);
      const entry = getEntryForFunction.call(this, this.options.function, serverlessFunction);
      _.merge(entries, entry);
    } else {
      _.forEach(functions, (func, index) => {
        const loadedFunc = this.serverless.service.getFunction(func);
        const runtime = loadedFunc.runtime || this.serverless.service.provider.runtime || 'nodejs';

        if (isNodeRuntime(runtime)) {
          // runtimes can be 'nodejsX.Y' (AWS, Azure) or 'google-nodejs' (Google Cloud)
          const entry = getEntryForFunction.call(this, functions[index], loadedFunc);
          _.merge(entries, entry);
        }

        if (runtime === 'provided' && loadedFunc.allowCustomRuntime) {
          // allow custom runtime if the user has specified it
          const entry = getEntryForFunction.call(this, functions[index], loadedFunc);
          _.merge(entries, entry);
        }
      });
    }

    // Expose service file and options
    lib.serverless = this.serverless;
    lib.options = this.options;
    lib.entries = entries;

    if (_.isString(this.webpackConfig)) {
      const webpackConfigFilePath = path.join(this.serverless.config.servicePath, this.webpackConfig);
      if (!this.serverless.utils.fileExistsSync(webpackConfigFilePath)) {
        return BbPromise.reject(
          new this.serverless.classes.Error(
            'The webpack plugin could not find the configuration file at: ' + webpackConfigFilePath
          )
        );
      }
      try {
        const webpackConfig = require(webpackConfigFilePath);
        this.webpackConfig = webpackConfig.default || webpackConfig;
      } catch (err) {
        if (this.log) {
          this.log.error(`Could not load webpack config "${webpackConfigFilePath}"`);
        } else {
          this.serverless.cli.log(`Could not load webpack config '${webpackConfigFilePath}'`);
        }
        return BbPromise.reject(err);
      }
    }

    // Intermediate function to handle async webpack config
    const processConfig = _config => {
      this.webpackConfig = _config;
      // Default context
      if (!this.webpackConfig.context) {
        this.webpackConfig.context = this.serverless.config.servicePath;
      }

      // Default target
      if (!this.webpackConfig.target) {
        this.webpackConfig.target = 'node';
      }

      // Default output
      if (!this.webpackConfig.output || _.isEmpty(this.webpackConfig.output)) {
        const outputPath = path.join(this.serverless.config.servicePath, '.webpack');
        this.webpackConfig.output = {
          libraryTarget: 'commonjs',
          path: outputPath,
          filename: '[name].js'
        };
      }

      // Default node
      if (!this.webpackConfig.node || _.isEmpty(this.webpackConfig.node)) {
        this.webpackConfig.node = false;
      }

      // Custom output path
      if (this.options.out) {
        this.webpackConfig.output.path = path.join(this.serverless.config.servicePath, this.options.out);
      }

      this.skipCompile =
        _.get(this.serverless, 'service.custom.webpack.noBuild') === true || _.get(this.options, 'build') === false;

      // Skip compilation with --no-build or noBuild
      if (this.skipCompile) {
        if (this.log) {
          this.log('Skipping build and using existing compiled output');
        } else {
          this.serverless.cli.log('Skipping build and using existing compiled output');
        }
        if (!fse.pathExistsSync(this.webpackConfig.output.path)) {
          return BbPromise.reject(new this.serverless.classes.Error('No compiled output found'));
        }
        this.keepOutputDirectory = true;
      }

      if (!this.keepOutputDirectory) {
        if (this.log) {
          this.log.verbose(`Removing ${this.webpackConfig.output.path}`);
        } else {
          this.options.verbose && this.serverless.cli.log(`Removing ${this.webpackConfig.output.path}`);
        }
        fse.removeSync(this.webpackConfig.output.path);
      }
      this.webpackOutputPath = this.webpackConfig.output.path;

      // In case of individual packaging we have to create a separate config for each function
      if (_.has(this.serverless, 'service.package') && this.serverless.service.package.individually) {
        if (this.log) {
          this.log.verbose(
            `Individually packaging with concurrency at ${this.configuration.concurrency} entries a time.`
          );
        } else {
          this.options.verbose &&
            this.serverless.cli.log(
              `Individually packaging with concurrency at ${this.configuration.concurrency} entries a time.`
            );
        }
        if (this.webpackConfig.entry && !_.isEqual(this.webpackConfig.entry, entries)) {
          return BbPromise.reject(
            new this.serverless.classes.Error(
              'Webpack entry must be automatically resolved when package.individually is set to true. ' +
                'In webpack.config.js, remove the entry declaration or set entry to slsw.lib.entries.'
            )
          );
        }

        // Lookup associated Serverless functions
        const allEntryFunctions = _.map(getAllNodeFunctions.call(this), funcName => {
          const func = this.serverless.service.getFunction(funcName);
          const handler = getHandlerFileAndFunctionName(func);
          const handlerFile = path.relative('.', getHandlerFile(handler));

          return {
            handlerFile,
            funcName,
            func
          };
        });

        this.entryFunctions = _.flatMap(entries, (value, key) => {
          const entry = path.relative('.', value);
          const entryFile = _.replace(entry, new RegExp(`${path.extname(entry)}$`), '');

          const entryFuncs = _.filter(allEntryFunctions, ['handlerFile', entryFile]);
          if (_.isEmpty(entryFuncs)) {
            // We have to make sure that for each entry there is an entry function item.
            entryFuncs.push({});
          }
          _.forEach(entryFuncs, entryFunc => {
            entryFunc.entry = {
              key,
              value
            };
          });
          return entryFuncs;
        });

        this.webpackConfig = _.map(this.entryFunctions, entryFunc => {
          const config = _.cloneDeep(this.webpackConfig);
          config.entry = {
            [entryFunc.entry.key]: entryFunc.entry.value
          };
          const compileName = entryFunc.funcName || _.camelCase(entryFunc.entry.key);
          config.output.path = path.join(config.output.path, compileName);
          return config;
        });
      } else {
        this.webpackConfig.output.path = path.join(this.webpackConfig.output.path, 'service');
      }

      return BbPromise.resolve();
    };

    // Webpack config can be a Promise, If it's a Promise wait for resolved config object.
    if (this.webpackConfig && _.isFunction(this.webpackConfig.then)) {
      return BbPromise.resolve(this.webpackConfig.then(config => processConfig(config)));
    }

    return processConfig(this.webpackConfig);
  }
};
