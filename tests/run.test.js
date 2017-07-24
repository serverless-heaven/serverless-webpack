'use strict';

const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const makeWebpackMock = require('./webpack.mock');
const makeUtilsMock = require('./utils.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
const expect = chai.expect;

describe('run', () => {
  let sandbox;
  let webpackMock;
  let utilsMock;
  let baseModule;
  let serverless;
  let module;

  before(() => {
    sandbox = sinon.sandbox.create();
    sandbox.usingPromise(BbPromise);

    webpackMock = makeWebpackMock(sandbox);
    utilsMock = makeUtilsMock();

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('webpack', webpackMock);
    mockery.registerMock('./utils', utilsMock);
    baseModule = require('../lib/run');
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
    // This will reset the mocks too
    sandbox.restore();
  });

  describe('utils', () => {
    it('should expose utils methods', () => {
      expect(module.loadHandler).to.be.a('function');
      expect(module.getEvent).to.be.a('function');
      expect(module.getContext).to.be.a('function');
    });

    describe('loadHandler', () => {
      const testFunctionId = 'testFunctionId';
      const testHandlerModuleName = 'testHandlerModule';
      const testHandlerFunctionName = 'testHandlerFunction';
      const testFunctionsConfig = {
        [testFunctionId]: {
          handler: `${testHandlerModuleName}.${testHandlerFunctionName}`,
        }
      };
      const testPath = '/testpath';
      const testFilename = `${testHandlerModuleName}.js`;
      const testModuleFileName = `${testPath}/${testFilename}`;
      const testStats = {
        compilation: {
          options: {
            output: {
              path: testPath,
              filename: testFilename,
            },
          },
        },
      };
      const testHandlerFunction = sinon.spy();
      const testModule = {
        [testHandlerFunctionName]: testHandlerFunction,
      };

      before(() => {
        mockery.registerMock(testModuleFileName, testModule);
      });

      after(() => {
        mockery.deregisterMock(testModuleFileName);
      });

      beforeEach(() => {
        serverless.service.functions = testFunctionsConfig;
      });

      it('should require the handler module', () => {
        const res = module.loadHandler(testStats, testFunctionId);
        expect(res).to.equal(testHandlerFunction);
        expect(utilsMock.purgeCache).to.have.not.been.called;
      });

      it('should purge the modules cache if required', () => {
        const res = module.loadHandler(testStats, testFunctionId, true);
        expect(utilsMock.purgeCache).to.have.been.calledWith(testModuleFileName);
      });
    });

    it('should return a default event with `getEvent` and no option path', () => {
      module.options.path = null;
      const res = module.getEvent();
      expect(res).to.equal(null);
    });

    it('should load an event object from disk with `getEvent`', () => {
      const testPath = 'testPath';
      module.options.path = testPath;
      const testExampleObject = {};
      module.serverless.utils.readFileSync = sinon.stub().returns(testExampleObject);
      const res = module.getEvent();
      expect(res).to.equal(testExampleObject);
    });

    it('should return an context object with `getContext`', () => {
      const testFunctionName = 'testFunctionName';
      const res = module.getContext(testFunctionName);
      expect(res).to.eql({
        awsRequestId: 'testguid',
        functionName: testFunctionName,
        functionVersion: '$LATEST',
        invokeid: 'testguid',
        isDefaultFunctionVersion: true,
        logGroupName: `/aws/lambda/${testFunctionName}`,
        logStreamName: '2016/02/14/[HEAD]13370a84ca4ed8b77c427af260',
        memoryLimitInMB: '1024',
      });
    });
  });

  describe('watch', () => {
    let spawnStub;

    const testEvent = {};
    const testContext = {};
    const testStats = {};
    const testFunctionId = 'testFunctionId';
    const testFunctionResult = 'testFunctionResult';

    beforeEach(() => {
      spawnStub = sandbox.stub(serverless.pluginManager, 'spawn');
    });

    it('should throw if webpack watch fails', () => {
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(new Error('Failed'));

      expect(() => watch()).to.throw('Failed');
    });

    it('should not spawn invoke local on first run', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});

      watch();
      expect(spawnStub).to.not.have.been.called;
      expect(module.isWatching).to.be.true;
    });

    it('should spawn invoke local on subsequent runs', () => {
      module.isWatching = true;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});

      watch();
      expect(spawnStub).to.have.been.calledOnce;
      expect(spawnStub).to.have.been.calledWith('invoke:local');
      expect(module.isWatching).to.be.true;
    });

    it('should reset the service path', () => {
      module.isWatching = true;
      module.originalServicePath = 'originalPath';
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});

      watch();
      expect(serverless.config.servicePath).to.equal('originalPath');
    });
  });
});
