'use strict';

/**
 * Mock object for glob
 */

const GlobMock = sandbox => ({
  sync: sandbox.stub()
});

module.exports.create = sandbox => {
  return GlobMock(sandbox);
};
