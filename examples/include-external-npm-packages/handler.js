'use strict';

var AWS = require('aws-sdk');
var fbgraph = require('fbgraph');

module.exports.hello = function (event, context, cb) {
 cb(null, { message: 'hello fb & aws', event });
}
