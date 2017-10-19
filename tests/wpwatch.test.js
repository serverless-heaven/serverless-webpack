'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const makeWebpackMock = require('./webpack.mock');
const makeUtilsMock = require('./utils.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('wpwatch', function() {
  let sandbox;
  let webpackMock;
  let utilsMock;
  let baseModule;
  let serverless;
  let module;
  let spawnStub;

  this.timeout(7000);

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise.Promise);

    webpackMock = makeWebpackMock(sandbox);
    utilsMock = makeUtilsMock();

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('webpack', webpackMock);
    mockery.registerMock('./utils', utilsMock);
    baseModule = require('../lib/wpwatch');
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

    module = _.assign({
      serverless,
      options: {},
    }, baseModule);

    spawnStub = sandbox.stub(serverless.pluginManager, 'spawn');

    const webpackConfig = {
      stats: 'minimal',
      entry: { not: 'empty' }
    };
    _.set(module, 'webpackConfig', webpackConfig);
  });

  afterEach(() => {
    // This will reset the mocks too
    webpackMock.compilerMock.watch.reset();
    sandbox.restore();
  });

  it('should reject if webpack watch fails', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields(new Error('Failed'));

    return expect(wpwatch()).to.be.rejectedWith('Failed');
  });

  it('should spawn compile if watch is disabled', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields(null, {});
    spawnStub.resolves();
    _.set(module.options, 'webpack-no-watch', true);

    return expect(wpwatch()).to.be.fulfilled
    .then(() => BbPromise.join(
      expect(spawnStub).to.have.been.calledWith('webpack:compile'),
      expect(webpackMock.compilerMock.watch).to.not.have.been.called
    ));
  });

  it('should enter watch mode and return after first compile', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields(null, {});
    spawnStub.resolves();

    return expect(wpwatch()).to.be.fulfilled
    .then(() => BbPromise.join(
      expect(spawnStub).to.not.have.been.called,
      expect(webpackMock.compilerMock.watch).to.have.been.calledOnce
    ));
  });

  it('should work if no stats are returned', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields();
    spawnStub.resolves();

    return expect(wpwatch()).to.be.fulfilled
    .then(() => BbPromise.join(
      expect(spawnStub).to.not.have.been.called,
      expect(webpackMock.compilerMock.watch).to.have.been.calledOnce
    ));
  });

  it('should enable polling with command line switch', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields();
    spawnStub.resolves();
    _.set(module.options, 'webpack-use-polling', true);

    return expect(wpwatch()).to.be.fulfilled
    .then(() => BbPromise.join(
      expect(spawnStub).to.not.have.been.called,
      expect(webpackMock.compilerMock.watch).to.have.been.calledOnce,
      expect(webpackMock.compilerMock.watch).to.have.been.calledWith({ poll: 3000 })
    ));
  });

  it('should set specific polling interval if given with switch', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields();
    spawnStub.resolves();
    _.set(module.options, 'webpack-use-polling', 5000);

    return expect(wpwatch()).to.be.fulfilled
    .then(() => BbPromise.join(
      expect(spawnStub).to.not.have.been.called,
      expect(webpackMock.compilerMock.watch).to.have.been.calledOnce,
      expect(webpackMock.compilerMock.watch).to.have.been.calledWith({ poll: 5000 })
    ));
  });

  it('should call callback on subsequent runs', () => {
    const wpwatch = module.wpwatch.bind(module);
    let watchCallbackSpy;
    webpackMock.compilerMock.watch.callsFake((options, cb) => {
      // We'll spy the callback registered for watch
      watchCallbackSpy = sandbox.spy(cb);

      // Schedule second call after 2 seconds
      setTimeout(() => {
        watchCallbackSpy(null, { call: 2 });
      }, 2000);
      process.nextTick(() => watchCallbackSpy(null, { call: 1 }));
    });
    spawnStub.resolves();

    return expect(wpwatch()).to.be.fulfilled
    .then(() => BbPromise.delay(3000))
    .then(() => BbPromise.join(
      expect(spawnStub).to.not.have.been.called,
      expect(webpackMock.compilerMock.watch).to.have.been.calledOnce,
      expect(watchCallbackSpy).to.have.been.calledTwice
    ));
  });

  it('should throw if compile fails on subsequent runs', () => {
    const wpwatch = module.wpwatch.bind(module);
    let watchCallbackSpy;
    webpackMock.compilerMock.watch.callsFake((options, cb) => {
      // We'll spy the callback registered for watch
      watchCallbackSpy = sandbox.spy(cb);

      // Schedule second call after 2 seconds
      setTimeout(() => {
        try {
          watchCallbackSpy(new Error('Compile failed'));
        } catch (e) {
          // Ignore the exception. The spy will record it.
        }
      }, 2000);
      process.nextTick(() => watchCallbackSpy(null, { call: 1 }));
    });
    spawnStub.resolves();

    return expect(wpwatch()).to.be.fulfilled
    .then(() => BbPromise.delay(3000))
    .then(() => BbPromise.join(
      expect(watchCallbackSpy).to.have.been.calledTwice,
      expect(watchCallbackSpy.secondCall.threw()).to.be.true
    ));
  });
});
