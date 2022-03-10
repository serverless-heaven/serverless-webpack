import { fbgraph } from 'fbgraph';
import { toUpper } from 'lodash';

export const hello = function (event, context, cb) {
  cb(null, { message: toUpper('hello fb & aws'), event });
};
