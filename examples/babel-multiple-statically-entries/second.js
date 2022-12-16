/* eslint-disable promise/no-callback-in-promise */
export const hello = (event, _, cb) => {
  const p = new Promise(resolve => {
    resolve('success');
  });
  p.then(() =>
    cb(null, {
      message: 'Go Serverless Webpack (Babel) v1.0! Second module!',
      event
    })
  ).catch(e => cb(e));
};
