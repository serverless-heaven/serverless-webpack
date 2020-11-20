import { App } from '../lib/App';

export const hello = (event, context, cb) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Do not return the promise as we use the callback
  // This resolved promise would be be in the application library code in a real-world application and provide the results
  App.handleSecond(event) // eslint-disable-line promise/catch-or-return
    .then(result => ({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify(result)
    }))
    .asCallback(cb);

  return;
};
