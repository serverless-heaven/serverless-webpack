/* eslint-disable no-unused-vars */
'use strict';

const AWS = require('aws-sdk');
const fbgraph = require('fbgraph');

module.exports.hello = function (event, _, cb) {
  cb(null, { message: 'hello fb & aws', event });
};
