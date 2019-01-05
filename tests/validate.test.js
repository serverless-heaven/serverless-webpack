'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const path = require('path');
const Serverless = require('serverless');
const fsExtraMockFactory = require('./mocks/fs-extra.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

const globMock = {
  sync: _.noop
};

describe('validate', () => {
  let fsExtraMock;
  let baseModule;
  let module;
  let serverless;
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();

    mockery.enable({ warnOnUnregistered: false });
    fsExtraMock = fsExtraMockFactory.create(sandbox);
    mockery.registerMock('fs-extra', fsExtraMock);
    mockery.registerMock('glob', globMock);
    baseModule = require('../lib/validate');
    Object.freeze(baseModule);
  });

  after(() => {
    mockery.disable();
    mockery.deregisterAll();
  });

  beforeEach(() => {
    serverless = new Serverless();
    serverless.cli = {
      log: sandbox.stub()
    };
    module = _.assign({
      serverless,
      options: {},
    }, baseModule);
  });

  afterEach(() => {
    fsExtraMock.removeSync.reset();
    fsExtraMock.pathExistsSync.reset();
    sandbox.restore();
  });

  it('should expose a `validate` method', () => {
    expect(module.validate).to.be.a('function');
  });

  it('should set `webpackConfig` in the context to `custom.webpack` option', () => {
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {
        path: 'test',
      },
    };
    _.set(module.serverless.service, 'custom.webpack.config', testConfig);
    return module
      .validate()
      .then(() => expect(module.webpackConfig).to.eql(testConfig));
  });

  it('should delete the output path', () => {
    const testOutPath = 'test';
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {
        path: testOutPath,
      },
    };
    _.set(module.serverless.service, 'custom.webpack.config', testConfig);
    return module
      .validate()
      .then(() => expect(fsExtraMock.removeSync).to.have.been.calledWith(testOutPath));
  });

  it('should keep the output path if requested', () => {
    const testOutPath = 'test';
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {
        path: testOutPath,
      },
    };
    _.set(module, 'keepOutputDirectory', true);
    _.set(module.serverless.service, 'custom.webpack.config', testConfig);
    return module
      .validate()
      .then(() => expect(fsExtraMock.removeSync).to.not.have.been.called);
  });

  it('should override the output path if `out` option is specified', () => {
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {
        path: 'originalpath',
        filename: 'filename',
      },
    };
    const testServicePath = 'testpath';
    const testOptionsOut = 'testdir';
    module.options.out = testOptionsOut;
    module.serverless.config.servicePath = testServicePath;
    _.set(module.serverless.service, 'custom.webpack.config', testConfig);
    return module
      .validate()
      .then(() => expect(module.webpackConfig.output).to.eql({
        path: path.join(testServicePath, testOptionsOut, 'service'),
        filename: 'filename',
      }));
  });

  it('should set a default `webpackConfig.context` if not present', () => {
    const testConfig = {
      entry: 'test',
      output: {},
    };
    const testServicePath = 'testpath';
    module.serverless.config.servicePath = testServicePath;
    _.set(module.serverless.service, 'custom.webpack.config', testConfig);
    return module
      .validate()
      .then(() => expect(module.webpackConfig.context).to.equal(testServicePath));
  });

  describe('default target', () => {
    it('should set a default `webpackConfig.target` if not present', () => {
      const testConfig = {
        entry: 'test',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      return module
      .validate()
      .then(() => expect(module.webpackConfig.target).to.equal('node'));
    });

    it('should not change `webpackConfig.target` if one is present', () => {
      const testConfig = {
        entry: 'test',
        target: 'myTarget',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      return module
      .validate()
      .then(() => expect(module.webpackConfig.target).to.equal('myTarget'));
    });
  });

  describe('default output', () => {
    it('should set a default `webpackConfig.output` if not present', () => {
      const testEntry = 'testentry';
      const testConfig = {
        entry: testEntry,
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      return module
        .validate()
        .then(() => expect(module.webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.webpack', 'service'),
          filename: '[name].js',
        }));
    });

    it('should set a default `webpackConfig.output.filename` if `entry` is an array', () => {
      const testEntry = [ 'first', 'second', 'last' ];
      const testConfig = {
        entry: testEntry,
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      return module
        .validate()
        .then(() => expect(module.webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.webpack', 'service'),
          filename: '[name].js',
        }));
    });

    it('should set a default `webpackConfig.output.filename` if `entry` is not defined', () => {
      const testConfig = {};
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      return module
        .validate()
        .then(() => expect(module.webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.webpack', 'service'),
          filename: '[name].js',
        }));
    });
  });

  describe('config file load', () => {
    it('should load a webpack config from file if `custom.webpack` is a string', () => {
      const testConfig = 'testconfig';
      const testServicePath = 'testpath';
      const requiredPath = path.join(testServicePath, testConfig);
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      serverless.utils.fileExistsSync = sinon.stub().returns(true);
      const loadedConfig = {
        entry: 'testentry',
      };
      mockery.registerMock(requiredPath, loadedConfig);
      return expect(module.validate()).to.fulfilled
      .then(() => {
        expect(serverless.utils.fileExistsSync).to.have.been.calledWith(requiredPath);
        expect(module.webpackConfig).to.eql(loadedConfig);
        return null;
      })
      .finally(() => {
        mockery.deregisterMock(requiredPath);
      });
    });

    it('should load a async webpack config from file if `custom.webpack` is a string', () => {
      const testConfig = 'testconfig';
      const testServicePath = 'testpath';
      const requiredPath = path.join(testServicePath, testConfig);
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      serverless.utils.fileExistsSync = sinon.stub().returns(true);
      const loadedConfig = {
        entry: 'testentry',
      };
      const loadedConfigPromise = BbPromise.resolve(loadedConfig);
      mockery.registerMock(requiredPath, loadedConfigPromise);
      return expect(module.validate()).to.be.fulfilled
      .then(() => {
        expect(serverless.utils.fileExistsSync).to.have.been.calledWith(requiredPath);
        expect(module.webpackConfig).to.deep.equal(loadedConfig);
        return null;
      })
      .finally(() => {
        mockery.deregisterMock(requiredPath);
      });
    });

    it('should catch errors while loading a async webpack config from file if `custom.webpack` is a string', () => {
      const testConfig = 'testconfig';
      const testServicePath = 'testpath';
      const requiredPath = path.join(testServicePath, testConfig);
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      serverless.utils.fileExistsSync = sinon.stub().returns(true);
      const loadedConfigPromise = BbPromise.reject('config failed to load');
      mockery.registerMock(requiredPath, loadedConfigPromise);
      return expect(module.validate()).to.be.rejectedWith('config failed to load')
      .then(() => {
        expect(serverless.utils.fileExistsSync).to.have.been.calledWith(requiredPath);
        return null;
      })
      .finally(() => {
        mockery.deregisterMock(requiredPath);
      });
    });

    it('should load a wrong thenable webpack config as normal object from file if `custom.webpack` is a string', () => {
      const testConfig = 'testconfig';
      const testServicePath = 'testpath';
      const requiredPath = path.join(testServicePath, testConfig);
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      serverless.utils.fileExistsSync = sinon.stub().returns(true);
      const loadedConfig = {
        then: 'I am not a Promise member',
        entry: 'testentry',
      };
      mockery.registerMock(requiredPath, loadedConfig);
      return expect(module.validate()).to.be.fulfilled
      .then(() => {
        expect(serverless.utils.fileExistsSync).to.have.been.calledWith(requiredPath);
        expect(module.webpackConfig).to.deep.equal(loadedConfig);
        return null;
      })
      .finally(() => {
        mockery.deregisterMock(requiredPath);
      });
    });

    it('should throw if providing an invalid file', () => {
      const testConfig = 'testconfig';
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      serverless.utils.fileExistsSync = sinon.stub().returns(false);
      return expect(module.validate()).to.be.rejectedWith(/could not find/);
    });

    it('should load a default file if no custom config is provided', () => {
      const testConfig = 'webpack.config.js';
      const testServicePath = 'testpath';
      const requiredPath = path.join(testServicePath, testConfig);
      module.serverless.config.servicePath = testServicePath;
      serverless.utils.fileExistsSync = sinon.stub().returns(true);
      const loadedConfig = {
        entry: 'testentry',
      };
      mockery.registerMock(requiredPath, loadedConfig);
      return expect(module.validate()).to.be.fulfilled
      .then(() => {
        expect(serverless.utils.fileExistsSync).to.have.been.calledWith(requiredPath);
        expect(module.webpackConfig).to.eql(loadedConfig);
        return null;
      })
      .finally(() => {
        mockery.deregisterMock(requiredPath);
      });
    });

    it('should fail when importing a broken configuration file', () => {
      const testConfig = 'invalid.webpack.config.js';
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      serverless.utils.fileExistsSync = sinon.stub().returns(true);
      return expect(module.validate()).to.be.rejected
      .then(() => expect(serverless.cli.log).to.have.been.calledWith(sinon.match(/^Could not load webpack config/)));
    });
  });

  describe('lib', () => {
    it('should expose the serverless instance', () => {
      const testOutPath = 'test';
      const testConfig = {
        entry: 'test',
        context: 'testcontext',
        output: {
          path: testOutPath,
        },
      };
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      return expect(module.validate()).to.be.fulfilled
      .then(() => {
        const lib = require('../lib/index');
        expect(lib.serverless).to.equal(serverless);
        return null;
      });
    });

    it('should expose the plugin options', () => {
      const testOutPath = 'test';
      const testConfig = {
        entry: 'test',
        context: 'testcontext',
        output: {
          path: testOutPath,
        },
      };
      const testOptions = {
        stage: 'testStage',
        verbose: true
      };
      const configuredModule = _.assign({
        serverless,
        options: _.cloneDeep(testOptions),
      }, baseModule);
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      return expect(configuredModule.validate()).to.be.fulfilled
      .then(() => {
        const lib = require('../lib/index');
        expect(lib.options).to.deep.equal(testOptions);
        return null;
      });
    });

    describe('entries', () => {
      let globSyncStub;

      beforeEach(() => {
        globSyncStub = sandbox.stub(globMock, 'sync');
      });

      const testFunctionsConfig = {
        func1: {
          handler: 'module1.func1handler',
          artifact: 'artifact-func1.zip',
          events: [{
            http: {
              method: 'get',
              path: 'func1path',
            },
          }],
        },
        func2: {
          handler: 'module2.func2handler',
          artifact: 'artifact-func2.zip',
          events: [
            {
              http: {
                method: 'POST',
                path: 'func2path',
              },
            }, {
              nonhttp: 'non-http',
            }
          ],
        },
        func3: {
          handler: 'handlers/func3/module2.func3handler',
          artifact: 'artifact-func3.zip',
          events: [{
            nonhttp: 'non-http',
          }],
        },
        func4: {
          handler: 'handlers/module2/func3/module2.func3handler',
          artifact: 'artifact-func3.zip',
          events: [{
            nonhttp: 'non-http',
          }],
        },
      };

      const testFunctionsGoogleConfig = {
        func1: {
          handler: 'func1handler',
          events: [{
            http: {
              method: 'get',
              path: 'func1path',
            },
          }],
        },
      };

      it('should expose all functions if `options.function` is not defined', () => {
        const testOutPath = 'test';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.webpack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        globSyncStub.callsFake(filename => [_.replace(filename, '*', 'js')]);
        return expect(module.validate()).to.be.fulfilled
        .then(() => {
          const lib = require('../lib/index');
          const expectedLibEntries = {
            'module1': './module1.js',
            'module2': './module2.js',
            'handlers/func3/module2': './handlers/func3/module2.js',
            'handlers/module2/func3/module2': './handlers/module2/func3/module2.js',
          };

          expect(lib.entries).to.deep.equal(expectedLibEntries);
          expect(globSyncStub).to.have.callCount(4);
          expect(serverless.cli.log).to.not.have.been.called;
          return null;
        });
      });

      it('should expose the requested function if `options.function` is defined and the function is found', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.webpack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globSyncStub.callsFake(filename => [_.replace(filename, '*', 'js')]);
        return expect(module.validate()).to.be.fulfilled
        .then(() => {
          const lib = require('../lib/index');
          const expectedLibEntries = {
            'module1': './module1.js'
          };

          expect(lib.entries).to.deep.equal(expectedLibEntries);
          expect(globSyncStub).to.have.been.calledOnce;
          expect(serverless.cli.log).to.not.have.been.called;
          return null;
        });
      });

      describe('google provider', () => {
        beforeEach(() => {
          _.set(module.serverless, 'service.provider.name', 'google');

        });

        afterEach(() => {
          _.unset(module.serverless, 'service.provider.name');
        });

        it('should ignore entry points for the Google provider', () => {
          const testOutPath = 'test';
          const testFunction = 'func1';
          const testConfig = {
            entry: './index.js',
            target: 'node',
            output: {
              path: testOutPath,
              filename: 'index.js'
            },
          };
          _.set(module.serverless.service, 'custom.webpack.config', testConfig);
          module.serverless.service.functions = testFunctionsGoogleConfig;
          module.options.function = testFunction;
          globSyncStub.returns([]);
          return expect(module.validate()).to.be.fulfilled
          .then(() => {
            const lib = require('../lib/index');

            expect(lib.entries).to.deep.equal({});
            expect(globSyncStub).to.not.have.been.called;
            expect(serverless.cli.log).to.not.have.been.called;
            return null;
          });
        });
      });

      describe('package individually', () => {
        const testConfig = {
          output: {
            path: 'output',
          },
        };

        beforeEach(() => {
          _.set(module.serverless, 'service.package.individually', 'true');
        });

        afterEach(() => {
          _.unset(module.serverless, 'service.package.individually');
        });

        it('should enable multiCompile', () => {
          _.set(module.serverless.service, 'custom.webpack.config', testConfig);
          module.serverless.service.functions = testFunctionsConfig;
          globSyncStub.callsFake(filename => [_.replace(filename, '*', 'js')]);

          expect(module.multiCompile).to.be.undefined;
          return expect(module.validate()).to.be.fulfilled
          .then(() => {
            expect(module.multiCompile).to.be.true;

            return null;
          });
        });

        it('should fail if webpackConfig.entry is customised', () => {
          _.set(module.serverless.service, 'custom.webpack.config', _.merge({}, testConfig, {
            entry: {
              module1: './module1.js',
              module2: './module2.js'
            }
          }));
          module.serverless.service.functions = testFunctionsConfig;
          globSyncStub.callsFake(filename => [_.replace(filename, '*', 'js')]);
          return expect(module.validate()).to.be.rejectedWith(
            /Webpack entry must be automatically resolved when package.individually is set to true/);
        });

        it('should not fail if webpackConfig.entry is set to lib.entries for backward compatibility', () => {
          const lib = require('../lib/index');
          _.set(module.serverless.service, 'custom.webpack.config', _.merge({}, testConfig, {
            entry: lib.entries
          }));
          module.serverless.service.functions = testFunctionsConfig;
          globSyncStub.callsFake(filename => [_.replace(filename, '*', 'js')]);
          return expect(module.validate()).to.be.fulfilled;
        });

        it('should expose all functions details in entryFunctions property', () => {
          _.set(module.serverless.service, 'custom.webpack.config', testConfig);
          module.serverless.service.functions = testFunctionsConfig;
          globSyncStub.callsFake(filename => [_.replace(filename, '*', 'js')]);
          return expect(module.validate()).to.be.fulfilled
          .then(() => {
            expect(module.entryFunctions).to.deep.equal([
              {
                handlerFile: 'module1',
                funcName: 'func1',
                func: testFunctionsConfig.func1,
                entry: { key: 'module1', value: './module1.js' }
              },
              {
                handlerFile: 'module2',
                funcName: 'func2',
                func: testFunctionsConfig.func2,
                entry: { key: 'module2', value: './module2.js' }
              },
              {
                handlerFile: path.join('handlers', 'func3', 'module2'),
                funcName: 'func3',
                func: testFunctionsConfig.func3,
                entry: { key: 'handlers/func3/module2', value: './handlers/func3/module2.js' }
              },
              {
                handlerFile: path.join('handlers', 'module2', 'func3', 'module2'),
                funcName: 'func4',
                func: testFunctionsConfig.func4,
                entry: { key: 'handlers/module2/func3/module2', value: './handlers/module2/func3/module2.js' }
              }
            ]);
            return null;
          });
        });

        it('should set webpackConfig output path for every functions', () => {
          _.set(module.serverless.service, 'custom.webpack.config', testConfig);
          module.serverless.service.functions = testFunctionsConfig;
          globSyncStub.callsFake(filename => [_.replace(filename, '*', 'js')]);
          return expect(module.validate()).to.be.fulfilled
          .then(() => {
            expect(module.webpackConfig).to.have.lengthOf(4);
            expect(module.webpackConfig[0].output.path).to.equal(path.join('output', 'func1'));
            expect(module.webpackConfig[1].output.path).to.equal(path.join('output', 'func2'));
            expect(module.webpackConfig[2].output.path).to.equal(path.join('output', 'func3'));
            expect(module.webpackConfig[3].output.path).to.equal(path.join('output', 'func4'));

            return null;
          });
        });

        it('should clone other webpackConfig options without modification', () => {
          _.set(module.serverless.service, 'custom.webpack.config', _.merge({}, testConfig, {
            devtool: 'source-map',
            context: 'some context',
            output: {
              libraryTarget: 'commonjs'
            }
          }));
          module.serverless.service.functions = testFunctionsConfig;
          globSyncStub.callsFake(filename => [_.replace(filename, '*', 'js')]);
          return expect(module.validate()).to.be.fulfilled
          .then(() => {
            expect(module.webpackConfig).to.have.lengthOf(4);
            expect(module.webpackConfig[0].devtool).to.equal('source-map');
            expect(module.webpackConfig[1].devtool).to.equal('source-map');
            expect(module.webpackConfig[2].devtool).to.equal('source-map');
            expect(module.webpackConfig[3].devtool).to.equal('source-map');
            expect(module.webpackConfig[0].context).to.equal('some context');
            expect(module.webpackConfig[1].context).to.equal('some context');
            expect(module.webpackConfig[2].context).to.equal('some context');
            expect(module.webpackConfig[3].context).to.equal('some context');
            expect(module.webpackConfig[0].output.libraryTarget).to.equal('commonjs');
            expect(module.webpackConfig[1].output.libraryTarget).to.equal('commonjs');
            expect(module.webpackConfig[2].output.libraryTarget).to.equal('commonjs');
            expect(module.webpackConfig[3].output.libraryTarget).to.equal('commonjs');
            return null;
          });
        });
      });

      it('should show a warning if more than one matching handler is found', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.webpack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globSyncStub.returns([ 'module1.ts', 'module1.js' ]);
        return expect(module.validate()).to.be.fulfilled
        .then(() => {
          const lib = require('../lib/index');
          const expectedLibEntries = {
            'module1': './module1.ts'
          };

          expect(lib.entries).to.deep.equal(expectedLibEntries);
          expect(globSyncStub).to.have.been.calledOnce;
          expect(serverless.cli.log).to.have.been.calledOnce;
          expect(serverless.cli.log).to.have.been.calledWith(
            'WARNING: More than one matching handlers found for \'module1\'. Using \'module1.ts\'.'
          );
          return null;
        });
      });

      it('should select the most probable handler if multiple hits are found', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.webpack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globSyncStub.returns([ 'module1.doc', 'module1.json', 'module1.test.js', 'module1.ts', 'module1.js' ]);
        return expect(module.validate()).to.be.fulfilled
        .then(() => {
          const lib = require('../lib/index');
          const expectedLibEntries = {
            'module1': './module1.ts'
          };

          expect(lib.entries).to.deep.equal(expectedLibEntries);
          expect(globSyncStub).to.have.been.calledOnce;
          expect(serverless.cli.log).to.have.been.calledOnce;
          expect(serverless.cli.log).to.have.been.calledWith(
            'WARNING: More than one matching handlers found for \'module1\'. Using \'module1.ts\'.'
          );
          return null;
        });
      });

      it('should call glob with ignore parameter if there is an excludeFiles config', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.webpack.config', testConfig);
        _.set(module.serverless.service, 'custom.webpack.excludeFiles', '**/*.ts');
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globSyncStub.returns(['module1.js']);
        return expect(module.validate()).to.be.fulfilled
        .then(() => {
          const lib = require('../lib/index');
          const expectedLibEntries = {
            'module1': './module1.js'
          };

          expect(lib.entries).to.deep.equal(expectedLibEntries);

          expect(globSyncStub).to.have.been.calledOnceWith('module1.*', {
            ignore: '**/*.ts',
            cwd: null,
            nodir: true
          });
          expect(serverless.cli.log).not.to.have.been.called;
          return null;
        });
      });

      it('should throw an exception if no handler is found', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.webpack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globSyncStub.returns([]);
        expect(() => {
          module.validate();
        }).to.throw(/No matching handler found for/);
      });

      it('should throw an exception if `options.function` is defined but not found in entries from serverless.yml', () => {
        const testOutPath = 'test';
        const testFunction = 'test';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.webpack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        expect(() => {
          module.validate();
        }).to.throw(new RegExp(`^Function "${testFunction}" doesn't exist`));
      });
    });

    describe('webpack', () => {
      it('should default isLocal to false', () => {
        const testOutPath = 'test';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.webpack.config', testConfig);
        return expect(module.validate()).to.be.fulfilled
        .then(() => {
          const lib = require('../lib/index');
          expect(lib.webpack.isLocal).to.be.false;
          return null;
        });
      });
    });
  });

  describe('with skipped builds', () => {
    it('should keep output directory', () => {
      const testConfig = {
        entry: 'test',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      module.skipCompile = true;
      fsExtraMock.pathExistsSync.returns(true);
      return module
      .validate()
      .then(() => {
        expect(module.keepOutputDirectory).to.be.true;
        return null;
      });
    });

    it('should fail without exiting output', () => {
      const testConfig = {
        entry: 'test',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.webpack.config', testConfig);
      module.skipCompile = true;
      fsExtraMock.pathExistsSync.returns(false);
      return expect(module.validate()).to.be.rejectedWith(/No compiled output found/);
    });
  });
});
