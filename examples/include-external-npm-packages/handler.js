'use strict';

const AWS = require('aws-sdk');
const fbgraph = require('fbgraph');

module.exports.hello = function (event, context, cb) {
  cb(null, { message: 'hello fb & aws', event });
};
