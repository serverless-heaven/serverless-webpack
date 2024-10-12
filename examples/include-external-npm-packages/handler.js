/* eslint-disable no-unused-vars */
'use strict';

const AWS = require('aws-sdk');
const cookie = require('cookie');

module.exports.hello = function (event, _, cb) {
  cb(null, { message: 'hello cookie & aws', event });
};
