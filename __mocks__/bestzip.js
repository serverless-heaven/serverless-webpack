'use strict';

/**
 * Mock object for bestzip
 */

const bestZipMock = jest.fn();

const hasNativeZip = jest.fn();
hasNativeZip.mockReturnValueOnce(false);
hasNativeZip.mockReturnValueOnce(true);
hasNativeZip.mockReturnValue(false);

module.exports = {
  nativeZip: jest.fn().mockResolvedValue(bestZipMock),
  nodeZip: jest.fn().mockResolvedValue(bestZipMock),
  hasNativeZip
};
