import cookie from 'cookie'

export const hello = (event, context, cb) => cb(null,
  {
    message: 'Go Serverless Webpack (Serverless v4) v1.0! Your function executed successfully!',
    event,
  }
);
