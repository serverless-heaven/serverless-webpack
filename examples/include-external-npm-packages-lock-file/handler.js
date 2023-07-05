// Should keep side-effects scripts
import 'dotenv/config';
// Should be included as fbgraph is not marked as sideEffect free
// eslint-disable-next-line no-unused-vars, import/no-unresolved
import { fbgraph } from 'fbgraph';
// Should keep named imports
import { toUpper } from 'lodash';
// Should keep default imports
// eslint-disable-next-line import/no-unresolved
import isEqual from 'lodash.isequal';

function getMessage() {
  return isEqual(true, false) ? 'noop' : toUpper('hello fb & aws');
}

export const hello = function (event, _, cb) {
  const message = getMessage();
  cb(null, { message, event });
};
