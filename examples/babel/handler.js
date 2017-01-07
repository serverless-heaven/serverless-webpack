if (!global._babelPolyfill) {
   require('babel-polyfill');
}

export const hello = (event, context, cb) => {
  const p = new Promise((resolve, reject) => {
    resolve('success');
  });
  p
    .then(r => cb(null, {
      statusCode: 200,
      body: JSON.stringify({
        "message": 'Go Serverless Webpack (Babel) v1.0! Your function executed successfully!',
        "event": event
      }),
    }))
    .catch(e => cb(e));
};
