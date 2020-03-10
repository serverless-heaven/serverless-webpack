'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('compile', () => {
  let sandbox;
  let compilerMock;
  let multiCompilerMock;
  let baseModule;
  let serverless;
  let module;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise);

    compilerMock = sandbox.stub();
    multiCompilerMock = sandbox.stub();

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('./compiler', { compiler: compilerMock });
    mockery.registerMock('./multiCompiler/compiler', { multiCompiler: multiCompilerMock });

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

    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );
  });

  afterEach(() => {
    // This will reset the compilerMock too
    sandbox.restore();
    compilerMock.resetHistory();
    multiCompilerMock.resetHistory();
  });

  it('should expose a `compile` method', () => {
    expect(module.compile).to.be.a('function');
  });

  describe('single compile', () => {
    it('should fail if there are compilation errors', () => {
      module.webpackConfig = {};
      const mockStats = {
        stats: [
          {
            errors: ['error']
          }
        ]
      };
      // We stub errors here. It will be reset again in afterEach()
      compilerMock.resolves(mockStats);

      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      return expect(module.compile()).to.be.rejectedWith(/compilation error/);
    });

    it('should compile', () => {
      const testConsoleStats = 'minimal';
      const testWebpackConfig = {
        stats: testConsoleStats
      };
      const testWebpackConfigFilePath = 'testconfig.js';

      const testServicePath = 'testpath';
      const testOut = 'testout';
      const testConfigOptions = {
        servicePath: testServicePath,
        out: testOut
      };
      const testEntryFunctions = [];
      const testCompileOptions = {
        webpackConfigFilePath: testWebpackConfigFilePath,
        webpackConfig: testWebpackConfig,

        entryFunctions: testEntryFunctions,

        configOptions: testConfigOptions,
        consoleStats: testConsoleStats
      };
      const mockStats = {
        stats: [
          {
            errors: []
          }
        ]
      };
      compilerMock.resolves(mockStats);

      module.webpackConfig = testWebpackConfig;
      module.webpackConfigFilePath = testWebpackConfigFilePath;
      module.serverless.config.servicePath = testServicePath;
      module.options.out = testOut;
      module.entryFunctions = testEntryFunctions;
      return expect(module.compile()).to.be.fulfilled.then(() => {
        expect(compilerMock).to.have.been.calledWith(testCompileOptions);
        return null;
      });
    });
  });

  describe('multi compile', () => {
    it('should fail if there are compilation errors', () => {
      module.webpackConfig = {};
      const mockStats = {
        stats: [
          {
            errors: ['error']
          }
        ]
      };
      // We stub errors here. It will be reset again in afterEach()
      multiCompilerMock.resolves(mockStats);

      module.multiCompile = true;
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      return expect(module.compile()).to.be.rejectedWith(/compilation error/);
    });

    it('should compile', () => {
      const testConsoleStats = 'minimal';
      const testWebpackConfig = {
        stats: testConsoleStats
      };
      const testWebpackConfigFilePath = 'testconfig.js';

      const testServicePath = 'testpath';
      const testOut = 'testout';
      const testConfigOptions = {
        servicePath: testServicePath,
        out: testOut
      };
      const testEntryFunctions = [];
      const testMultiCompileOptions = {
        webpackConfigFilePath: testWebpackConfigFilePath,
        webpackConfig: testWebpackConfig,

        entryFunctions: testEntryFunctions,

        configOptions: testConfigOptions,
        consoleStats: testConsoleStats
      };
      const mockStats = {
        stats: [
          {
            errors: []
          }
        ]
      };
      multiCompilerMock.resolves(mockStats);

      module.webpackConfig = testWebpackConfig;
      module.webpackConfigFilePath = testWebpackConfigFilePath;
      module.multiCompile = true;
      module.serverless.config.servicePath = testServicePath;
      module.options.out = testOut;
      module.entryFunctions = testEntryFunctions;
      return expect(module.compile()).to.be.fulfilled.then(() => {
        expect(multiCompilerMock).to.have.been.calledWith(testMultiCompileOptions);
        return null;
      });
    });
  });
});
