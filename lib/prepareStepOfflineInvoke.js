'use strict';

const _ = require('lodash');
const path = require('path');

/**
 * Special settings for use with serverless-step-functions-offline.
 */

module.exports = {
  prepareStepOfflineInvoke() {
    _.set(this.serverless, 'service.package.individually', false);

    return this.serverless.pluginManager.spawn('webpack:validate')
      .then(() => {
        if (!this.options.location && !_.get(this.serverless, 'service.custom.stepFunctionsOffline.location')) {
          _.set(this.serverless, 'service.custom.stepFunctionsOffline.location',
            path.relative(this.serverless.config.servicePath, path.join(this.webpackOutputPath, 'service'))
          );
        }
        return null;
      });
  }
};
