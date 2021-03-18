'use strict';

/**
 * Mock object for fs
 */

module.exports.create = sandbox => {
  return {
    copy: sandbox.stub().yields(),
    pathExists: sandbox.stub().yields(),
    pathExistsSync: sandbox.stub().returns(false),
    removeSync: sandbox.stub()
  };
};
