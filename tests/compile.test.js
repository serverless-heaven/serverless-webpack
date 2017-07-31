'use strict';

const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const makeWebpackMock = require('./webpack.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
const expect = chai.expect;

describe('compile', () => {
  let sandbox;
  let webpackMock;
  let baseModule;
  let serverless;
  let module;

  before(() => {
    sandbox = sinon.sandbox.create();
    sandbox.usingPromise(BbPromise);

    webpackMock = makeWebpackMock(sandbox);

    mockery.enable({ warnOnUnregistered: false });
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
      log: sandbox.stub(),
      consoleLog: sandbox.stub()
    };

    module = Object.assign({
      serverless,
      options: {},
    }, baseModule);
  });

  afterEach(() => {
    // This will reset the webpackMock too
    sandbox.restore();
  });

  it('should expose a `compile` method', () => {
    expect(module.compile).to.be.a('function');
  });

  it('should compile with webpack from a context configuration', () => {
    const testWebpackConfig = 'testconfig';
    module.webpackConfig = testWebpackConfig;
    return expect(module.compile()).to.be.fulfilled
    .then(() => {
      expect(webpackMock).to.have.been.calledWith(testWebpackConfig);
      expect(webpackMock.compilerMock.run).to.have.been.calledOnce;
    });
  });

  it('should fail if there are compilation errors', () => {
    module.webpackConfig = 'testconfig';
    // We stub errors here. It will be reset again in afterEach()
    sandbox.stub(webpackMock.statsMock.compilation, 'errors').value(['error']);
    return expect(module.compile()).to.be.rejectedWith(/compilation error/);
  });

  it('should set context `webpackOutputPath`, `originalServicePath`, `serverless.config.servicePath`', () => {
    const testWebpackConfig = 'testconfig';
    module.webpackConfig = testWebpackConfig;
    const testServicePath = 'testServicePath';
    module.serverless.config.servicePath = testServicePath;
    const testOutputPath = 'testOutputPath';
    webpackMock.statsMock.compilation.compiler.outputPath = testOutputPath;
    return expect(module.compile()).to.be.fulfilled
    .then(() => {
      expect(module.webpackOutputPath).to.equal(testOutputPath);
      expect(module.originalServicePath).to.equal(testServicePath);
      expect(module.serverless.config.servicePath).to.equal(testOutputPath);
    });
  });
});
