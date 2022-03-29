'use strict';

/**
 * Mock object for fs
 */

const streamMock = {
  on: jest.fn()
};

const statMock = {
  isDirectory: jest.fn()
};

const actual = jest.requireActual('fs');

module.exports = {
  ...actual,
  createWriteStream: jest.fn().mockReturnValue(streamMock),
  readFileSync: jest.fn(),
  statSync: jest.fn().mockReturnValue(statMock),
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn(),

  _streamMock: streamMock,
  _statMock: statMock
};
