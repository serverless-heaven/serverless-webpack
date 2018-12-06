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

const FseMock = sandbox => ({
  copy: sandbox.stub(),
  removeSync: sandbox.stub()
});

describe('cleanup', () => {
  let sandbox;
  let fseMock;
  let baseModule;
  let serverless;
  let module;
  let dirExistsSyncStub;

  before(() => {
    sandbox = sinon.sandbox.create();
    sandbox.usingPromise(BbPromise);

    fseMock = FseMock(sandbox);

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('fs-extra', fseMock);

    baseModule = require('../lib/cleanup');
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
    dirExistsSyncStub = sandbox.stub(serverless.utils, 'dirExistsSync');

    module = _.assign({
      serverless,
      options: {},
      webpackOutputPath: 'my/Output/Path'
    }, baseModule);
  });

  afterEach(() => {
    // This will reset the webpackMock too
    sandbox.restore();
  });

  it('should remove output dir if it exists', () => {
    dirExistsSyncStub.returns(true);
    fseMock.removeSync.reset();

    return expect(module.cleanup()).to.be.fulfilled
    .then(() => {
      expect(dirExistsSyncStub).to.have.been.calledOnce;
      expect(dirExistsSyncStub).to.have.been.calledWith('my/Output/Path');
      expect(fseMock.removeSync).to.have.been.calledOnce;
      return null;
    });
  });

  it('should not call removeSync if output dir does not exists', () => {
    dirExistsSyncStub.returns(false);
    fseMock.removeSync.reset();

    return expect(module.cleanup()).to.be.fulfilled
    .then(() => {
      expect(dirExistsSyncStub).to.have.been.calledOnce;
      expect(dirExistsSyncStub).to.have.been.calledWith('my/Output/Path');
      expect(fseMock.removeSync).to.not.have.been.called;
      return null;
    });
  });
});
