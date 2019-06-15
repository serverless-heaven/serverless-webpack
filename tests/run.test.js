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

describe('run', () => {
  let sandbox;
  let webpackMock;
  let utilsMock;
  let baseModule;
  let serverless;
  let module;
  let chdirStub;

  before(() => {
    sandbox = sinon.createSandbox();
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

    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );

    chdirStub = sandbox.stub(process, 'chdir');
  });

  afterEach(() => {
    // This will reset the mocks too
    sandbox.restore();
  });

  describe('watch', () => {
    let spawnStub;

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
      _.set(module, 'options.function', 'myFunction');

      watch('invoke:local');
      expect(spawnStub).to.not.have.been.called;
      expect(module.isWatching).to.be.true;
    });

    it('should not spawn on watch first run', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});
      _.set(module, 'options.function', 'myFunction');

      watch('compile:watch:compile');
      expect(spawnStub).to.not.have.been.called;
      expect(module.isWatching).to.be.true;
    });

    it('should spawn on watch second run', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});
      _.set(module, 'options.function', 'myFunction');

      watch('compile:watch:compile');
      watch('compile:watch:compile');
      expect(spawnStub).to.have.been.calledOnce;
      expect(module.isWatching).to.be.true;
    });

    it('should spawn invoke local on subsequent runs', () => {
      module.isWatching = true;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});

      watch('invoke:local');
      expect(spawnStub).to.have.been.calledOnce;
      expect(spawnStub).to.have.been.calledWith('invoke:local');
      expect(module.isWatching).to.be.true;
    });

    it('should not call given handler function on first run', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      const watchHandler = sandbox.stub().returns(BbPromise.resolve());
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});

      watch(watchHandler);
      expect(spawnStub).to.not.have.been.called;
      expect(watchHandler).to.not.have.been.called;
      expect(module.isWatching).to.be.true;
    });

    it('should call given handler function on subsequent runs', () => {
      module.isWatching = true;
      const watch = module.watch.bind(module);
      const watchHandler = sandbox.stub().returns(BbPromise.resolve());
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});

      watch(watchHandler);
      expect(spawnStub).to.have.not.been.called;
      expect(watchHandler).to.have.been.calledOnce;
      expect(module.isWatching).to.be.true;
    });

    it('should reset the service path', () => {
      module.isWatching = true;
      module.originalServicePath = 'originalPath';
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});

      watch();
      expect(serverless.config.servicePath).to.equal('originalPath');
      expect(chdirStub).to.have.been.calledOnce;
      expect(chdirStub).to.have.been.calledWithExactly('originalPath');
    });

    it('should turn on polling and set the default poll interval', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});
      module.options['webpack-use-polling'] = true;

      watch();
      expect(webpackMock.compilerMock.watch).to.have.been.calledWith({
        poll: 3000
      });
    });

    it('should turn on polling and set the specified poll interval', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = sandbox.stub().yields(null, {});
      const interval = (module.options['webpack-use-polling'] = _.now() % 10000);

      watch();
      expect(webpackMock.compilerMock.watch).to.have.been.calledWith({
        poll: interval
      });
    });
  });
});
