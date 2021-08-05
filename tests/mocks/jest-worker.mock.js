'use strict';

const _ = require('lodash');

class JestWorkerMock {
  constructor(workerPath) {
    this.workerPath = workerPath;
  }

  compile(...args) {
    return require(this.workerPath).compile(...args);
  }

  getStdout() {
    return { pipe: _.noop };
  }

  end() {
    return Promise.resolve();
  }
}

/**
 * Mock object for jest-worker
 */

module.exports = () => {
  return {
    Worker: JestWorkerMock
  };
};
