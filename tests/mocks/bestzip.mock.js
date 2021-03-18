'use strict';

/**
 * Mock object for bestzip
 */

const sinon = require('sinon');

const BestZipMock = sandbox => sandbox.stub();

module.exports.create = sandbox => {
  const hasNativeZip = sinon.stub();
  hasNativeZip.onCall(0).returns(false);
  hasNativeZip.onCall(1).returns(true);
  hasNativeZip.returns(false);

  return {
    bestzip: sinon.stub().resolves(BestZipMock(sandbox)),
    hasNativeZip,
  };
};
