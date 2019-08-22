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

    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );

    spawnStub = sandbox.stub(serverless.pluginManager, 'spawn');

    const webpackConfig = {
      stats: 'minimal'
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

    return expect(wpwatch()).to.be.fulfilled.then(() =>
      BbPromise.join(
        expect(spawnStub).to.have.been.calledWith('webpack:compile'),
        expect(webpackMock.compilerMock.watch).to.not.have.been.called
      )
    );
  });

  it('should enter watch mode and return after first compile', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields(null, {});
    spawnStub.resolves();

    return expect(wpwatch()).to.be.fulfilled.then(() =>
      BbPromise.join(
        expect(spawnStub).to.not.have.been.called,
        expect(webpackMock.compilerMock.watch).to.have.been.calledOnce
      )
    );
  });

  it('should still enter watch mode and return if lastHash is the same as previous', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields(null, { hash: null });

    return expect(wpwatch()).to.be.fulfilled.then(() =>
      BbPromise.join(
        expect(spawnStub).to.not.have.been.called,
        expect(webpackMock.compilerMock.watch).to.have.been.calledOnce,
        expect(spawnStub).to.not.have.been.called
      )
    );
  });

  it('should work if no stats are returned', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields();
    spawnStub.resolves();

    return expect(wpwatch()).to.be.fulfilled.then(() =>
      BbPromise.join(
        expect(spawnStub).to.not.have.been.called,
        expect(webpackMock.compilerMock.watch).to.have.been.calledOnce
      )
    );
  });

  it('should enable polling with command line switch', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields();
    spawnStub.resolves();
    _.set(module.options, 'webpack-use-polling', true);

    return expect(wpwatch()).to.be.fulfilled.then(() =>
      BbPromise.join(
        expect(spawnStub).to.not.have.been.called,
        expect(webpackMock.compilerMock.watch).to.have.been.calledOnce,
        expect(webpackMock.compilerMock.watch).to.have.been.calledWith({
          poll: 3000
        })
      )
    );
  });

  it('should set specific polling interval if given with switch', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.yields();
    spawnStub.resolves();
    _.set(module.options, 'webpack-use-polling', 5000);

    return expect(wpwatch()).to.be.fulfilled.then(() =>
      BbPromise.join(
        expect(spawnStub).to.not.have.been.called,
        expect(webpackMock.compilerMock.watch).to.have.been.calledOnce,
        expect(webpackMock.compilerMock.watch).to.have.been.calledWith({
          poll: 5000
        })
      )
    );
  });

  it('should spawn webpack:compile:watch on subsequent runs', () => {
    const wpwatch = module.wpwatch.bind(module);
    let watchCallbackSpy;
    let beforeCompileCallbackSpy;

    spawnStub.resolves();

    webpackMock.compilerMock.hooks.beforeCompile.tapPromise.callsFake((options, cb) => {
      beforeCompileCallbackSpy = sandbox.spy(cb);
    });

    webpackMock.compilerMock.watch.onFirstCall().callsFake((options, cb) => {
      watchCallbackSpy = sandbox.spy(cb);
      watchCallbackSpy(null, { call: 1, hash: '1' });
      watchCallbackSpy(null, { call: 2, hash: '2' });

      // We only call this once, to simulate that promises that might take longer to resolve
      // don't cause a re-emit to avoid race-conditions.
      beforeCompileCallbackSpy();
      watchCallbackSpy(null, { call: 3, hash: '3' });
      watchCallbackSpy(null, { call: 3, hash: '4' });
    });

    return expect(wpwatch()).to.be.fulfilled.then(() =>
      BbPromise.join(
        expect(watchCallbackSpy).to.have.been.callCount(4),
        expect(spawnStub).to.have.been.calledOnce,
        expect(spawnStub).to.have.been.calledWithExactly('webpack:compile:watch')
      )
    );
  });

  it('should spawn more webpack:compile:watch when previous is resolved', () => {
    const wpwatch = module.wpwatch.bind(module);
    let watchCallbackSpy;
    let beforeCompileCallbackSpy;
    let beforeCompileCallbackSpyPromise;

    spawnStub.resolves();

    webpackMock.compilerMock.hooks.beforeCompile.tapPromise.callsFake((options, cb) => {
      beforeCompileCallbackSpy = sandbox.spy(cb);
    });

    webpackMock.compilerMock.watch.onFirstCall().callsFake((options, cb) => {
      watchCallbackSpy = sandbox.spy(cb);

      watchCallbackSpy(null, { call: 1, hash: '1' });
      watchCallbackSpy(null, { call: 2, hash: '2' });

      // eslint-disable-next-line promise/always-return,promise/catch-or-return
      beforeCompileCallbackSpyPromise = beforeCompileCallbackSpy().then(() => {
        watchCallbackSpy(null, { call: 3, hash: '3' });
      });
    });

    return expect(wpwatch())
      .to.be.fulfilled.then(() => beforeCompileCallbackSpyPromise)
      .then(() =>
        BbPromise.join(
          expect(watchCallbackSpy).to.have.been.calledThrice,
          expect(spawnStub).to.have.been.calledTwice,
          expect(spawnStub).to.have.been.calledWithExactly('webpack:compile:watch')
        )
      );
  });

  it("should use plugins for webpack:compile:watch if hooks doesn't exist", () => {
    const wpwatch = module.wpwatch.bind(module);
    sandbox.stub(webpackMock.compilerMock, 'hooks').value(false);

    webpackMock.compilerMock.plugin = sandbox.stub().yields(null, _.noop);
    webpackMock.compilerMock.watch.yields(null, {});

    return expect(wpwatch()).to.be.fulfilled.then(
      () => expect(webpackMock.compilerMock.plugin).to.have.been.calledOnce
    );
  });

  it('should not resolve before compile if it has an error', () => {
    const wpwatch = module.wpwatch.bind(module);
    spawnStub.returns(BbPromise.reject(new Error('actual error')));

    let beforeCompileCallbackSpy;
    webpackMock.compilerMock.hooks.beforeCompile.tapPromise.callsFake((options, cb) => {
      beforeCompileCallbackSpy = sandbox.spy(cb);
    });

    let doesResolve = false;
    webpackMock.compilerMock.watch.onFirstCall().callsFake((options, cb) => {
      cb(null, { call: 1, hash: '1' });
      cb(null, { call: 2, hash: '2' });

      // eslint-disable-next-line promise/catch-or-return,promise/always-return
      beforeCompileCallbackSpy().then(() => {
        // We don't expect this to be set to true
        doesResolve = true;
      });
    });

    return expect(wpwatch()).to.be.fulfilled.then(() => expect(doesResolve).to.be.false);
  });

  it('should throw if compile fails on subsequent runs', () => {
    const wpwatch = module.wpwatch.bind(module);
    let watchCallbackSpy;

    spawnStub.resolves();

    webpackMock.compilerMock.watch.callsFake((options, cb) => {
      // We'll spy the callback registered for watch
      watchCallbackSpy = sandbox.spy(cb);

      watchCallbackSpy(null, { call: 3, hash: '3' });
      watchCallbackSpy(new Error('Compile failed'));
    });

    return expect(wpwatch()).to.be.fulfilled.then(() =>
      BbPromise.join(
        expect(watchCallbackSpy).to.have.been.calledTwice,
        expect(watchCallbackSpy.secondCall.threw()).to.be.true
      )
    );
  });
});
