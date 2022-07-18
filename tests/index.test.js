'use strict';
/**
 * Unit tests for index.
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const Serverless = require('serverless');
const ServerlessWebpack = require('../index');

jest.mock('webpack');
// jest.mock('ts-node/register');

describe('ServerlessWebpack', () => {
  let serverless;

  beforeEach(() => {
    jest.resetModules();
    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn(),
      consoleLog: jest.fn()
    };
    serverless.pluginManager.spawn = jest.fn().mockReturnValue(BbPromise.resolve());
    serverless.service.getFunction = jest.fn().mockReturnValue({ runtime: 'nodejs12.x' });
  });

  it('should expose a lib object', () => {
    const lib = ServerlessWebpack.lib;
    expect(lib).toEqual({ entries: {}, webpack: { isLocal: false } });
  });

  describe('with a TS webpack configuration', () => {
    it('should support old config and register ts-node', () => {
      jest.setMock('ts-node/register', null, { virtual: true });
      _.set(serverless, 'service.custom.webpack', 'webpack.config.ts');
      new ServerlessWebpack(serverless, {});
    });

    it('should support new config and register ts-node', () => {
      jest.setMock('ts-node/register');
      _.set(serverless, 'service.custom.webpack.webpackConfig', 'webpack.config.ts');
      new ServerlessWebpack(serverless, {});
    });

    it('should not register ts-node if it has already been registered', () => {
      _.set(serverless, 'service.custom.webpack.webpackConfig', 'webpack.config.ts');
      process[Symbol.for('ts-node.register.instance')] = 'foo';
      new ServerlessWebpack(serverless, {});
      delete process[Symbol.for('ts-node.register.instance')];
    });

    it('should throw an error if config use TS but ts-node was not added as dependency', () => {
      _.set(serverless, 'service.custom.webpack.webpackConfig', 'webpack.config.ts');
      jest.mock('ts-node/register', () => {
        throw new Error('ts-node not found');
      });

      const badDeps = function () {
        new ServerlessWebpack(serverless, {});
      };

      expect(badDeps).toThrow(
        'If you want to use TypeScript with serverless-webpack, please add "ts-node" as dependency.'
      );
    });
  });

  describe('with a JS webpack configuration', () => {
    it('should not load ts-node', () => {
      _.set(serverless, 'service.custom.webpack', 'webpack.config.js');
      new ServerlessWebpack(serverless, {});
    });
  });

  _.forEach(
    [
      'commands.webpack',
      'commands.webpack.commands.validate',
      'commands.webpack.commands.compile',
      'commands.webpack.commands.compile.commands.watch',
      'commands.webpack.commands.package'
    ],
    command => {
      it(`should expose command/entrypoint ${_.last(_.split(command, '.'))}`, () => {
        const slsw = new ServerlessWebpack(serverless, {});
        expect(slsw).toHaveProperty(command);
      });
    }
  );

  describe('hooks', () => {
    const functionName = 'myFunction';
    const rawOptions = {
      f: functionName
    };
    const processedOptions = {
      function: functionName
    };
    let slsw;

    beforeAll(() => {
      slsw = new ServerlessWebpack(serverless, rawOptions);
      if (serverless.processedInput) {
        // serverless.processedInput does not exist in serverless@<2.0.0
        serverless.processedInput.options = processedOptions;
      }
      slsw.cleanup = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.watch = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.wpwatch = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.packExternalModules = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.copyExistingArtifacts = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.prepareRun = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.watchRun = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.validate = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.compile = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.packageModules = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.prepareLocalInvoke = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.prepareOfflineInvoke = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.prepareStepOfflineInvoke = jest.fn().mockReturnValue(BbPromise.resolve());
    });

    beforeEach(() => {
      ServerlessWebpack.lib.webpack.isLocal = false;
      slsw.skipCompile = false;
    });

    _.forEach(
      [
        {
          name: 'before:package:createDeploymentArtifacts',
          test: () => {
            it('should spawn validate, compile and package', () => {
              return expect(slsw.hooks['before:package:createDeploymentArtifacts']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledTimes(3);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(1, 'webpack:validate');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(2, 'webpack:compile');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(3, 'webpack:package');
                  return null;
                });
            });

            it('should skip compile if requested', () => {
              slsw.skipCompile = true;
              return expect(slsw.hooks['before:package:createDeploymentArtifacts']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledTimes(2);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(1, 'webpack:validate');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(2, 'webpack:package');
                  return null;
                });
            });
          }
        },
        {
          name: 'after:package:createDeploymentArtifacts',
          test: () => {
            it('should call cleanup', () => {
              return expect(slsw.hooks['after:package:createDeploymentArtifacts']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.cleanup).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'before:deploy:function:packageFunction',
          test: () => {
            it('should spawn validate, compile and package', () => {
              slsw.options.function = functionName;

              return expect(slsw.hooks['before:deploy:function:packageFunction']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledTimes(3);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(1, 'webpack:validate');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(2, 'webpack:compile');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(3, 'webpack:package');
                  return null;
                });
            });
          }
        },
        {
          name: 'webpack:webpack',
          test: () => {
            it('should spawn validate, compile and package', () => {
              return expect(slsw.hooks['webpack:webpack']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledTimes(3);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(1, 'webpack:validate');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(2, 'webpack:compile');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(3, 'webpack:package');
                  return null;
                });
            });
          }
        },
        {
          name: 'before:invoke:local:invoke',
          test: () => {
            it('should prepare for local invoke', () => {
              return expect(slsw.hooks['before:invoke:local:invoke']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessWebpack.lib.webpack.isLocal).toBe(true);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledTimes(2);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(1, 'webpack:validate');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(2, 'webpack:compile');
                  expect(slsw.prepareLocalInvoke).toHaveBeenCalledTimes(1);
                  return null;
                });
            });

            it('should skip compile if requested', () => {
              slsw.options['skip-build'] = false;
              slsw.skipCompile = true;
              return expect(slsw.hooks['before:invoke:local:invoke']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledTimes(1);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledWith('webpack:validate');
                  expect(slsw.prepareLocalInvoke).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'after:invoke:local:invoke',
          test: () => {
            it('should return if watch is disabled', () => {
              slsw.options.watch = false;
              return expect(slsw.hooks['after:invoke:local:invoke']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.watch).toHaveBeenCalledTimes(0);
                  return null;
                });
            });

            it('should watch if enabled', () => {
              slsw.options.watch = true;
              return expect(slsw.hooks['after:invoke:local:invoke']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.watch).toHaveBeenCalledTimes(1);
                  expect(slsw.watch).toHaveBeenCalledWith('invoke:local');
                  return null;
                });
            });
          }
        },
        {
          name: 'before:run:run',
          test: () => {
            it('should prepare for run', () => {
              return expect(slsw.hooks['before:run:run']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.serverless.service.package.individually).toBe(false);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledTimes(2);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(1, 'webpack:validate');
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenNthCalledWith(2, 'webpack:compile');
                  expect(slsw.packExternalModules).toHaveBeenCalledTimes(1);
                  expect(slsw.prepareRun).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'after:run:run',
          test: () => {
            it('should return if watch is disabled', () => {
              slsw.options.watch = false;
              return expect(slsw.hooks['after:run:run']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.watch).toHaveBeenCalledTimes(0);
                  return null;
                });
            });

            it('should watch if enabled', () => {
              slsw.options.watch = true;
              return expect(slsw.hooks['after:run:run']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.watch).toHaveBeenCalledTimes(1);
                  expect(slsw.watch).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'webpack:validate:validate',
          test: () => {
            it('should call validate', () => {
              return expect(slsw.hooks['webpack:validate:validate']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.validate).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'webpack:compile:compile',
          test: () => {
            it('should call compile', () => {
              return expect(slsw.hooks['webpack:compile:compile']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.compile).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'webpack:compile:watch:compile',
          test: () => {
            it('should resolve', () => {
              return expect(slsw.hooks['webpack:compile:watch:compile']()).resolves.toBeUndefined();
            });
          }
        },
        {
          name: 'webpack:package:packExternalModules',
          test: () => {
            it('should call packExternalModules', () => {
              return expect(slsw.hooks['webpack:package:packExternalModules']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.packExternalModules).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'webpack:package:packageModules',
          test: () => {
            it('should call packageModules', () => {
              return expect(slsw.hooks['webpack:package:packageModules']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.packageModules).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'webpack:package:copyExistingArtifacts',
          test: () => {
            it('should call copyExistingArtifacts', () => {
              return expect(slsw.hooks['webpack:package:copyExistingArtifacts']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.copyExistingArtifacts).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          }
        },
        {
          name: 'before:offline:start',
          test: () => {
            it('should prepare offline', () => {
              slsw.options['skip-build'] = true;
              return expect(slsw.hooks['before:offline:start']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessWebpack.lib.webpack.isLocal).toBe(true);
                  expect(slsw.prepareOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.wpwatch).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
            it('should skip compiling when requested', () => {
              slsw.options['skip-build'] = false;
              return expect(slsw.hooks['before:offline:start']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessWebpack.lib.webpack.isLocal).toBe(true);
                  expect(slsw.prepareOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.wpwatch).toHaveBeenCalledTimes(0);
                  return null;
                });
            });
          }
        },
        {
          name: 'before:offline:start:init',
          test: () => {
            it('should prepare offline', () => {
              slsw.options['skip-build'] = true;
              return expect(slsw.hooks['before:offline:start:init']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessWebpack.lib.webpack.isLocal).toBe(true);
                  expect(slsw.prepareOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.wpwatch).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
            it('should skip compiling when requested', () => {
              slsw.options['skip-build'] = false;
              return expect(slsw.hooks['before:offline:start:init']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessWebpack.lib.webpack.isLocal).toBe(true);
                  expect(slsw.prepareOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.wpwatch).toHaveBeenCalledTimes(0);
                  return null;
                });
            });
          }
        },
        {
          name: 'before:step-functions-offline:start',
          test: () => {
            it('should prepare offline', () => {
              return expect(slsw.hooks['before:step-functions-offline:start']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessWebpack.lib.webpack.isLocal).toBe(true);
                  expect(slsw.prepareStepOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledTimes(1);
                  expect(slsw.serverless.pluginManager.spawn).toHaveBeenCalledWith('webpack:compile');
                  return null;
                });
            });
          }
        },
        {
          name: 'initialize',
          test: () => {
            it('should override the raw options with the processed ones', () => {
              slsw.hooks.initialize();
              if (serverless.processedInput) {
                expect(slsw.options).toEqual(processedOptions);
              } else {
                // serverless.processedInput does not exist in serverless@<2.0.0
                // The options should not be changed
                expect(slsw.options).toEqual(rawOptions);
              }
            });
          }
        }
      ],
      hook => {
        it(`should expose hook ${hook.name}`, () => {
          expect(slsw).toHaveProperty(`hooks.${hook.name}`);
        });

        describe(hook.name, () => {
          hook.test();
        });
      }
    );
  });
});
