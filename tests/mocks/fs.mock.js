'use strict';

/**
 * Mock object for fs
 */

// We need sinon to create persistent stubs that are not cleared with the sandbox
const sinon = require('sinon');

const StreamMock = sandbox => ({
  on: sandbox.stub()
});

const StatMock = sandbox => ({
  isDirectory: sandbox.stub()
});

module.exports.create = sandbox => {
  const streamMock = StreamMock(sandbox);
  const statMock = StatMock(sandbox);
  const fsMock = {
    createWriteStream: sinon.stub().returns(streamMock), // Persistent stub
    readFileSync: sandbox.stub(),
    statSync: sinon.stub().returns(statMock), // Persistent stub
    writeFileSync: sandbox.stub(),

    _streamMock: streamMock,
    _statMock: statMock
  };

  return fsMock;
};
