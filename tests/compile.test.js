'use strict';

const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const makeWebpackMock = require('./webpack.mock');
chai.use(require('sinon-chai'));
const expect = chai.expect;

describe('compile', () => {
  let webpackMock;
  let baseModule;
  let module;
  let serverless;

  before(() => {
    mockery.enable({ warnOnUnregistered: false });
    webpackMock = makeWebpackMock();
    mockery.registerMock('webpack', webpackMock);
    baseModule = require('../lib/compile');
    Object.freeze(baseModule);
  });

  after(() => {
    mockery.disable();
    mockery.deregisterAll();
  });

  beforeEach(() => {
    serverless = new Serverless();
    serverless.cli = {
      log: sinon.spy(),
      consoleLog: sinon.spy(),
    };
    webpackMock._resetSpies();
    module = Object.assign({
      serverless,
      options: {},
    }, baseModule);
  });

  it('should expose a `compile` method', () => {
    expect(module.compile).to.be.a('function');
  });

  it('should compile with webpack from a context configuration', () => {
    const testWebpackConfig = 'testconfig';
    module.webpackConfig = testWebpackConfig;
    return module
      .compile()
      .then(() => {
        expect(webpackMock).to.have.been.calledWith(testWebpackConfig);
        expect(webpackMock.compilerMock.run).to.have.callCount(1);
      });
  });

  it('should fail if there are compilation errors', () => {
    module.webpackConfig = 'testconfig';
    webpackMock.statsMock.compilation.errors = ['error'];
    return module
      .compile()
      .catch((err) => {
        expect(err.toString()).to.match(/compilation error/);
      });
  });

  it('should set context `webpackOutputPath`, `originalServicePath`, `serverless.config.servicePath`', () => {
    const testWebpackConfig = 'testconfig';
    module.webpackConfig = testWebpackConfig;
    const testServicePath = 'testServicePath';
    module.serverless.config.servicePath = testServicePath;
    const testOutputPath = 'testOutputPath';
    webpackMock.statsMock.compilation.compiler.outputPath = testOutputPath;
    return module
      .compile()
      .then(() => {
        expect(module.webpackOutputPath).to.equal(testOutputPath);
        expect(module.originalServicePath).to.equal(testServicePath);
        expect(module.serverless.config.servicePath).to.equal(testOutputPath);
      });
  });
});
