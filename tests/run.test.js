'use strict';

const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const makeWebpackMock = require('./webpack.mock');
const makeUtilsMock = require('./utils.mock');
chai.use(require('sinon-chai'));
const expect = chai.expect;

describe('run', () => {
  let webpackMock;
  let utilsMock;
  let baseModule;
  let module;
  let serverless;

  before(() => {
    mockery.enable({ warnOnUnregistered: false });
    webpackMock = makeWebpackMock();
    utilsMock = makeUtilsMock();
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
      log: sinon.spy(),
      consoleLog: sinon.spy(),
    };
    webpackMock._resetSpies();
    utilsMock._resetSpies();
    module = Object.assign({
      serverless,
      options: {},
    }, baseModule);
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
        expect(utilsMock.purgeCache).to.have.callCount(0);
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

  describe('run', () => {
    const testEvent = {};
    const testContext = {};
    const testStats = {};
    const testFunctionId = 'testFunctionId';
    const testFunctionResult = 'testFunctionResult';

    beforeEach(() => {
      module.options['function'] = testFunctionId;
      module.getEvent = sinon.stub().returns(testEvent);
      module.getContext = sinon.stub().returns(testContext);
    });

    it('should execute the given function handler', () => {
      const testHandlerFunc = sinon.spy((e, c, cb) => cb(null, testFunctionResult));
      module.loadHandler = sinon.stub().returns(testHandlerFunc);
      return module
        .run(testStats)
        .then((res) => {
          expect(res).to.equal(testFunctionResult);
          expect(testHandlerFunc).to.have.been.calledWith(
            testEvent,
            testContext
          );
        });
    });

    it('should fail if the function handler returns an error', () => {
      const testError = 'testError';
      const testHandlerFunc = sinon.spy((e, c, cb) => cb(testError));
      module.loadHandler = sinon.stub().returns(testHandlerFunc);
      return module
        .run(testStats)
        .catch((res) => {
          expect(res).to.equal(testError);
        });
    });
  });

  describe('watch', () => {
    const testEvent = {};
    const testContext = {};
    const testStats = {};
    const testFunctionId = 'testFunctionId';
    const testFunctionResult = 'testFunctionResult';

    beforeEach(() => {
      module.options['function'] = testFunctionId;
      module.getEvent = sinon.stub().returns(testEvent);
      module.getContext = sinon.stub().returns(testContext);
    });

    it('should throw if webpack watch fails', () => {
      const testError = 'testError';
      webpackMock.compilerMock.watch = sinon.spy((opt, cb) => cb(testError));
      expect(module.watch.bind(module)).to.throw(testError);
    });

    it('should throw if function handler fails', () => {
      const testError = 'testHandlerError';
      const testHandlerFunc = sinon.spy((e, c, cb) => cb(testError));
      module.loadHandler = sinon.stub().returns(testHandlerFunc);
      let testCb;
      webpackMock.compilerMock.watch = sinon.spy((opt, cb) => {
        testCb = cb;
        cb(null, webpackMock.statsMock);
      });
      expect(module.watch.bind(module)).to.throw(testError);
    });

    it('should call the handler every time a compilation occurs', () => {
      const testHandlerFunc = sinon.spy((e, c, cb) => cb(null, testFunctionResult));
      module.loadHandler = sinon.stub().returns(testHandlerFunc);
      let testCb;
      webpackMock.compilerMock.watch = sinon.spy((opt, cb) => {
        testCb = cb;
        cb(null, webpackMock.statsMock);
      });
      module.watch();
      expect(testHandlerFunc).to.have.callCount(1);
      testCb(null, webpackMock.statsMock);
      expect(testHandlerFunc).to.have.callCount(2);
    });
  });
});
