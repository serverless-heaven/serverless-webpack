'use strict';

/**
 * Mock object for fs
 */

module.exports.create = sandbox => {
  const childProcessMock = {
    exec: sandbox.stub().yields(),
    spawn: sandbox.stub().returns(/* child process object */),
    execSync: sandbox.stub().returns('{}')
  };

  return childProcessMock;
};
