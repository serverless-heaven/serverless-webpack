'use strict';

const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const makeWebpackMock = require('./webpack.mock');
const makeUtilsMock = require('./utils.mock');
chai.use(require('sinon-chai'));
const expect = chai.expect;

describe('serve', () => {
  let webpackMock;
  let baseModule;
  let module;
  let serverless;

  before(() => {
    mockery.enable({ warnOnUnregistered: false });
    webpackMock = makeWebpackMock();
    mockery.registerMock('webpack', webpackMock);
    baseModule = require('../lib/serve');
  });

  after(() => {
    mockery.disable();
    mockery.deregisterAll();
  });

  beforeEach(() => {
    serverless = new Serverless();
    serverless.cli = { log: sinon.spy() };
    webpackMock._resetSpies();
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
      const handler = module._handlerBase(testFuncConf);
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
});
