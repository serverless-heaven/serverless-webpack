'use strict';

const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const makeWebpackMock = require('./webpack.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('compiler', () => {
  let sandbox;
  let webpackMock;

  let compiler;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise);

    webpackMock = makeWebpackMock(sandbox);

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('webpack', webpackMock);
    compiler = require('../lib/compiler');
  });

  after(() => {
    mockery.disable();
    mockery.deregisterAll();
  });

  afterEach(() => {
    // This will reset the webpackMock too
    sandbox.restore();
  });

  it('should expose a `compiler` method', () => {
    expect(compiler.compiler).to.be.a('function');
  });

  it('should compile with webpack from a context configuration', () => {
    const testWebpackConfig = { entry: 'test' };
    const testConfigOptions = {
      servicePath: 'test/foo.js',
      out: 'dist/'
    };
    const testConsoleStats = {};
    const testOptions = {
      webpackConfig: testWebpackConfig,
      configOptions: testConfigOptions,
      consoleStats: testConsoleStats
    };
    return expect(compiler.compiler(testOptions)).to.be.fulfilled.then(() => {
      expect(webpackMock).to.have.been.calledWith(testWebpackConfig);
      expect(webpackMock.compilerMock.run).to.have.been.calledOnce;
      return null;
    });
  });
});
