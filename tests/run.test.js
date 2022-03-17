'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const sinon = require('sinon');
const Serverless = require('serverless');
const baseModule = require('../lib/run');
const webpackMock = require('webpack');

jest.mock('webpack');
jest.mock('../lib/utils', () => {
  return {
    guid: jest.fn().mockReturnValue('testguid'),
    purgeCache: jest.fn()
  };
});

describe('run', () => {
  let sandbox;
  let serverless;
  let module;
  let chdirStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
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

    chdirStub = sandbox.stub(process, 'chdir');
  });

  afterEach(() => {
    // This will reset the mocks too
    sandbox.restore();
  });

  describe('watch', () => {
    let spawnStub;

    beforeEach(() => {
      spawnStub = jest.fn();
      serverless.pluginManager.spawn = spawnStub;
    });

    it('should throw if webpack watch fails', () => {
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch = jest.fn().mockImplementation(() => {
        throw new Error('Failed');
      });

      expect(watch()).rejects.toThrow('Failed');
    });

    it('should not spawn invoke local on first run', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));
      _.set(module, 'options.function', 'myFunction');

      watch('invoke:local');
      expect(spawnStub).toHaveBeenCalledTimes(0);
      expect(module.isWatching).toBe(true);
    });

    it('should not spawn on watch first run', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));
      _.set(module, 'options.function', 'myFunction');

      watch('compile:watch:compile');
      expect(spawnStub).toHaveBeenCalledTimes(0);
      expect(module.isWatching).toBe(true);
    });

    it('should spawn on watch second run', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));
      _.set(module, 'options.function', 'myFunction');

      watch('compile:watch:compile');
      watch('compile:watch:compile');
      expect(spawnStub).toHaveBeenCalledTimes(1);
      expect(module.isWatching).toBe(true);
    });

    it('should spawn invoke local on subsequent runs', () => {
      module.isWatching = true;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));

      watch('invoke:local');
      expect(spawnStub).toHaveBeenCalledTimes(1);
      expect(spawnStub).toHaveBeenCalledWith('invoke:local');
      expect(module.isWatching).toBe(true);
    });

    it('should not call given handler function on first run', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      const watchHandler = jest.fn().mockReturnValue(BbPromise.resolve());
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));

      watch(watchHandler);
      expect(spawnStub).toHaveBeenCalledTimes(0);
      expect(watchHandler).toHaveBeenCalledTimes(0);
      expect(module.isWatching).toBe(true);
    });

    it('should call given handler function on subsequent runs', () => {
      module.isWatching = true;
      const watch = module.watch.bind(module);
      const watchHandler = jest.fn().mockReturnValue(BbPromise.resolve());
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));

      watch(watchHandler);
      expect(spawnStub).toHaveBeenCalledTimes(0);
      expect(watchHandler).toHaveBeenCalledTimes(1);
      expect(module.isWatching).toBe(true);
    });

    it('should reset the service path', () => {
      module.isWatching = true;
      module.originalServicePath = 'originalPath';
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));

      watch();
      expect(serverless.config.servicePath).toEqual('originalPath');
      expect(chdirStub.args).toEqual([['originalPath']]);
    });

    it('should turn on polling and set the default poll interval', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));
      module.options['webpack-use-polling'] = true;

      watch();
      expect(webpackMock.compilerMock.watch).toHaveBeenCalledWith(
        {
          poll: 3000
        },
        expect.any(Function)
      );
    });

    it('should turn on polling and set the specified poll interval', () => {
      module.isWatching = false;
      const watch = module.watch.bind(module);
      webpackMock.compilerMock.watch.mockReset();
      webpackMock.compilerMock.watch.mockImplementation((options, cb) => cb(null, {}));
      const interval = (module.options['webpack-use-polling'] = _.now() % 10000);

      watch();
      expect(webpackMock.compilerMock.watch).toHaveBeenCalledWith(
        {
          poll: interval
        },
        expect.any(Function)
      );
    });
  });
});
