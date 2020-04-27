export const goodbye = (event, context, cb) => cb(null,
  { message: 'Goodbye Serverless Webpack (Typescript) v1.0! Your function executed successfully!', event }
);