'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const Serverless = require('serverless');
const Configuration = require('../lib/Configuration');
const fsMock = require('fs');
const globMock = require('glob');
const baseModule = require('../lib/packageModules');

jest.mock('fs');
jest.mock('glob');

describe('packageModules', () => {
  let serverless;
  let module;

  // Serverless stubs
  let writeFileDirStub;
  let getAllFunctionsStub;
  let getFunctionStub;
  let getServiceObjectStub;
  let getVersionStub;

  beforeEach(() => {
    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn(),
      consoleLog: jest.fn()
    };

    writeFileDirStub = jest.fn();
    serverless.utils.writeFileDir = writeFileDirStub;
    getAllFunctionsStub = jest.fn();
    serverless.service.getAllFunctions = getAllFunctionsStub;
    getFunctionStub = jest.fn();
    serverless.service.getFunction = getFunctionStub;
    getServiceObjectStub = jest.fn();
    serverless.service.getServiceObject = getServiceObjectStub;
    getVersionStub = jest.fn();
    serverless.getVersion = getVersionStub;

    module = _.assign(
      {
        serverless,
        options: {
          verbose: true
        },
        webpackOutputPath: '.webpack',
        configuration: new Configuration()
      },
      baseModule
    );
  });

  describe('packageModules()', () => {
    it('should do nothing if no compile stats are available', () => {
      module.compileStats = { stats: [] };
      return expect(module.packageModules())
        .resolves.toEqual([])
        .then(() =>
          BbPromise.all([
            expect(writeFileDirStub).toHaveBeenCalledTimes(0),
            expect(fsMock.createWriteStream).toHaveBeenCalledTimes(0),
            expect(globMock.sync).toHaveBeenCalledTimes(0)
          ])
        );
    });

    it('should do nothing if skipCompile is true', () => {
      module.skipCompile = true;
      return expect(module.packageModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            expect(writeFileDirStub).toHaveBeenCalledTimes(0),
            expect(fsMock.createWriteStream).toHaveBeenCalledTimes(0),
            expect(globMock.sync).toHaveBeenCalledTimes(0)
          ])
        );
    });

    describe('with service packaging', () => {
      beforeEach(() => {
        // Setup behavior for service packaging
        _.unset(module, 'entryFunctions');
        _.set(serverless.service, 'package.individually', false);
      });

      it('should package', () => {
        // Test data
        const stats = {
          stats: [
            {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          ]
        };
        const files = ['README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map'];
        const allFunctions = ['func1', 'func2'];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        getVersionStub.mockReturnValue('1.18.0');
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          }
        });
        // Mock behavior
        globMock.sync.mockReturnValue(files);
        fsMock._streamMock.on.mockImplementation((evt, cb) => {
          if (evt === 'open' || evt === 'close') {
            cb();
          }
        });
        fsMock._statMock.isDirectory.mockReturnValue(false);

        module.compileStats = stats;
        return expect(module.packageModules())
          .resolves.toEqual([path.join('.webpack', 'test-service.zip')])
          .then(() => BbPromise.all([]));
      });

      describe('with the Google provider', () => {
        let oldProviderName;

        beforeEach(() => {
          oldProviderName = serverless.service.provider.name;
          // Imitate Google provider
          serverless.service.provider.name = 'google';
        });

        afterEach(() => {
          if (oldProviderName) {
            serverless.service.provider.name = oldProviderName;
          } else {
            _.unset(serverless.service.provider, 'name');
          }
        });

        it('should set the service artifact path', () => {
          // Test data
          const stats = {
            stats: [
              {
                outputPath: '/my/Service/Path/.webpack/service'
              }
            ]
          };
          const files = ['README.md', 'index.js'];
          const allFunctions = ['func1', 'func2'];
          const func1 = {
            handler: 'handler1',
            events: []
          };
          const func2 = {
            handler: 'handler2',
            events: []
          };
          getVersionStub.mockReturnValue('1.18.0');
          getServiceObjectStub.mockReturnValue({
            name: 'test-service'
          });
          getAllFunctionsStub.mockReturnValue(allFunctions);
          getFunctionStub.mockImplementation(name => {
            if (name === 'func1') {
              return func1;
            } else if (name === 'func2') {
              return func2;
            }
          });
          // Mock behavior
          globMock.sync.mockReturnValue(files);
          fsMock._streamMock.on.mockImplementation((evt, cb) => {
            if (evt === 'open' || evt === 'close') {
              cb();
            }
          });
          fsMock._statMock.isDirectory.mockReturnValue(false);

          module.compileStats = stats;
          return expect(module.packageModules()).resolves.toEqual([path.join('.webpack', 'test-service.zip')]);
        });
      });

      it('should set the function artifact depending on the serverless version', () => {
        // Test data
        const stats = {
          stats: [
            {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          ]
        };
        const files = ['README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map'];
        const allFunctions = ['func1', 'func2'];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          }
        });
        // Mock behavior
        globMock.sync.mockReturnValue(files);
        fsMock._streamMock.on.mockImplementation((evt, cb) => {
          if (evt === 'open' || evt === 'close') {
            cb();
          }
        });
        fsMock._statMock.isDirectory.mockReturnValue(false);

        module.compileStats = stats;
        return BbPromise.each(['1.18.1', '2.17.0', '10.15.3'], version => {
          getVersionStub.mockReturnValue(version);
          return expect(module.packageModules())
            .resolves.toEqual([path.join('.webpack', 'test-service.zip')])
            .then(() => BbPromise.all([]));
        }).then(() =>
          BbPromise.each(['1.17.0', '1.16.0-alpha', '1.15.3'], version => {
            getVersionStub.mockReturnValue(version);
            return expect(module.packageModules())
              .resolves.toEqual([path.join('.webpack', 'test-service.zip')])
              .then(() => BbPromise.all([]));
          })
        );
      });

      it('should reject if no files are found', () => {
        // Test data
        const stats = {
          stats: [
            {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          ]
        };
        const files = [];
        const allFunctions = ['func1', 'func2'];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        getVersionStub.mockReturnValue('1.18.0');
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          }
        });
        // Mock behavior
        globMock.sync.mockReturnValue(files);
        fsMock._streamMock.on.mockImplementation((evt, cb) => {
          if (evt === 'open' || evt === 'close') {
            cb();
          }
        });
        fsMock._statMock.isDirectory.mockReturnValue(false);

        module.compileStats = stats;
        return expect(module.packageModules()).rejects.toThrow('Packaging: No files found');
      });

      it('should reject if no files are found because all files are excluded using regex', () => {
        module.configuration = new Configuration({
          webpack: {
            excludeRegex: '.*'
          }
        });

        // Test data
        const stats = {
          stats: [
            {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          ]
        };
        const files = ['README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map'];
        const allFunctions = ['func1', 'func2'];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        getVersionStub.mockReturnValue('1.18.0');
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          }
        });
        // Mock behavior
        globMock.sync.mockReturnValue(files);
        fsMock._streamMock.on.mockImplementation((evt, cb) => {
          if (evt === 'open' || evt === 'close') {
            cb();
          }
        });
        fsMock._statMock.isDirectory.mockReturnValue(false);

        module.compileStats = stats;
        return expect(module.packageModules()).rejects.toThrow('Packaging: No files found');
      });

      it('should reject only .md files without verbose log', () => {
        module.options.verbose = false;
        module.configuration = new Configuration({
          webpack: {
            excludeRegex: '.md$'
          }
        });

        // Test data
        const stats = {
          stats: [
            {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          ]
        };
        const files = ['README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map'];
        const allFunctions = ['func1', 'func2'];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        getVersionStub.mockReturnValue('1.18.0');
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          }
        });
        // Mock behavior
        globMock.sync.mockReturnValue(files);
        fsMock._streamMock.on.mockImplementation((evt, cb) => {
          if (evt === 'open' || evt === 'close') {
            cb();
          }
        });
        fsMock._statMock.isDirectory.mockReturnValue(false);

        module.compileStats = stats;
        return expect(module.packageModules()).resolves.toEqual([path.join('.webpack', 'test-service.zip')]);
      });
    });

    describe('with individual packaging', () => {
      // Test data
      const stats = {
        stats: [
          {
            outputPath: '/my/Service/Path/.webpack/func1'
          },
          {
            outputPath: '/my/Service/Path/.webpack/func2'
          }
        ]
      };
      const files = ['README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map'];
      const allFunctions = ['func1', 'func2'];
      const func1 = {
        handler: 'src/handler1',
        events: []
      };
      const func2 = {
        handler: 'src/handler2',
        events: []
      };
      const entryFunctions = [
        {
          handlerFile: 'src/handler1.js',
          funcName: 'func1',
          func: func1
        },
        {
          handlerFile: 'src/handler2.js',
          funcName: 'func2',
          func: func2
        }
      ];

      beforeEach(() => {
        // Setup sandbox and behavior for individual packaging
        _.set(module, 'entryFunctions', entryFunctions);
        _.set(serverless.service.package, 'individually', true);
      });

      it('should package', () => {
        // Serverless behavior
        getVersionStub.mockReturnValue('1.18.0');
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          }
        });
        // Mock behavior
        globMock.sync.mockReturnValue(files);
        fsMock._streamMock.on.mockImplementation((evt, cb) => {
          if (evt === 'open' || evt === 'close') {
            cb();
          }
        });
        fsMock._statMock.isDirectory.mockReturnValue(false);

        module.compileStats = stats;

        return expect(module.packageModules()).resolves.toEqual([
          path.join('.webpack', 'func1.zip'),
          path.join('.webpack', 'func2.zip')
        ]);
      });
    });
  });

  describe('copyExistingArtifacts()', () => {
    const allFunctions = ['func1', 'func2', 'funcPython'];
    const func1 = {
      handler: 'src/handler1',
      events: []
    };
    const func2 = {
      handler: 'src/handler2',
      events: [],
      runtime: 'node14'
    };

    const funcPython = {
      handler: 'src/handlerPython',
      events: [],
      runtime: 'python3.7'
    };

    const entryFunctions = [
      {
        handlerFile: 'src/handler1.js',
        funcName: 'func1',
        func: func1
      },
      {
        handlerFile: 'src/handler2.js',
        funcName: 'func2',
        func: func2
      },
      {
        handlerFile: 'src/handlerPython.js',
        funcName: 'funcPython',
        func: funcPython
      }
    ];

    describe('with service packaging', () => {
      beforeEach(() => {
        _.set(module, 'entryFunctions', entryFunctions);
        _.set(serverless.service.package, 'individually', false);
        getVersionStub.mockReturnValue('1.18.0');
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          } else if (name === 'funcPython') {
            return funcPython;
          }
        });
      });

      it('copies the artifact', () => {
        const expectedArtifactSource = path.join('.webpack', 'test-service.zip');
        const expectedArtifactDestination = path.join('.serverless', 'test-service.zip');

        return expect(module.copyExistingArtifacts())
          .resolves.toBeUndefined()
          .then(() =>
            BbPromise.all([
              // Should copy the artifact into .serverless
              expect(fsMock.copyFileSync).toHaveBeenCalledTimes(1),
              expect(fsMock.copyFileSync).toHaveBeenCalledWith(expectedArtifactSource, expectedArtifactDestination),

              // Should set package artifact for each function to the single artifact
              expect(func1).toHaveProperty('package.artifact', expectedArtifactDestination),
              expect(func2).toHaveProperty('package.artifact', expectedArtifactDestination)
            ])
          );
      });

      it('should set the function artifact depending on the serverless version', () => {
        // Test data
        const stats = {
          stats: [
            {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          ]
        };
        const files = ['README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map'];
        const allFunctions = ['func1', 'func2'];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          }
        });
        // Mock behavior
        globMock.sync.mockReturnValue(files);
        fsMock._streamMock.on.mockImplementation((evt, cb) => {
          if (evt === 'open' || evt === 'close') {
            cb();
          }
        });
        fsMock._statMock.isDirectory.mockReturnValue(false);

        const expectedArtifactPath = path.join('.serverless', 'test-service.zip');

        module.compileStats = stats;
        return BbPromise.each(['1.18.1', '2.17.0', '10.15.3'], version => {
          getVersionStub.mockReturnValue(version);
          return expect(module.copyExistingArtifacts())
            .resolves.toBeUndefined()
            .then(() =>
              BbPromise.all([
                expect(func1).toHaveProperty('package.artifact', expectedArtifactPath),
                expect(func2).toHaveProperty('package.artifact', expectedArtifactPath)
              ])
            );
        }).then(() =>
          BbPromise.each(['1.17.0', '1.16.0-alpha', '1.15.3'], version => {
            getVersionStub.mockReturnValue(version);
            return expect(module.copyExistingArtifacts())
              .resolves.toBeUndefined()
              .then(() =>
                BbPromise.all([
                  expect(func1).toHaveProperty('artifact', expectedArtifactPath),
                  expect(func2).toHaveProperty('artifact', expectedArtifactPath),
                  expect(func1).toHaveProperty('package.disable', true),
                  expect(func2).toHaveProperty('package.disable', true)
                ])
              );
          })
        );
      });

      describe('with the Google provider', () => {
        let oldProviderName;

        beforeEach(() => {
          oldProviderName = serverless.service.provider.name;
          // Imitate Google provider
          serverless.service.provider.name = 'google';
        });

        afterEach(() => {
          if (oldProviderName) {
            serverless.service.provider.name = oldProviderName;
          } else {
            _.unset(serverless.service.provider, 'name');
          }
        });

        it('should set the service artifact path', () => {
          // Test data
          const allFunctions = ['func1', 'func2'];
          const func1 = {
            handler: 'handler1',
            events: []
          };
          const func2 = {
            handler: 'handler2',
            events: []
          };
          getVersionStub.mockReturnValue('1.18.0');
          getServiceObjectStub.mockReturnValue({
            name: 'test-service'
          });
          getAllFunctionsStub.mockReturnValue(allFunctions);
          getFunctionStub.mockImplementation(name => {
            if (name === 'func1') {
              return func1;
            } else if (name === 'func2') {
              return func2;
            }
          });
          // Mock behavior
          // fsMock._streamMock.on.withArgs('open').yields();
          // fsMock._streamMock.on.withArgs('close').yields();
          // fsMock._statMock.isDirectory.returns(false);

          const expectedArtifactPath = path.join('.serverless', 'test-service.zip');

          return expect(module.copyExistingArtifacts())
            .resolves.toBeUndefined()
            .then(() => expect(serverless.service).toHaveProperty('package.artifact', expectedArtifactPath));
        });
      });
    });

    describe('with individual packaging', () => {
      beforeEach(() => {
        _.set(module, 'entryFunctions', entryFunctions);
        _.set(serverless.service.package, 'individually', true);
        getVersionStub.mockReturnValue('1.18.0');
        getServiceObjectStub.mockReturnValue({
          name: 'test-service'
        });
        getAllFunctionsStub.mockReturnValue(allFunctions);
        getFunctionStub.mockImplementation(name => {
          if (name === 'func1') {
            return func1;
          } else if (name === 'func2') {
            return func2;
          } else if (name === 'funcPython') {
            return funcPython;
          }
        });
      });

      it('copies each node artifact', () => {
        const expectedFunc1Destination = path.join('.serverless', 'func1.zip');
        const expectedFunc2Destination = path.join('.serverless', 'func2.zip');

        return expect(module.copyExistingArtifacts())
          .resolves.toBeUndefined()
          .then(() =>
            BbPromise.all([
              // Should copy an artifact per function into .serverless
              expect(fsMock.copyFileSync).toHaveBeenCalledTimes(2),
              expect(fsMock.copyFileSync).toHaveBeenCalledWith(
                path.join('.webpack', 'func1.zip'),
                expectedFunc1Destination
              ),
              expect(fsMock.copyFileSync).toHaveBeenCalledWith(
                path.join('.webpack', 'func2.zip'),
                expectedFunc2Destination
              ),

              // Should set package artifact locations
              expect(func1).toHaveProperty('package.artifact', expectedFunc1Destination),
              expect(func2).toHaveProperty('package.artifact', expectedFunc2Destination)
            ])
          );
      });

      it('copies only the artifact for function specified in options', () => {
        _.set(module, 'options.function', 'func1');
        const expectedFunc1Destination = path.join('.serverless', 'func1.zip');

        return expect(module.copyExistingArtifacts())
          .resolves.toBeUndefined()
          .then(() =>
            BbPromise.all([
              // Should copy an artifact per function into .serverless
              expect(fsMock.copyFileSync).toHaveBeenCalledTimes(1),
              expect(fsMock.copyFileSync).toHaveBeenCalledWith(
                path.join('.webpack', 'func1.zip'),
                expectedFunc1Destination
              ),

              // Should set package artifact locations
              expect(func1).toHaveProperty('package.artifact', expectedFunc1Destination)
            ])
          );
      });
    });
  });
});
