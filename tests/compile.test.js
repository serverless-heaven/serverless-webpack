'use strict';

const _ = require('lodash');
const Serverless = require('serverless');
const webpackMock = require('webpack');
const baseModule = require('../lib/compile');

jest.mock('webpack');

describe('compile', () => {
  let serverless;
  let module;

  beforeEach(() => {
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
  });

  it('should expose a `compile` method', () => {
    expect(module.compile).toEqual(expect.any(Function));
  });

  it('should compile with webpack from a context configuration', () => {
    const testWebpackConfig = 'testconfig';
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(webpackMock).toHaveBeenCalledWith(testWebpackConfig);
        expect(webpackMock.compilerMock.run).toHaveBeenCalledTimes(1);
        return null;
      });
  });

  it('should fail if configuration is missing', () => {
    expect.assertions(1);
    delete module.webpackConfig;
    return module.compile().catch(e => {
      expect(e).toEqual('Unable to find Webpack configuration');
    });
  });

  it('should fail if plugin configuration is missing', () => {
    const testWebpackConfig = 'testconfig';
    module.webpackConfig = testWebpackConfig;
    module.configuration = undefined;
    expect.assertions(1);
    return module.compile().catch(e => expect(e.toString()).toEqual('ServerlessError: Missing plugin configuration'));
  });

  it('should fail if there are compilation errors', () => {
    module.webpackConfig = 'testconfig';
    module.configuration = { concurrency: 1 };
    webpackMock.statsMock.compilation.errors = ['error'];
    expect.assertions(1);
    return expect(module.compile()).rejects.toThrow(/compilation error/);
  });

  it('should work with multi compile', () => {
    const testWebpackConfig = 'testconfig';
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'statsMock-outputPath'
            },
            modules: []
          },
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.mockClear();
    webpackMock.compilerMock.run.mockImplementation(cb => cb(null, multiStats));
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(webpackMock).toHaveBeenCalledWith(testWebpackConfig);
        expect(webpackMock.compilerMock.run).toHaveBeenCalledTimes(1);
        return null;
      });
  });

  it('should work with concurrent compile', () => {
    const testWebpackConfig = ['testconfig', 'testconfig2'];
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'statsMock-outputPath'
            },
            modules: []
          },
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 2 };
    webpackMock.compilerMock.run.mockClear();
    webpackMock.compilerMock.run.mockImplementation(cb => cb(null, multiStats));
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(webpackMock).toHaveBeenCalledWith(testWebpackConfig[0]);
        expect(webpackMock).toHaveBeenCalledWith(testWebpackConfig[1]);
        expect(webpackMock.compilerMock.run).toHaveBeenCalledTimes(2);
        return null;
      });
  });

  it('should use correct stats option', () => {
    const testWebpackConfig = {
      stats: 'minimal'
    };
    const mockStats = {
      compilation: {
        errors: [],
        compiler: {
          outputPath: 'statsMock-outputPath'
        },
        modules: []
      },
      toString: jest.fn().mockReturnValue('testStats'),
      hasErrors: _.constant(false)
    };

    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.mockClear();
    webpackMock.compilerMock.run.mockImplementation(cb => cb(null, mockStats));
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(webpackMock).toHaveBeenCalledWith(testWebpackConfig);
        expect(mockStats.toString.mock.calls).toEqual([[testWebpackConfig.stats]]);
        module.webpackConfig = [testWebpackConfig];
        return expect(module.compile()).resolves.toBeUndefined();
      })
      .then(() => {
        expect(webpackMock).toHaveBeenCalledWith(testWebpackConfig);
        expect(mockStats.toString.mock.calls).toEqual([[testWebpackConfig.stats], [testWebpackConfig.stats]]);
        return null;
      });
  });

  it('should set stats outputPath', () => {
    const testWebpackConfig = 'testconfig';
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'compileStats-outputPath'
            },
            modules: []
          },
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.mockClear();
    webpackMock.compilerMock.run.mockImplementation(cb => cb(null, multiStats));
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(module.compileStats.stats[0].outputPath).toEqual('compileStats-outputPath');
        return null;
      });
  });

  it('should set stats externals', () => {
    const testWebpackConfig = 'testconfig';
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'compileStats-outputPath'
            },
            modules: [
              { identifier: _.constant('"crypto"'), usedExports: new Set(['randomBytes']) },
              { identifier: _.constant('"uuid/v4"'), usedExports: true },
              { identifier: _.constant('"mockery"'), usedExports: false },
              { identifier: _.constant('"@scoped/vendor/module1"'), usedExports: true },
              { identifier: _.constant('external "@scoped/vendor/module2"'), usedExports: true },
              { identifier: _.constant('external "uuid/v4"'), usedExports: true },
              { identifier: _.constant('external "localmodule"'), usedExports: true },
              { identifier: _.constant('external "bluebird"'), usedExports: false },
              { identifier: _.constant('external "aws-sdk"'), usedExports: new Set(['method']) },
              { identifier: _.constant('external node-commonjs "lodash"'), usedExports: new Set(['method']) },
              { identifier: _.constant('external commonjs-module "globby"'), usedExports: false },
              { identifier: _.constant('external this "glob"'), usedExports: true },
              { identifier: _.constant('external module "semver"'), usedExports: true },
              { identifier: _.constant('external assign "whatever"'), usedExports: true },
              { identifier: _.constant('external umd2 "hiyou"'), usedExports: true }
            ]
          },
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.mockClear();
    webpackMock.compilerMock.run.mockImplementation(cb => cb(null, multiStats));
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(module.compileStats.stats[0].externalModules).toEqual([
          { external: '@scoped/vendor', origin: undefined },
          { external: 'uuid', origin: undefined },
          { external: 'localmodule', origin: undefined },
          { external: 'aws-sdk', origin: undefined },
          { external: 'lodash', origin: undefined },
          { external: 'glob', origin: undefined },
          { external: 'semver', origin: undefined },
          { external: 'whatever', origin: undefined },
          { external: 'hiyou', origin: undefined }
        ]);
        return null;
      });
  });

  it('should fail to set stats externals', () => {
    const testWebpackConfig = 'testconfig';
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'compileStats-outputPath'
            },
            modules: [{ identifier: _.constant('external node-commonjs "aws-sdk".') }]
          },
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.mockImplementation(cb => cb(null, multiStats));
    return expect(module.compile()).rejects.toThrow(
      'Unable to extract module name from Webpack identifier: external node-commonjs "aws-sdk".'
    );
  });
});
