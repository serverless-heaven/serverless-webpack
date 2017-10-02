'use strict';

/**
 * Mock object for fs
 */

module.exports.create = sandbox => {
  const fsExtraMock = {
    copy: sandbox.stub().yields(),
    pathExists: sandbox.stub().yields()
  };

  return fsExtraMock;
};
