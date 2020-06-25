'use strict';

/**
 * Mock object for bestzip
 */

const sinon = require('sinon');

// const BestZipMock = sandbox => ({
//   bestzip: sandbox.stub()
// });
const BestZipMock = sandbox => sandbox.stub();

module.exports.create = sandbox => {
  const bestzipMock = BestZipMock(sandbox);
  const mock = {
    create: sinon.stub().returns(bestzipMock),
    _bestzipMock: bestzipMock
  };
  return mock;
};
