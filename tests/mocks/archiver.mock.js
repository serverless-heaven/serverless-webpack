'use strict';

/**
 * Mock object for glob
 */

const sinon = require('sinon');

const ZipMock = sandbox => ({
  pipe: sandbox.stub(),
  append: sandbox.stub(),
  finalize: sandbox.stub(),
  on: sandbox.stub()
});

module.exports.create = sandbox => {
  const zipMock = ZipMock(sandbox);
  const mock = {
    create: sinon.stub().returns(zipMock),
    _zipMock: zipMock
  };
  return mock;
};
