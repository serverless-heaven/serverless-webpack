'use strict';

/**
 * Mock object for bestzip
 */

const sinon = require('sinon');

const BestZipMock = sandbox => sandbox.stub();

module.exports.create = sandbox => {
  return {
    bestzip: sinon.stub().resolves(BestZipMock(sandbox)),
    hasNativeZip: sandbox.stub().returns(false),
  };
};
