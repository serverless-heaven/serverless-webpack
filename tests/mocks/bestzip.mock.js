'use strict';

/**
 * Mock object for bestzip
 */

const sinon = require('sinon');

const BestZipMock = sandbox => sandbox.stub();

module.exports.create = sandbox => {
  const bestzipMock = BestZipMock(sandbox);
  const mock = sinon.stub().resolves(bestzipMock);
  return mock;
};
