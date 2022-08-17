const extendFunctionProperties = (serverless) => {
    if (typeof serverless.configSchemaHandler.defineFunctionProperties === 'function') {
        serverless.configSchemaHandler.defineFunctionProperties('aws', {
            properties: {
                entrypoint: { type: 'string' }
            }
        })
    }
}

module.exports = {
    extendFunctionProperties
}