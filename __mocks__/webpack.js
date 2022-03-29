'use strict';

const statsMock = {
  compilation: {
    errors: [],
    compiler: {
      outputPath: 'statsMock-outputPath'
    },
    modules: []
  },
  toString: jest.fn().mockReturnValue('testStats'),
  hasErrors() {
    return Boolean(this.compilation.errors.length);
  }
};

const compilerMock = {
  run: jest.fn().mockImplementation(cb => cb(null, statsMock)),
  watch: jest.fn().mockImplementation(cb => cb(null, statsMock)),
  hooks: {
    beforeCompile: {
      tapPromise: jest.fn()
    }
  },
  plugin: jest.fn().mockImplementation((name, cb) => cb(null, {}))
};

const mock = jest.fn().mockReturnValue(compilerMock);
mock.compilerMock = compilerMock;
mock.statsMock = statsMock;

module.exports = mock;
