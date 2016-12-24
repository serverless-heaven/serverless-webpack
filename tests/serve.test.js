'use strict';

const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const makeWebpackMock = require('./webpack.mock');
const makeExpressMock = require('./express.mock');
chai.use(require('sinon-chai'));
const expect = chai.expect;

describe('serve', () => {
  let webpackMock;
  let expressMock;
  let baseModule;
  let module;
  let serverless;

  before(() => {
    mockery.enable({ warnOnUnregistered: false });
    webpackMock = makeWebpackMock();
    expressMock = makeExpressMock();
    mockery.registerMock('webpack', webpackMock);
    mockery.registerMock('express', expressMock);
    baseModule = require('../lib/serve');
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
    expressMock._resetSpies();
    module = Object.assign({
      serverless,
      options: {},
    }, baseModule);
  });

  describe('_handlerBase', () => {
    it('should return an express handler', () => {
      const testFuncConf = {
        id: 'testFuncId',
        handerFunc: sinon.spy(),
      };
      const handler = module._handlerBase(testFuncConf);
      expect(handler).to.be.a('function');
    });

    it('should send a 200 express response if successful', () => {
      const testHandlerResp = 'testHandlerResp';
      const testHandlerFunc = sinon.spy((ev, ct, cb) => {
        cb(null, testHandlerResp);
      });
      const testFuncConf = {
        id: 'testFuncId',
        handlerFunc: testHandlerFunc,
      };
      const testHttpEvent = {
        integration: 'lambda'
      }
      const testReq = {
        method: 'testmethod',
        headers: 'testheaders',
        body: 'testbody',
        params: 'testparams',
        query: 'testquery',
      };
      const testRes = {
        send: sinon.spy(),
      };
      testRes.status = sinon.stub().returns(testRes);
      module.getContext = sinon.stub().returns('testContext');
      const handler = module._handlerBase(testFuncConf, testHttpEvent);
      handler(testReq, testRes);
      expect(testRes.status).to.have.been.calledWith(200);
      expect(testRes.send).to.have.been.calledWith(testHandlerResp);
      expect(testHandlerFunc).to.have.been.calledWith(
        {
          body: 'testbody',
          headers: 'testheaders',
          method: 'testmethod',
          path: 'testparams',
          query: 'testquery',
        },
        'testContext'
      );
    });

    it('should send a 500 express response if fails', () => {
      const testHandlerErr = 'testHandlerErr';
      const testHandlerFunc = sinon.spy((ev, ct, cb) => {
        cb(testHandlerErr);
      });
      const testFuncConf = {
        id: 'testFuncId',
        handlerFunc: testHandlerFunc,
      };
      const testRes = {
        send: sinon.spy(),
      };
      testRes.status = sinon.stub().returns(testRes);
      module.getContext = sinon.stub().returns('testContext');
      const handler = module._handlerBase(testFuncConf);
      handler({}, testRes);
      expect(testRes.status).to.have.been.calledWith(500);
      expect(testRes.send).to.have.been.calledWith(testHandlerErr);
    });

    it('handles lambda-proxy integration for request and response', () => {
      const testHandlerResp = { statusCode: 200, body: 'testHandlerResp' };
      const testHandlerFunc = sinon.spy((ev, ct, cb) => {
        cb(null, testHandlerResp);
      });
      const testFuncConf = {
        id: 'testFuncId',
        handlerFunc: testHandlerFunc,
      };
      const testHttpEvent = {}
      const testReq = {
        method: 'testmethod',
        headers: 'testheaders',
        body: 'testbody',
        params: 'testparams',
        query: 'testquery',
      };
      const testRes = {
        send: sinon.spy(),
      };
      testRes.status = sinon.stub().returns(testRes);
      module.getContext = sinon.stub().returns('testContext');
      const handler = module._handlerBase(testFuncConf, testHttpEvent);
      handler(testReq, testRes);
      expect(testRes.status).to.have.been.calledWith(testHandlerResp.statusCode);
      expect(testRes.send).to.have.been.calledWith(testHandlerResp.body);
      expect(testHandlerFunc).to.have.been.calledWith(
        {
          body: 'testbody',
          headers: 'testheaders',
          method: 'testmethod',
          pathParameters: 'testparams',
          queryStringParameters: 'testquery',
        },
        'testContext'
      );
    });
  });

  describe('_optionsHandler', () => {
    it('should send a 200 express response', () => {
      const testRes = {
        sendStatus: sinon.spy(),
      };
      const handler = module._optionsHandler;
      handler({}, testRes);
      expect(testRes.sendStatus).to.have.been.calledWith(200);
    });
  });

  describe('_handlerAddCors', () => {
    it('should retun an express handler', () => {
      const res = module._handlerAddCors();
      expect(res).to.be.a('function');
    });

    it('should call the given handler when called adding CORS headers', () => {
      const testHandler = sinon.spy();
      const res = {
        header: sinon.spy(),
      };
      const req = {};
      const next = () => {};
      module._handlerAddCors(testHandler)(req, res, next);
      expect(testHandler).to.have.been.calledWith(req, res, next);
      expect(res.header).to.have.been.calledWith(
        'Access-Control-Allow-Origin',
        '*'
      );
      expect(res.header).to.have.been.calledWith(
        'Access-Control-Allow-Methods',
        'GET,PUT,HEAD,PATCH,POST,DELETE,OPTIONS'
      );
      expect(res.header).to.have.been.calledWith(
        'Access-Control-Allow-Headers',
        'Authorization,Content-Type,x-amz-date,x-amz-security-token'
      );
    });
  });

  describe('_getPort', () => {
    it('should return a default port', () => {
      const port = module._getPort();
      expect(port).to.equal(8000);
    });

    it('should return the input option port if specified', () => {
      module.options.port = 1234;
      const port = module._getPort();
      expect(port).to.equal(1234);
    });
  });

  describe('_getFuncConfig', () => {
    const testFunctionsConfig = {
      func1: {
        handler: 'module1.func1handler',
        events: [{
          http: {
            method: 'get',
            path: 'func1path',
          },
        }],
      },
      func2: {
        handler: 'module2.func2handler',
        events: [{
          http: {
            method: 'POST',
            path: 'func2path',
          },
        }, {
          nonhttp: 'non-http',
        }],
      },
      func3: {
        handler: 'module2.func3handler',
        events: [{
          nonhttp: 'non-http',
        }],
      },
    };

    beforeEach(() => {
      serverless.service.functions = testFunctionsConfig;
    });

    it('should return a list of normalized functions configurations', () => {
      const res = module._getFuncConfigs();
      expect(res).to.eql([
        {
          'events': [
            {
              'method': 'get',
              'path': 'func1path',
            }
          ],
          'handler': 'module1.func1handler',
          'handlerFunc': null,
          'id': 'func1',
          'moduleName': 'module1',
        },
        {
          'events': [
            {
              'method': 'POST',
              'path': 'func2path',
            }
          ],
          'handler': 'module2.func2handler',
          'handlerFunc': null,
          'id': 'func2',
          'moduleName': 'module2',
        },
      ]);
    });
  });

  describe('_newExpressApp', () => {
    it('should return an express app', () => {
      const res = module._newExpressApp([]);
      expect(res).to.equal(expressMock.appMock);
    });

    it('should add a body-parser to the app', () => {
      const res = module._newExpressApp([]);
      expect(res.use).to.have.been.calledWith(sinon.match(value => {
        return typeof value === 'function' && value.name === 'jsonParser';
      }));
    });

    it('should create express handlers for all functions http event', () => {
      const testFuncsConfs = [
        {
          'events': [
            {
              'method': 'get',
              'path': 'func1path',
              'cors': true,
            }
          ],
          'handler': 'module1.func1handler',
          'handlerFunc': null,
          'id': 'func1',
          'moduleName': 'module1',
        },
        {
          'events': [
            {
              'method': 'POST',
              'path': 'func2path/{testParam}',
            }
          ],
          'handler': 'module2.func2handler',
          'handlerFunc': null,
          'id': 'func2',
          'moduleName': 'module2',
        },
      ];
      const testStage = 'test';
      module.options.stage = testStage;
      const testHandlerBase = 'testHandlerBase';
      const testHandlerCors = 'testHandlerCors';
      const testHandlerOptions = 'testHandlerOptions';
      module._handlerBase = sinon.stub().returns(testHandlerBase);
      module._optionsHandler = testHandlerOptions;
      module._handlerAddCors = sinon.stub().returns(testHandlerCors);
      const app = module._newExpressApp(testFuncsConfs);
      expect(app.get).to.have.callCount(1);
      expect(app.get).to.have.been.calledWith(
        '/test/func1path',
        testHandlerCors
      );
      expect(module.serverless.cli.consoleLog).to.have.been.calledWith(
        '  GET - http://localhost:8000/test/func1path'
      );
      expect(app.post).to.have.callCount(1);
      expect(app.post).to.have.been.calledWith(
        '/test/func2path/:testParam',
        testHandlerBase
      );
      expect(module.serverless.cli.consoleLog).to.have.been.calledWith(
        '  POST - http://localhost:8000/test/func2path/{testParam}'
      );
      expect(app.options).to.have.callCount(2);
      expect(app.options.firstCall).to.have.been.calledWith(
        '/test/func1path',
        testHandlerCors
      );
      expect(app.options.secondCall).to.have.been.calledWith(
        '/test/func2path/:testParam',
        testHandlerOptions
      );
    });
  });

  describe('serve method', () => {
    let serve;
    let listenerCb;

    beforeEach(() => {
      serve = module.serve();
      listenerCb = expressMock.appMock.listen.firstCall.args[1];
    });

    it('should start an express app listener', () => {
      expect(expressMock.appMock.listen).to.have.callCount(1);
    });

    it('should start a webpack watcher', () => {
      listenerCb.bind(module)();
      expect(webpackMock.compilerMock.watch).to.have.callCount(1);
    });

    it('should throw if compiler fails', () => {
      listenerCb.bind(module)();
      const compileCb = webpackMock.compilerMock.watch.firstCall.args[1];
      const testError = 'testError';
      expect(compileCb.bind(module, testError)).to.throw(testError);
    });

    it('should reload all function handlers on compilation', () => {
      const testFuncsConfs = [
        {
          'events': [
            {
              'method': 'get',
              'path': 'func1path',
              'cors': true,
            }
          ],
          'handler': 'module1.func1handler',
          'handlerFunc': null,
          'id': 'func1',
          'moduleName': 'module1',
        },
        {
          'events': [
            {
              'method': 'POST',
              'path': 'func2path/{testParam}',
            }
          ],
          'handler': 'module2.func2handler',
          'handlerFunc': null,
          'id': 'func2',
          'moduleName': 'module2',
        },
        {
          'events': [
            {
              'method': 'GET',
              'path': 'func3path',
            }
          ],
          'handler': 'module2.func2handler',
          'handlerFunc': null,
          'id': 'func3',
          'moduleName': 'module2',
        },
      ];
      module._getFuncConfigs = sinon.stub().returns(testFuncsConfs);
      module.loadHandler = sinon.spy();
      expressMock._resetSpies();
      webpackMock._resetSpies();
      serve = module.serve();
      listenerCb = expressMock.appMock.listen.firstCall.args[1];
      listenerCb.bind(module)();
      const compileCb = webpackMock.compilerMock.watch.firstCall.args[1];
      const testStats = {};
      module.loadHandler.reset();
      compileCb.bind(module)(null, testStats);
      expect(module.loadHandler).to.have.callCount(3);
      expect(module.loadHandler).to.have.been.calledWith(
        testStats,
        'func1',
        true
      );
      expect(module.loadHandler).to.have.been.calledWith(
        testStats,
        'func2',
        true
      );
      expect(module.loadHandler).to.have.been.calledWith(
        testStats,
        'func3',
        false
      );
    });
  });
});
