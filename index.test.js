'use strict';
/**
 * Unit tests for index.
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const Module = require('module');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('ServerlessWebpack', () => {
  let sandbox;
  let serverless;
  let ServerlessWebpack;
  let moduleStub;

  before(function () {
    // Mockery might take some time to clear the cache. So add 3 seconds to the default timeout.
    this.timeout(5000);

    sandbox = sinon.createSandbox();

    mockery.enable({ useCleanCache: true, warnOnUnregistered: false });
    mockery.registerMock('ts-node/register', {});
    mockery.registerMock('webpack', {});

    ServerlessWebpack = require('./index');
    moduleStub = sandbox.stub(Module, '_load');
  });

  beforeEach(() => {
    serverless = new Serverless();
    serverless.cli = {
      log: sandbox.stub(),
      consoleLog: sandbox.stub()
    };

    sandbox.stub(serverless.pluginManager, 'spawn').returns(BbPromise.resolve());
    sandbox.stub(serverless.service, 'getFunction').returns({ runtime: 'nodejs12.x' });
  });

  afterEach(() => {
    sandbox.resetHistory();
  });

  after(() => {
    sandbox.restore();
    mockery.disable();
    mockery.deregisterAll();
  });

  it('should expose a lib object', () => {
    const lib = ServerlessWebpack.lib;
    expect(lib).to.be.an('object');
    expect(lib).to.have.a.property('entries').that.is.an('object').that.is.empty;
    expect(lib).to.have.a.property('webpack').that.is.an('object').that.deep.equals({
      isLocal: false
    });
  });

  describe('with a TS webpack configuration', () => {
    it('should support old config and register ts-node', () => {
      _.set(serverless, 'service.custom.webpack', 'webpack.config.ts');
      new ServerlessWebpack(serverless, {});
      expect(Module._load).to.have.been.calledOnce;
      expect(Module._load).to.have.been.calledWith('ts-node/register');
    });

    it('should support new config and register ts-node', () => {
      _.set(serverless, 'service.custom.webpack.webpackConfig', 'webpack.config.ts');
      new ServerlessWebpack(serverless, {});
      expect(Module._load).to.have.been.calledOnce;
      expect(Module._load).to.have.been.calledWith('ts-node/register');
    });

    it('should not register ts-node if it has already been registered', () => {
      _.set(serverless, 'service.custom.webpack.webpackConfig', 'webpack.config.ts');
      process[Symbol.for('ts-node.register.instance')] = 'foo';
      new ServerlessWebpack(serverless, {});
      delete process[Symbol.for('ts-node.register.instance')];
      expect(Module._load).to.not.have.been.called;
      expect(Module._load).to.not.have.been.calledWith('ts-node/register');
    });

    it('should throw an error if config use TS but ts-node was not added as dependency', () => {
      moduleStub.throws();

      _.set(serverless, 'service.custom.webpack.webpackConfig', 'webpack.config.ts');

      const badDeps = function () {
        new ServerlessWebpack(serverless, {});
      };

      expect(badDeps).to.throw(
        'If you want to use TypeScript with serverless-webpack, please add "ts-node" as dependency.'
      );

      expect(Module._load).to.have.been.calledOnce;
      expect(Module._load).to.have.been.calledWith('ts-node/register');

      moduleStub.reset();
    });
  });

  describe('with a JS webpack configuration', () => {
    it('should not load ts-node', () => {
      _.set(serverless, 'service.custom.webpack', 'webpack.config.js');
      new ServerlessWebpack(serverless, {});
      expect(Module._load).to.not.have.been.called;
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
        expect(slsw).to.have.a.nested.property(command);
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

    before(() => {
      slsw = new ServerlessWebpack(serverless, rawOptions);
      if (serverless.processedInput) {
        // serverless.processedInput does not exist in serverless@<2.0.0
        serverless.processedInput.options = processedOptions;
      }
      sandbox.stub(slsw, 'cleanup').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'watch').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'wpwatch').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'packExternalModules').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'copyExistingArtifacts').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'prepareRun').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'watchRun').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'validate').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'compile').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'packageModules').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'prepareLocalInvoke').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'prepareOfflineInvoke').returns(BbPromise.resolve());
      sandbox.stub(slsw, 'prepareStepOfflineInvoke').returns(BbPromise.resolve());
    });

    beforeEach(() => {
      ServerlessWebpack.lib.webpack.isLocal = false;
      slsw.skipCompile = false;
    });

    after(() => {
      slsw.cleanup.restore();
    });

    _.forEach(
      [
        {
          name: 'before:package:createDeploymentArtifacts',
          test: () => {
            it('should spawn validate, compile and package', () => {
              return expect(slsw.hooks['before:package:createDeploymentArtifacts']()).to.be.fulfilled.then(() => {
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledThrice;
                expect(slsw.serverless.pluginManager.spawn.firstCall).to.have.been.calledWithExactly(
                  'webpack:validate'
                );
                expect(slsw.serverless.pluginManager.spawn.secondCall).to.have.been.calledWithExactly(
                  'webpack:compile'
                );
                expect(slsw.serverless.pluginManager.spawn.thirdCall).to.have.been.calledWithExactly('webpack:package');
                return null;
              });
            });

            it('should skip compile if requested', () => {
              slsw.skipCompile = true;
              return expect(slsw.hooks['before:package:createDeploymentArtifacts']()).to.be.fulfilled.then(() => {
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledTwice;
                expect(slsw.serverless.pluginManager.spawn.firstCall).to.have.been.calledWithExactly(
                  'webpack:validate'
                );
                expect(slsw.serverless.pluginManager.spawn.secondCall).to.have.been.calledWithExactly(
                  'webpack:package'
                );
                return null;
              });
            });
          }
        },
        {
          name: 'after:package:createDeploymentArtifacts',
          test: () => {
            it('should call cleanup', () => {
              return expect(slsw.hooks['after:package:createDeploymentArtifacts']()).to.be.fulfilled.then(() => {
                expect(slsw.cleanup).to.have.been.calledOnce;
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

              return expect(slsw.hooks['before:deploy:function:packageFunction']()).to.be.fulfilled.then(() => {
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledThrice;
                expect(slsw.serverless.pluginManager.spawn.firstCall).to.have.been.calledWithExactly(
                  'webpack:validate'
                );
                expect(slsw.serverless.pluginManager.spawn.secondCall).to.have.been.calledWithExactly(
                  'webpack:compile'
                );
                expect(slsw.serverless.pluginManager.spawn.thirdCall).to.have.been.calledWithExactly('webpack:package');
                return null;
              });
            });
          }
        },
        {
          name: 'webpack:webpack',
          test: () => {
            it('should spawn validate, compile and package', () => {
              return expect(slsw.hooks['webpack:webpack']()).to.be.fulfilled.then(() => {
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledThrice;
                expect(slsw.serverless.pluginManager.spawn.firstCall).to.have.been.calledWithExactly(
                  'webpack:validate'
                );
                expect(slsw.serverless.pluginManager.spawn.secondCall).to.have.been.calledWithExactly(
                  'webpack:compile'
                );
                expect(slsw.serverless.pluginManager.spawn.thirdCall).to.have.been.calledWithExactly('webpack:package');
                return null;
              });
            });
          }
        },
        {
          name: 'before:invoke:local:invoke',
          test: () => {
            it('should prepare for local invoke', () => {
              return expect(slsw.hooks['before:invoke:local:invoke']()).to.be.fulfilled.then(() => {
                expect(ServerlessWebpack.lib.webpack.isLocal).to.be.true;
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledTwice;
                expect(slsw.serverless.pluginManager.spawn.firstCall).to.have.been.calledWithExactly(
                  'webpack:validate'
                );
                expect(slsw.serverless.pluginManager.spawn.secondCall).to.have.been.calledWithExactly(
                  'webpack:compile'
                );
                expect(slsw.prepareLocalInvoke).to.have.been.calledOnce;
                return null;
              });
            });

            it('should skip compile if requested', () => {
              slsw.options.build = false;
              slsw.skipCompile = true;
              return expect(slsw.hooks['before:invoke:local:invoke']()).to.be.fulfilled.then(() => {
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledOnce;
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledWithExactly('webpack:validate');
                expect(slsw.prepareLocalInvoke).to.have.been.calledOnce;
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
              return expect(slsw.hooks['after:invoke:local:invoke']()).to.be.fulfilled.then(() => {
                expect(slsw.watch).to.not.have.been.called;
                return null;
              });
            });

            it('should watch if enabled', () => {
              slsw.options.watch = true;
              return expect(slsw.hooks['after:invoke:local:invoke']()).to.be.fulfilled.then(() => {
                expect(slsw.watch).to.have.been.calledOnce;
                expect(slsw.watch).to.have.been.calledWithExactly('invoke:local');
                return null;
              });
            });
          }
        },
        {
          name: 'before:run:run',
          test: () => {
            it('should prepare for run', () => {
              return expect(slsw.hooks['before:run:run']()).to.be.fulfilled.then(() => {
                expect(slsw.serverless.service.package.individually).to.be.false;
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledTwice;
                expect(slsw.serverless.pluginManager.spawn.firstCall).to.have.been.calledWithExactly(
                  'webpack:validate'
                );
                expect(slsw.serverless.pluginManager.spawn.secondCall).to.have.been.calledWithExactly(
                  'webpack:compile'
                );
                expect(slsw.packExternalModules).to.have.been.calledOnce;
                expect(slsw.prepareRun).to.have.been.calledOnce;
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
              return expect(slsw.hooks['after:run:run']()).to.be.fulfilled.then(() => {
                expect(slsw.watch).to.not.have.been.called;
                return null;
              });
            });

            it('should watch if enabled', () => {
              slsw.options.watch = true;
              return expect(slsw.hooks['after:run:run']()).to.be.fulfilled.then(() => {
                expect(slsw.watch).to.have.been.calledOnce;
                expect(slsw.watch).to.have.been.calledOnce;
                return null;
              });
            });
          }
        },
        {
          name: 'webpack:validate:validate',
          test: () => {
            it('should call validate', () => {
              return expect(slsw.hooks['webpack:validate:validate']()).to.be.fulfilled.then(() => {
                expect(slsw.validate).to.have.been.calledOnce;
                return null;
              });
            });
          }
        },
        {
          name: 'webpack:compile:compile',
          test: () => {
            it('should call compile', () => {
              return expect(slsw.hooks['webpack:compile:compile']()).to.be.fulfilled.then(() => {
                expect(slsw.compile).to.have.been.calledOnce;
                return null;
              });
            });
          }
        },
        {
          name: 'webpack:compile:watch:compile',
          test: () => {
            it('should resolve', () => {
              return expect(slsw.hooks['webpack:compile:watch:compile']()).to.be.fulfilled;
            });
          }
        },
        {
          name: 'webpack:package:packExternalModules',
          test: () => {
            it('should call packExternalModules', () => {
              return expect(slsw.hooks['webpack:package:packExternalModules']()).to.be.fulfilled.then(() => {
                expect(slsw.packExternalModules).to.have.been.calledOnce;
                return null;
              });
            });
          }
        },
        {
          name: 'webpack:package:packageModules',
          test: () => {
            it('should call packageModules', () => {
              return expect(slsw.hooks['webpack:package:packageModules']()).to.be.fulfilled.then(() => {
                expect(slsw.packageModules).to.have.been.calledOnce;
                return null;
              });
            });
          }
        },
        {
          name: 'webpack:package:copyExistingArtifacts',
          test: () => {
            it('should call copyExistingArtifacts', () => {
              return expect(slsw.hooks['webpack:package:copyExistingArtifacts']()).to.be.fulfilled.then(() => {
                expect(slsw.copyExistingArtifacts).to.have.been.calledOnce;
                return null;
              });
            });
          }
        },
        {
          name: 'before:offline:start',
          test: () => {
            it('should prepare offline', () => {
              slsw.skipCompile = false;
              slsw.options.build = true;
              return expect(slsw.hooks['before:offline:start']()).to.be.fulfilled.then(() => {
                expect(ServerlessWebpack.lib.webpack.isLocal).to.be.true;
                expect(slsw.prepareOfflineInvoke).to.have.been.calledOnce;
                expect(slsw.wpwatch).to.have.been.calledOnce;
                return null;
              });
            });
            it('should skip compiling when requested', () => {
              slsw.skipCompile = true;
              slsw.options.build = false;
              return expect(slsw.hooks['before:offline:start']()).to.be.fulfilled.then(() => {
                expect(ServerlessWebpack.lib.webpack.isLocal).to.be.true;
                expect(slsw.prepareOfflineInvoke).to.have.been.calledOnce;
                expect(slsw.wpwatch).to.not.have.been.called;
                return null;
              });
            });
          }
        },
        {
          name: 'before:offline:start:init',
          test: () => {
            it('should prepare offline', () => {
              slsw.skipCompile = false;
              slsw.options.build = true;
              return expect(slsw.hooks['before:offline:start:init']()).to.be.fulfilled.then(() => {
                expect(ServerlessWebpack.lib.webpack.isLocal).to.be.true;
                expect(slsw.prepareOfflineInvoke).to.have.been.calledOnce;
                expect(slsw.wpwatch).to.have.been.calledOnce;
                return null;
              });
            });
            it('should skip compiling when requested', () => {
              slsw.skipCompile = false;
              slsw.options.build = false;
              return expect(slsw.hooks['before:offline:start:init']()).to.be.fulfilled.then(() => {
                expect(ServerlessWebpack.lib.webpack.isLocal).to.be.true;
                expect(slsw.prepareOfflineInvoke).to.have.been.calledOnce;
                expect(slsw.wpwatch).to.not.have.been.called;
                return null;
              });
            });
          }
        },
        {
          name: 'before:step-functions-offline:start',
          test: () => {
            it('should prepare offline', () => {
              return expect(slsw.hooks['before:step-functions-offline:start']()).to.be.fulfilled.then(() => {
                expect(ServerlessWebpack.lib.webpack.isLocal).to.be.true;
                expect(slsw.prepareStepOfflineInvoke).to.have.been.calledOnce;
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledOnce;
                expect(slsw.serverless.pluginManager.spawn).to.have.been.calledWithExactly('webpack:compile');
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
                expect(slsw.options).to.equal(processedOptions);
              } else {
                // serverless.processedInput does not exist in serverless@<2.0.0
                // The options should not be changed
                expect(slsw.options).to.equal(rawOptions);
              }
            });
          }
        }
      ],
      hook => {
        it(`should expose hook ${hook.name}`, () => {
          expect(slsw).to.have.a.nested.property(`hooks.${hook.name}`);
        });

        describe(hook.name, () => {
          hook.test();
        });
      }
    );
  });
});
