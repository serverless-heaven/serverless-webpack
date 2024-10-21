'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const Serverless = require('serverless');

jest.mock('webpack');
jest.mock('../lib/utils');

describe('wpwatch', () => {
  let serverless;
  let module;
  let spawnStub;
  let webpackMock;
  let baseModule;

  beforeEach(() => {
    jest.resetModules();
    webpackMock = require('webpack');
    baseModule = require('../lib/wpwatch');
    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn(),
      consoleLog: jest.fn()
    };

    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );

    spawnStub = jest.fn();
    serverless.pluginManager.spawn = spawnStub;

    const webpackConfig = {
      stats: 'minimal'
    };
    _.set(module, 'webpackConfig', webpackConfig);
  });

  it('should reject if webpack watch fails', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.mockReset();
    webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(new Error('Failed')));

    return expect(wpwatch()).rejects.toThrow('Failed');
  });

  it('should spawn compile if watch is disabled', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.mockReset();
    webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));
    spawnStub.mockResolvedValue();
    _.set(module.options, 'webpack-no-watch', true);

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() =>
        BbPromise.join(
          expect(spawnStub).toHaveBeenCalledWith('webpack:compile'),
          expect(webpackMock.compilerMock.watch).toHaveBeenCalledTimes(0)
        )
      );
  });

  it('should enter watch mode and return after first compile', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.mockReset();
    webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));
    spawnStub.mockResolvedValue();

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() =>
        BbPromise.join(
          expect(spawnStub).toHaveBeenCalledTimes(0),
          expect(webpackMock.compilerMock.watch).toHaveBeenCalledTimes(1)
        )
      );
  });

  it('should still enter watch mode and return if lastHash is the same as previous', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.mockReset();
    webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, { hash: null }));

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() =>
        BbPromise.join(
          expect(spawnStub).toHaveBeenCalledTimes(0),
          expect(webpackMock.compilerMock.watch).toHaveBeenCalledTimes(1),
          expect(spawnStub).toHaveBeenCalledTimes(0)
        )
      );
  });

  it('should work if no stats are returned', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.mockReset();
    webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb());
    spawnStub.mockResolvedValue();

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() =>
        BbPromise.join(
          expect(spawnStub).toHaveBeenCalledTimes(0),
          expect(webpackMock.compilerMock.watch).toHaveBeenCalledTimes(1)
        )
      );
  });

  it('should enable polling with command line switch', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.mockReset();
    webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb());
    spawnStub.mockResolvedValue();
    _.set(module.options, 'webpack-use-polling', true);

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() =>
        BbPromise.join(
          expect(spawnStub).toHaveBeenCalledTimes(0),
          expect(webpackMock.compilerMock.watch).toHaveBeenCalledTimes(1),
          expect(webpackMock.compilerMock.watch).toHaveBeenCalledWith(
            {
              poll: 3000
            },
            expect.any(Function)
          )
        )
      );
  });

  it('should set specific polling interval if given with switch', () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.watch.mockReset();
    webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb());
    spawnStub.mockResolvedValue();
    _.set(module.options, 'webpack-use-polling', 5000);

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() =>
        BbPromise.join(
          expect(spawnStub).toHaveBeenCalledTimes(0),
          expect(webpackMock.compilerMock.watch).toHaveBeenCalledTimes(1),
          expect(webpackMock.compilerMock.watch).toHaveBeenCalledWith(
            {
              poll: 5000
            },
            expect.any(Function)
          )
        )
      );
  });

  it('should spawn webpack:compile:watch on subsequent runs', () => {
    const wpwatch = module.wpwatch.bind(module);
    let watchCallbackCount = 0;
    let beforeCompileCallback;

    spawnStub.mockResolvedValue();

    webpackMock.compilerMock.hooks.beforeCompile.tapPromise.mockImplementation((options, cb) => {
      beforeCompileCallback = cb;
    });

    webpackMock.compilerMock.watch.mockImplementationOnce((options, cb) => {
      cb(null, { call: 1, hash: '1' });
      watchCallbackCount++;
      cb(null, { call: 2, hash: '2' });
      watchCallbackCount++;

      // We only call this once, to simulate that promises that might take longer to resolve
      // don't cause a re-emit to avoid race-conditions.
      beforeCompileCallback();
      cb(null, { call: 3, hash: '3' });
      watchCallbackCount++;
      cb(null, { call: 3, hash: '4' });
      watchCallbackCount++;
    });

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() =>
        BbPromise.join(
          expect(watchCallbackCount).toBe(4),
          expect(spawnStub).toHaveBeenCalledTimes(1),
          expect(spawnStub).toHaveBeenCalledWith('webpack:compile:watch')
        )
      );
  });

  it('should spawn more webpack:compile:watch when previous is resolved', () => {
    const wpwatch = module.wpwatch.bind(module);
    let watchCallbackCount = 0;
    let beforeCompileCallback;
    let beforeCompileCallbackPromise;

    spawnStub.mockResolvedValue();

    webpackMock.compilerMock.hooks.beforeCompile.tapPromise.mockImplementation((options, cb) => {
      beforeCompileCallback = cb;
    });

    webpackMock.compilerMock.watch.mockImplementationOnce((options, cb) => {
      cb(null, { call: 1, hash: '1' });
      watchCallbackCount++;
      cb(null, { call: 2, hash: '2' });
      watchCallbackCount++;

      // eslint-disable-next-line promise/always-return
      beforeCompileCallbackPromise = beforeCompileCallback().then(() => {
        // eslint-disable-next-line promise/no-callback-in-promise
        cb(null, { call: 3, hash: '3' });
        watchCallbackCount++;
      });
    });

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() => beforeCompileCallbackPromise)
      .then(() =>
        BbPromise.join(
          expect(watchCallbackCount).toBe(3),
          expect(spawnStub).toHaveBeenCalledTimes(2),
          expect(spawnStub).toHaveBeenCalledWith('webpack:compile:watch')
        )
      );
  });

  it("should use plugins for webpack:compile:watch if hooks doesn't exist", () => {
    const wpwatch = module.wpwatch.bind(module);
    webpackMock.compilerMock.hooks = false;

    webpackMock.compilerMock.plugin.mockImplementation((name, cb) => cb(null, _.noop));
    webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() => expect(webpackMock.compilerMock.plugin).toHaveBeenCalledTimes(1));
  });

  it('should not resolve before compile if it has an error', () => {
    const wpwatch = module.wpwatch.bind(module);
    spawnStub.mockReturnValue(BbPromise.reject(new Error('actual error')));

    let beforeCompileCallback;
    webpackMock.compilerMock.hooks.beforeCompile.tapPromise.mockImplementation((options, cb) => {
      beforeCompileCallback = cb;
    });

    let doesResolve = false;
    webpackMock.compilerMock.watch.mockImplementationOnce((options, cb) => {
      cb(null, { call: 1, hash: '1' });
      cb(null, { call: 2, hash: '2' });

      // eslint-disable-next-line promise/catch-or-return,promise/always-return
      beforeCompileCallback().then(() => {
        // We don't expect this to be set to true
        doesResolve = true;
      });
    });

    return expect(wpwatch())
      .resolves.toBeUndefined()
      .then(() => expect(doesResolve).toBe(false));
  });

  it('should throw if compile fails on subsequent runs', () => {
    const wpwatch = module.wpwatch.bind(module);
    spawnStub.mockResolvedValue();

    webpackMock.compilerMock.watch.mockImplementation((options, cb) => {
      cb(null, { call: 3, hash: '3' });
      cb(new Error('Compile failed'));
    });

    return expect(wpwatch()).resolves.toBeUndefined();
  });
});
