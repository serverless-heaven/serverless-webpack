'use strict';

const _ = require('lodash');
const path = require('path');

/**
 * Special settings for use with serverless-offline.
 */

module.exports = {
  prepareOfflineInvoke() {

    // Use service packaging for compile
    _.set(this.serverless, 'service.package.individually', false);

    return this.serverless.pluginManager.spawn('webpack:validate')
    .then(() => {
      // Set offline location automatically if not set manually
      if (!this.options.location && !_.get(this.serverless, 'service.custom.serverless-offline.location')) {
        _.set(this.serverless, 'service.custom.serverless-offline.location',
          path.relative(this.serverless.config.servicePath, path.join(this.webpackOutputPath, 'service'))
        );
      }
      return null;
    });
  }
};
