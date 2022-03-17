'use strict';

/**
 * Mock object for fs
 */

module.exports = {
  copy: jest.fn().mockResolvedValue(),
  pathExists: jest.fn().mockResolvedValue(true),
  pathExistsSync: jest.fn().mockReturnValue(false),
  removeSync: jest.fn().mockReturnValue(),
  remove: jest.fn()
};
