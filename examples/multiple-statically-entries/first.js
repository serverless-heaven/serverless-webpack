'use strict';

module.exports.hello = function (event, context, cb) {
  cb(null, { message: 'First module', event });
};
