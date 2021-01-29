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
  remove: sandbox.stub()
});

describe('cleanup', () => {
  let sandbox;
  let fseMock;
  let baseModule;
  let serverless;
  let module;
  let dirExistsSyncStub;

  before(() => {
    sandbox = sinon.createSandbox();
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
      error: sandbox.stub(),
      consoleLog: sandbox.stub()
    };
    dirExistsSyncStub = sandbox.stub(serverless.utils, 'dirExistsSync');

    module = _.assign(
      {
        serverless,
        options: {
          verbose: true
        },
        webpackOutputPath: 'my/Output/Path'
      },
      baseModule
    );
  });

  afterEach(() => {
    // This will reset the webpackMock too
    sandbox.restore();
    fseMock.remove.reset();
    serverless.cli.log.reset();
  });

  it('should remove output dir if it exists', () => {
    dirExistsSyncStub.returns(true);
    fseMock.remove.resolves(true);

    return expect(module.cleanup()).to.be.fulfilled.then(() => {
      expect(dirExistsSyncStub).to.have.been.calledOnce;
      expect(dirExistsSyncStub).to.have.been.calledWith('my/Output/Path');
      expect(fseMock.remove).to.have.been.calledOnce;
      expect(serverless.cli.log).to.have.been.calledWith('Removing my/Output/Path done');
      return null;
    });
  });

  it('should log nothing is verbose is false', () => {
    dirExistsSyncStub.returns(true);
    fseMock.remove.resolves(true);

    module = _.assign(
      {
        serverless,
        options: {
          verbose: false
        },
        webpackOutputPath: 'my/Output/Path'
      },
      baseModule
    );

    return expect(module.cleanup()).to.be.fulfilled.then(() => {
      expect(dirExistsSyncStub).to.have.been.calledOnce;
      expect(dirExistsSyncStub).to.have.been.calledWith('my/Output/Path');
      expect(fseMock.remove).to.have.been.calledOnce;
      expect(serverless.cli.log).not.to.have.been.called;
      return null;
    });
  });

  it('should log an error if it occurs', () => {
    dirExistsSyncStub.returns(true);
    fseMock.remove.rejects('remove error');

    return expect(module.cleanup()).to.be.fulfilled.then(() => {
      expect(serverless.cli.log).to.have.been.calledWith('Error occurred while removing my/Output/Path: remove error');

      return null;
    });
  });

  it('should not call remove if output dir does not exists', () => {
    dirExistsSyncStub.returns(false);

    return expect(module.cleanup()).to.be.fulfilled.then(() => {
      expect(dirExistsSyncStub).to.have.been.calledOnce;
      expect(dirExistsSyncStub).to.have.been.calledWith('my/Output/Path');
      expect(fseMock.remove).to.not.have.been.called;
      return null;
    });
  });

  it('should keep output dir if keepOutputDir = true', () => {
    dirExistsSyncStub.returns(true);

    const configuredModule = _.assign({}, module, {
      keepOutputDirectory: true
    });
    return expect(configuredModule.cleanup()).to.be.fulfilled.then(() => {
      expect(dirExistsSyncStub).to.not.have.been.calledOnce;
      expect(fseMock.remove).to.not.have.been.called;
      return null;
    });
  });
});
