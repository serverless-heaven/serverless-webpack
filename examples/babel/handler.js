export const hello = (event, context, cb) => {
  const p = new Promise((resolve, reject) => {
    resolve('success');
  });
  p
    .then(r => cb(null, {
      message: 'Go Serverless Webpack (Babel) v1.0! Your function executed successfully!',
      event,
    }))
    .catch(e => cb(e));
};
