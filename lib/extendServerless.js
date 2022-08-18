const _ = require('lodash');

const extendFunctionProperties = serverless => {
  if (_.isFunction(serverless.configSchemaHandler.defineFunctionProperties)) {
    serverless.configSchemaHandler.defineFunctionProperties('aws', {
      properties: {
        entrypoint: { type: 'string' }
      }
    });
  }
};

module.exports = {
  extendFunctionProperties
};
