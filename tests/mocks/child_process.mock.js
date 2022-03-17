'use strict';

/**
 * Mock object for fs
 */

module.exports.create = sandbox => {
  return {
    exec: jest.fn().yields(),
    spawn: jest.fn().mockReturnValue(/* child process object */),
    execSync: jest.fn().mockReturnValue('{}')
  };
};
