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

    module = Object.assign({
      serverless,
      options: {},
      webpackOutputPath: 'my/Output/Path'
    }, baseModule);
  });

  afterEach(() => {
    // This will reset the webpackMock too
    sandbox.restore();
  });

  it('should do nothing if no original service path is set', () => {
    _.unset(module.originalServicePath);
    return expect(module.cleanup()).to.be.fulfilled
    .then(() => {
      expect(fseMock.copy).to.have.not.been.called;
      expect(fseMock.removeSync).to.not.have.been.called;
    })
  });

  it('should remove output dir if it exists', () => {
    dirExistsSyncStub.returns(true);
    _.unset(module.originalServicePath);
    fseMock.removeSync.reset();

    return expect(module.cleanup()).to.be.fulfilled
    .then(() => {
      expect(dirExistsSyncStub).to.have.been.calledOnce;
      expect(dirExistsSyncStub).to.have.been.calledWith('my/Output/Path');
      expect(fseMock.removeSync).to.have.been.calledOnce;
    });
  });

  it('should not call removeSync if output dir does not exists', () => {
    dirExistsSyncStub.returns(false);
    _.unset(module.originalServicePath);
    fseMock.removeSync.reset();

    return expect(module.cleanup()).to.be.fulfilled
    .then(() => {
      expect(dirExistsSyncStub).to.have.been.calledOnce;
      expect(dirExistsSyncStub).to.have.been.calledWith('my/Output/Path');
      expect(fseMock.removeSync).to.not.have.been.called;
    });
  });

  it('should call copy with the right parameters with a service artifact', () => {
    dirExistsSyncStub.returns(true);
    module.originalServicePath = 'my/Original/Service/Path';
    fseMock.copy.reset();
    fseMock.copy.yields(null, {});
    serverless.service.package.artifact = 'artifact.zip';

    return expect(module.cleanup()).to.be.fulfilled
    .then(() => {
      expect(serverless.config.servicePath).to.equal('my/Original/Service/Path');
      expect(fseMock.copy).to.have.been.calledOnce;
      expect(fseMock.copy).to.have.been
        .calledWith('my/Output/Path/.serverless', 'my/Original/Service/Path/.serverless');
      expect(serverless.service.package.artifact)
        .to.equal('my/Original/Service/Path/.serverless/artifact.zip');
    });
  });

  it('should call copy with the right parameters with individual packaging', () => {
    dirExistsSyncStub.returns(true);
    module.originalServicePath = 'my/Original/Service/Path';
    fseMock.copy.reset();
    fseMock.copy.yields(null, {});
    serverless.service.package.individually = true;

    const testFunctionsConfig = {
      func1: {
        handler: 'module1.func1handler',
        package: {
          artifact: 'artifact-func1.zip',
        },
        events: [{
          http: {
            method: 'get',
            path: 'func1path',
          },
        }],
      },
      func2: {
        handler: 'module2.func2handler',
        package: {
          artifact: 'artifact-func2.zip',
        },
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
        package: {
          artifact: 'artifact-func3.zip',
        },
        events: [{
          nonhttp: 'non-http',
        }],
      },
    };
    serverless.service.functions = testFunctionsConfig;

    return expect(module.cleanup()).to.be.fulfilled
    .then(() => {
      expect(serverless.config.servicePath).to.equal('my/Original/Service/Path');
      expect(fseMock.copy).to.have.been.calledOnce;
      expect(fseMock.copy).to.have.been
        .calledWith('my/Output/Path/.serverless', 'my/Original/Service/Path/.serverless');
      _.forEach(['func1', 'func2', 'func3'], funcName => {
        expect(serverless.service.functions[funcName].package).to.have.a.property('artifact')
          .that.equals(`my/Original/Service/Path/.serverless/artifact-${funcName}.zip`);
      });
    });
  });

  it('should reject if the copy fails', () => {
    dirExistsSyncStub.returns(true);
    module.originalServicePath = 'my/Original/Service/Path';
    fseMock.copy.yields(new Error('Failed'));
    serverless.service.package.artifact = 'artifact.zip';

    return expect(module.cleanup()).to.be.rejectedWith('Failed');
  });

});
