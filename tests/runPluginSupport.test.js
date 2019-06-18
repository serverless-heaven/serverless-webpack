'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const path = require('path');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('runPluginSupport', () => {
  let sandbox;
  let baseModule;
  let serverless;
  let module;
  let chdirStub;
  let getLocalRootUrlStub;
  let deployFunctionsToLocalEmulatorStub;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise.Promise);

    const pluginRunUtils = path.join('.', 'plugins', 'run', 'utils');

    deployFunctionsToLocalEmulatorStub = sandbox.stub().resolves();
    getLocalRootUrlStub = sandbox.stub();

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock(
      path.join(pluginRunUtils, 'deployFunctionsToLocalEmulator'),
      deployFunctionsToLocalEmulatorStub
    );
    mockery.registerMock(path.join(pluginRunUtils, 'getLocalRootUrl'), getLocalRootUrlStub);
    baseModule = require('../lib/runPluginSupport');
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

    _.set(serverless, 'config.serverlessPath', '.');

    chdirStub = sandbox.stub(process, 'chdir');
  });

  afterEach(() => {
    chdirStub.reset();
    sandbox.restore();
  });

  describe('prepareRun', () => {
    it('should prepare environment and save original values', () => {
      const prepareRun = module.prepareRun.bind(module);
      const servicePath = path.join('my', 'servicePath');
      const webpackOutputPath = path.join('webpack', 'output', 'path');

      _.set(serverless, 'config.servicePath', servicePath);
      _.set(module, 'webpackOutputPath', webpackOutputPath);
      _.unset(module, 'keepOutputDirectory');

      return expect(prepareRun()).to.be.fulfilled.then(() =>
        BbPromise.join(
          expect(module.originalServicePath).to.equal(servicePath),
          expect(module.originalWebpackOutputPath).to.equal(webpackOutputPath),
          expect(module.keepOutputDirectory).to.be.true,
          expect(serverless.config.servicePath).to.equal(path.join(webpackOutputPath, 'service')),
          expect(chdirStub).to.have.been.calledWith(serverless.config.servicePath)
        )
      );
    });
  });

  describe('watchRun', () => {
    beforeEach(() => {
      _.set(module, 'webpackConfig.output.path', 'outputPath');
    });

    it('should invoke hook and deploy functions', () => {
      const watchRun = module.watchRun.bind(module);
      const service = {
        name: 'testService',
        functions: {}
      };
      _.set(module, 'hooks[before:run:run]', sandbox.stub().resolves());
      _.set(serverless, 'service', service);

      return expect(watchRun()).to.be.fulfilled.then(() =>
        BbPromise.join(
          expect(deployFunctionsToLocalEmulatorStub).to.have.been.calledOnce,
          expect(getLocalRootUrlStub).to.have.been.calledOnce,
          expect(deployFunctionsToLocalEmulatorStub).to.have.been.calledWith(service)
        )
      );
    });
  });
});
