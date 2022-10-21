// Should keep side-effects scripts
import 'dotenv/config';
// Should be included as fbgraph is not marked as sideEffect free
// Should keep named imports
import { toUpper, isEqual } from 'lodash';
// Should keep default imports

function getMessage() {
  return isEqual(true, false) ? 'noop' : toUpper('hello fb & aws');
}

export const hello = function (event, context, cb) {
  const message = getMessage();
  cb(null, { message, event });
};
