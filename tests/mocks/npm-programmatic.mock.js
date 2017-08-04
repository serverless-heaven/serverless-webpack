'use strict';

/**
 * Mock object for fs
 */

module.exports.create = sandbox => {
  const npmMock = {
    install: sandbox.stub(),
  };

  return npmMock;
};
