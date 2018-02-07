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
});

const WatchMock = sandbox => ({
  close: sandbox.stub().callsFake(cb => cb())
});

const CompilerMock = (sandbox, statsMock, watchMock) => ({
  run: sandbox.stub().yields(null, statsMock),
  watch: sandbox.stub().returns(watchMock).yields(null, statsMock)
});

const webpackMock = sandbox => {
  const statsMock = StatsMock(sandbox);
  const watchMock = WatchMock(sandbox);
  const compilerMock = CompilerMock(sandbox, statsMock, watchMock);
  const mock = sinon.stub().returns(compilerMock);
  mock.compilerMock = compilerMock;
  mock.statsMock = statsMock;
  mock.watchMock = watchMock;
  return mock;
};

module.exports = sandbox => webpackMock(sandbox);
