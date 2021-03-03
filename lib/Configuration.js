'use strict';
/**
 * Plugin configuration.
 */

const _ = require('lodash');
const os = require('os');

/**
 * Plugin defaults
 */
const DefaultConfig = {
  webpackConfig: 'webpack.config.js',
  includeModules: false,
  packager: 'npm',
  packagerOptions: {},
  keepOutputDirectory: false,
  config: null,
  concurrency: os.cpus().length
};

class Configuration {
  constructor(custom) {
    this._config = {};
    this._hasLegacyConfig = false;

    // Set configuration from sls.service.custom. We fall back to the
    // old configuration to keep backwards compatibility.
    if (custom) {
      if (custom.webpackIncludeModules) {
        this._config.includeModules = custom.webpackIncludeModules;
        this._hasLegacyConfig = true;
      }
      if (_.isString(custom.webpack)) {
        this._config.webpackConfig = custom.webpack;
        this._hasLegacyConfig = true;
      } else {
        _.assign(this._config, custom.webpack || {});
      }
    }

    // Concurrency may be passed via CLI, e.g.
    // custom:
    //   webpack:
    //     concurrency: ${opt:compile-concurrency, 7}
    // In this case it is typed as a string and we have to validate it
    if (this._config.concurrency !== undefined) {
      this._config.concurrency = Number(this._config.concurrency);
      if (isNaN(this._config.concurrency) || this._config.concurrency < 1) {
        throw new Error('concurrency option must be a positive number');
      }
    } else if (this._config.serializedCompile === true) {
      // Backwards compatibility with serializedCompile setting
      this._config.concurrency = 1;
    }

    // Set defaults for all missing properties
    _.defaults(this._config, DefaultConfig);
  }

  get webpackConfig() {
    return this._config.webpackConfig;
  }

  get includeModules() {
    return this._config.includeModules;
  }

  get excludeFiles() {
    return this._config.excludeFiles;
  }

  get excludeRegex() {
    return this._config.excludeRegex;
  }

  get packager() {
    return this._config.packager;
  }

  get packagerOptions() {
    return this._config.packagerOptions;
  }

  get config() {
    return this._config.config;
  }

  get hasLegacyConfig() {
    return this._hasLegacyConfig;
  }

  get keepOutputDirectory() {
    return this._config.keepOutputDirectory;
  }

  get concurrency() {
    return this._config.concurrency;
  }

  toJSON() {
    return _.omitBy(this._config, _.isNil);
  }
}

module.exports = Configuration;
