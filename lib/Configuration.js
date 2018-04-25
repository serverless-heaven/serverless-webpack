'use strict';
/**
 * Plugin configuration.
 */

const _ = require('lodash');

/** 
 * Plugin defaults
 */
const DefaultConfig = {
  webpackConfig: 'webpack.config.js',
  includeModules: false,
  packager: 'npm',
  packagerOptions: {},
  config: null
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

    // Set defaults for all missing properties
    _.defaults(this._config, DefaultConfig);
  }

  get webpackConfig() {
    return this._config.webpackConfig;
  }

  get includeModules() {
    return this._config.includeModules;
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

  toJSON() {
    return _.omitBy(this._config, _.isNil);
  }
}

module.exports = Configuration;