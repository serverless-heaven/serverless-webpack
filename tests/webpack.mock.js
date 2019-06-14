'use strict';

const sinon = require('sinon');

const StatsMock = () => ({
  compilation: {
    errors: [],
    compiler: {
      outputPath: 'statsMock-outputPath',
    },
  },
  toString: sinon.stub().returns('testStats'),
  hasErrors() {
    return Boolean(this.compilation.errors.length);
  },
});


const CompilerMock = (sandbox, statsMock) => ({
  run: sandbox.stub().yields(null, statsMock),
  watch: sandbox.stub().yields(null, statsMock),
  hooks: {
    beforeCompile: {
      tapPromise: sandbox.stub()
    }
  },
});

const webpackMock = sandbox => {
  const statsMock = StatsMock(sandbox);
  const compilerMock = CompilerMock(sandbox, statsMock);
  const mock = sinon.stub().returns(compilerMock);
  mock.compilerMock = compilerMock;
  mock.statsMock = statsMock;
  return mock;
};

module.exports = sandbox => webpackMock(sandbox);
