'use strict';

const sinon = require('sinon');

const StatsMock = sandbox => ({
  compilation: {
    errors: [],
    compiler: {
      outputPath: 'statsMock-outputPath',
    },
  },
  toString: sandbox.stub().returns('testStats'),
});

const CompilerMock = (sandbox, statsMock) => ({
  run: sandbox.stub().yields(null, statsMock),
  watch: sandbox.stub().yields(null, statsMock)
});

const webpackMock = sandbox => {
  const statsMock = StatsMock(sandbox);
  const compilerMock = CompilerMock(sandbox, statsMock);
  const mock = sandbox.stub().returns(compilerMock);
  mock.compilerMock = compilerMock;
  mock.statsMock = statsMock;
  return mock;
}

module.exports = sandbox => webpackMock(sandbox);
