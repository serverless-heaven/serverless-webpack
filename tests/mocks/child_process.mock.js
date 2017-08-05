'use strict';

/**
 * Mock object for fs
 */

module.exports.create = sandbox => {
  const childProcessMock = {
    exec: sandbox.stub().yields(),
  };

  return childProcessMock;
};
