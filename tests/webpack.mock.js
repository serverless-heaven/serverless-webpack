'use strict';

const sinon = require('sinon');

const statsMockBase = () => ({
  compilation: {
    errors: [],
    compiler: {
      outputPath: 'statsMock-outputPath',
    },
  },
  toString: () => 'testStats',
});

const statsMock = {};

Object.assign(statsMock, statsMockBase());

const compilerMock = {
  run: sinon.spy((cb) => cb(null, statsMock)),
  watch: sinon.spy((opt, cb) => cb(null, statsMock)),
};

const webpackMock = sinon.stub().returns(compilerMock);
webpackMock.statsMock = statsMock;
webpackMock.compilerMock = compilerMock;
webpackMock._resetSpies = () => {
  webpackMock.reset();
  compilerMock.run.reset();
  compilerMock.watch.reset();
  Object.assign(statsMock, statsMockBase());
};

module.exports = () => webpackMock;
