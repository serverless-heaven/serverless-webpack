const _ = require('lodash');

const extendFunctionProperties = serverless => {
  _.invoke(serverless, 'configSchemaHandler.defineFunctionProperties', 'aws', {
    properties: {
      entrypoint: { type: 'string' }
    }
  });
};

module.exports = {
  extendFunctionProperties
};
