'use strict';

const BbPromise = require('bluebird');
const sinon = require('sinon');
const _ = require('lodash');
const path = require('path');
const Serverless = require('serverless');
const Configuration = require('../lib/Configuration');

// Mocks
const fsExtraMock = require('fs-extra');
const packageMock = require('./mocks/package.mock.json');
const packageLocalRefMock = require('./mocks/packageLocalRef.mock.json');
const baseModule = require('../lib/packExternalModules');
const packagerFactoryMock = require('../lib/packagers/index');

jest.mock('fs-extra');
jest.mock('../lib/packagers/index', () => {
  const packagerMock = {
    lockfileName: 'mocked-lock.json',
    copyPackageSectionNames: ['section1', 'section2'],
    mustCopyModules: true,
    rebaseLockfile: jest.fn(),
    getProdDependencies: jest.fn(),
    install: jest.fn(),
    prune: jest.fn(),
    runScripts: jest.fn()
  };
  const get = jest.fn().mockImplementation(name => {
    if (name === 'npm') {
      return packagerMock;
    }

    throw new Error('Packager not mocked');
  });

  return {
    get
  };
});
jest.mock('../package.json', () => {
  return jest.requireActual('./mocks/package.mock.json');
});

const createStatsMock = modules => ({
  stats: [
    {
      outputPath: '/my/Service/Path/.webpack/service',
      externalModules: _.map(modules, m => ({
        external: m
      }))
    }
  ]
});

describe('packExternalModules', () => {
  let serverless;
  let module;
  let sandbox;

  // Serverless stubs
  let writeFileSyncStub;
  let readFileSyncStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn(),
      consoleLog: jest.fn()
    };
    _.set(serverless, 'service.service', 'test-service');

    writeFileSyncStub = jest.fn();
    serverless.utils.writeFileSync = writeFileSyncStub;
    readFileSyncStub = jest.fn();
    serverless.utils.readFileSync = readFileSyncStub;
    _.set(serverless, 'service.custom.webpackIncludeModules', true);

    module = _.assign(
      {
        serverless,
        options: {
          verbose: true
        },
        configuration: new Configuration({
          webpack: {
            includeModules: true
          }
        })
      },
      baseModule
    );
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('packExternalModules()', () => {
    // Test data
    const stats = createStatsMock(['@scoped/vendor', 'uuid', 'bluebird']);
    const noExtStats = {
      stats: [
        {
          externalModules: []
        }
      ]
    };
    const statsWithFileRef = createStatsMock(['@scoped/vendor', 'uuid', 'localmodule', 'bluebird']);
    const statsWithDevDependency = createStatsMock(['eslint', '@scoped/vendor', 'uuid', 'localmodule', 'bluebird']);
    const statsWithIgnoredDevDependency = createStatsMock([
      '@scoped/vendor',
      'uuid',
      'localmodule',
      'bluebird',
      'aws-sdk'
    ]);

    it('should do nothing if webpackIncludeModules is not set', () => {
      module.configuration = new Configuration();
      module.compileStats = { stats: [] };
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get).toHaveBeenCalledTimes(0),
            expect(writeFileSyncStub).toHaveBeenCalledTimes(0)
          ])
        );
    });

    it('should do nothing if skipCompile is true', () => {
      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            packagePath: path.join('locals', 'package.json')
          }
        }
      });
      module.skipCompile = true;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get).toHaveBeenCalledTimes(0),
            expect(writeFileSyncStub).toHaveBeenCalledTimes(0)
          ])
        );
    });

    it('should copy needed package sections if available', () => {
      const originalPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        section1: {
          value: 'myValue'
        },
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        section1: originalPackageJSON.section1,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        },
        section1: originalPackageJSON.section1
      };

      module.webpackOutputPath = '/my/Service/Path/outputPath';
      readFileSyncStub.mockReturnValueOnce(originalPackageJSON);
      readFileSyncStub.mockImplementation(() => {
        throw new Error('Unexpected call to readFileSync');
      });
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should install external modules', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };

      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should rebase file references', () => {
      const expectedLocalModule = 'file:../../locals/../../mymodule';
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          localmodule: 'file:../../locals/../../mymodule',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          localmodule: expectedLocalModule,
          uuid: '^5.4.1'
        }
      };

      const fakePackageLockJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: {
            version: '^3.4.0'
          },
          localmodule: {
            version: 'file:../../mymodule'
          },
          uuid: {
            version: '^5.4.1'
          }
        }
      };

      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            packagePath: path.join('locals', 'package.json')
          }
        }
      });
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      readFileSyncStub.mockReturnValueOnce(packageLocalRefMock);
      readFileSyncStub.mockReturnValue(fakePackageLockJSON);
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, true));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').rebaseLockfile.mockImplementation((pathToPackageRoot, lockfile) => lockfile);
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = statsWithFileRef;

      sandbox.stub(process, 'cwd').returns('/my/Service/Path');
      jest.doMock(
        '/my/Service/Path/locals/package.json',
        () => jest.requireActual('./mocks/packageLocalRef.mock.json'),
        { virtual: true }
      );

      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(3),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[2][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules and the lock file should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(2),
            // Lock file rebase should have been called
            expect(packagerFactoryMock.get('npm').rebaseLockfile).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').rebaseLockfile).toHaveBeenCalledWith(
              '../../locals',
              fakePackageLockJSON
            ),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        )
        .finally(() => {
          process.cwd.restore();
        });
    });

    it('should skip module copy for Google provider', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };

      _.set(serverless, 'service.provider.name', 'google');
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(0),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(0)
          ])
        );
    });

    it('should reject if packager install fails', () => {
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock
        .get('npm')
        .install.mockImplementation(() => BbPromise.reject(new Error('npm install failed')));
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .rejects.toThrow('npm install failed')
        .then(() =>
          BbPromise.all([
            // npm ls and npm install should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(0)
          ])
        );
    });

    it('should reject if packager returns a critical error', () => {
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock
        .get('npm')
        .getProdDependencies.mockImplementation(() => BbPromise.reject(new Error('something went wrong')));
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .rejects.toThrow('something went wrong')
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(0),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(0),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(0)
          ])
        );
    });

    it('should not install modules if no external modules are reported', () => {
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve());
      module.compileStats = noExtStats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(0),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(0),
            // npm install and npm prune should not have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(0)
          ])
        );
    });

    it('should report ignored packager problems in verbose mode', () => {
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(
        BbPromise.resolve({
          problems: ['Problem 1', 'Problem 2']
        })
      );
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() => {
          expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1);
          expect(serverless.cli.log).toHaveBeenCalledWith('=> Problem 1');
          expect(serverless.cli.log).toHaveBeenCalledWith('=> Problem 2');
          return null;
        });
    });

    it('should install external modules when forced', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          pg: '^4.3.5',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          pg: '^4.3.5',
          uuid: '^5.4.1'
        }
      };
      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            forceInclude: ['pg']
          }
        }
      });
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should add forced external modules without version when not in production dependencies', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          'not-in-prod-deps': '',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          'not-in-prod-deps': '',
          uuid: '^5.4.1'
        }
      };
      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            forceInclude: ['not-in-prod-deps']
          }
        }
      });
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should exclude external modules when forced', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          pg: '^4.3.5'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          pg: '^4.3.5'
        }
      };
      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            forceInclude: ['pg'],
            forceExclude: ['uuid']
          }
        }
      });
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should reject if devDependency is required at runtime', () => {
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = statsWithDevDependency;
      return expect(module.packExternalModules())
        .rejects.toThrow('Serverless-webpack dependency error: eslint.')
        .then(() =>
          BbPromise.all([
            expect(module.serverless.cli.log).toHaveBeenCalledWith(
              expect.stringMatching(/ERROR: Runtime dependency 'eslint' found in devDependencies/)
            ),
            // npm ls and npm install should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(0),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(0)
          ])
        );
    });

    it('should ignore aws-sdk if set only in devDependencies', () => {
      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            packagePath: path.join('ignoreDevDeps', 'package.json')
          }
        }
      });
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = statsWithIgnoredDevDependency;
      jest.doMock(
        '../ignoreDevDeps/package.json',
        () => jest.requireActual('./mocks/packageIgnoredDevDeps.mock.json'),
        { virtual: true }
      );
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            expect(module.serverless.cli.log).toHaveBeenCalledWith(
              expect.stringMatching(/INFO: Runtime dependency 'aws-sdk' found in devDependencies/)
            ),
            // npm ls and npm install should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should succeed if devDependency is required at runtime but forcefully excluded', () => {
      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            forceExclude: ['eslint']
          }
        }
      });
      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = statsWithDevDependency;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // npm ls and npm install should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should read package-lock if found', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };

      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, true));
      fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
      readFileSyncStub.mockReturnValueOnce(packageMock);
      readFileSyncStub.mockReturnValue({ info: 'lockfile' });
      packagerFactoryMock.get('npm').rebaseLockfile.mockImplementation((pathToPackageRoot, lockfile) => lockfile);
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(3),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify({ info: 'lockfile' }, null, 2)),
            expect(writeFileSyncStub.mock.calls[2][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules and the lock file should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(2),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should continue if package-lock cannot be read', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };

      module.webpackOutputPath = '/my/Service/Path/outputPath';
      readFileSyncStub.mockReturnValueOnce(packageMock);
      readFileSyncStub.mockImplementation(() => {
        throw new Error('Failed to read package-lock.json');
      });
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, true));
      fsExtraMock.copy.mockImplementationOnce((from, to, cb) => cb());
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        );
    });

    it('should skip module copy if demanded by packager', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };
      const expectedPackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        scripts: {},
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          uuid: '^5.4.1'
        }
      };

      module.webpackOutputPath = '/my/Service/Path/outputPath';
      fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
      fsExtraMock.copy.mockImplementationOnce((from, to, cb) => {
        cb();
      });
      packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve({}));
      packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
      packagerFactoryMock.get('npm').mustCopyModules = false;
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
            expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should not have been copied
            expect(fsExtraMock.copy).toHaveBeenCalledTimes(0),
            // npm ls and npm prune should have been called
            expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
            expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
          ])
        )
        .finally(() => {
          packagerFactoryMock.get('npm').mustCopyModules = true;
        });
    });

    describe('peer dependencies', () => {
      /**
       * Both "default" & "optinal" behaviors are mostly equal.
       * The only difference between each scenario is they don't use the same package.json as mock
       */
      describe('default behavior', () => {
        beforeAll(() => {
          jest.resetModules();
          jest.doMock('../package.json', () => jest.requireActual('./data/package-peerdeps.json'));
          // Mock request-promise package.json
          jest.doMock(
            '../node_modules/request-promise/package.json',
            () => jest.requireActual('./data/rp-package.json'),
            { virtual: true }
          );
        });

        it('should install external peer dependencies', () => {
          const expectedCompositePackageJSON = {
            name: 'test-service',
            version: '1.0.0',
            description: 'Packaged externals for test-service',
            private: true,
            scripts: {},
            dependencies: {
              bluebird: '^3.5.0',
              'request-promise': '^4.2.1',
              request: '^2.82.0'
            }
          };
          const expectedPackageJSON = {
            name: 'test-service',
            version: '1.0.0',
            description: 'Packaged externals for test-service',
            private: true,
            scripts: {},
            dependencies: {
              bluebird: '^3.5.0',
              'request-promise': '^4.2.1',
              request: '^2.82.0'
            }
          };

          const dependencyGraph = require('./data/npm-ls-peerdeps.json');
          const peerDepStats = createStatsMock(['bluebird', 'request-promise']);

          module.webpackOutputPath = '/my/Service/Path/outputPath';
          fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
          fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
          packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve(dependencyGraph));
          packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
          packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
          packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
          module.compileStats = peerDepStats;
          return expect(module.packExternalModules())
            .resolves.toBeUndefined()
            .then(() =>
              BbPromise.all([
                // The module package JSON and the composite one should have been stored
                expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
                expect(writeFileSyncStub.mock.calls[0][1]).toEqual(
                  JSON.stringify(expectedCompositePackageJSON, null, 2)
                ),
                expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
                // The modules should have been copied
                expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
                // npm ls and npm prune should have been called
                expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
                expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
                expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
                expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
              ])
            );
        });
      });

      describe('optional behavior', () => {
        const expectedCompositePackageJSON = {
          name: 'test-service',
          version: '1.0.0',
          description: 'Packaged externals for test-service',
          private: true,
          scripts: {},
          dependencies: {
            bluebird: '^3.5.0',
            'request-promise': '^4.2.1',
            request: '^2.82.0'
          }
        };
        const expectedPackageJSON = {
          name: 'test-service',
          version: '1.0.0',
          description: 'Packaged externals for test-service',
          private: true,
          scripts: {},
          dependencies: {
            bluebird: '^3.5.0',
            'request-promise': '^4.2.1',
            request: '^2.82.0'
          }
        };

        const dependencyGraph = require('./data/npm-ls-peerdeps.json');
        const peerDepStats = createStatsMock(['bluebird', 'request-promise']);

        describe('without nodeModulesRelativeDir', () => {
          beforeAll(() => {
            jest.resetModules();
            jest.doMock('../package.json', () => jest.requireActual('./data/package-peerdeps.json'));
            // Mock request-promise package.json
            jest.doMock(
              '../node_modules/request-promise/package.json',
              () => jest.requireActual('./data/rp-package-optional.json'),
              { virtual: true }
            );
          });

          it('should skip optional peer dependencies', () => {
            module.webpackOutputPath = '/my/Service/Path/outputPath';
            fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
            fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
            packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve(dependencyGraph));
            packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
            packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
            packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
            module.compileStats = peerDepStats;
            return expect(module.packExternalModules())
              .resolves.toBeUndefined()
              .then(() =>
                BbPromise.all([
                  // The module package JSON and the composite one should have been stored
                  expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
                  expect(writeFileSyncStub.mock.calls[0][1]).toEqual(
                    JSON.stringify(expectedCompositePackageJSON, null, 2)
                  ),
                  expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
                  // The modules should have been copied
                  expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
                  // npm ls and npm prune should have been called
                  expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
                  expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
                  expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
                  expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
                ])
              );
          });
        });

        describe('with nodeModulesRelativeDir', () => {
          beforeEach(() => {
            jest.resetModules();
            jest.doMock(
              path.join(process.cwd(), 'package.json'),
              () => jest.requireActual('./data/package-peerdeps.json'),
              { virtual: true }
            );
            // Mock request-promise package.json
            const rpPackagePath = path.join(process.cwd(), '../../', 'node_modules', 'request-promise', 'package.json');
            jest.doMock(rpPackagePath, () => jest.requireActual('./data/rp-package-optional.json'), { virtual: true });
          });

          it('should skip optional peer dependencies', () => {
            module.configuration = new Configuration({
              webpack: {
                includeModules: {
                  nodeModulesRelativeDir: '../../'
                }
              }
            });
            module.webpackOutputPath = '/my/Service/Path/outputPath';
            fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
            fsExtraMock.pathExistsSync.mockReturnValue(true);
            fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
            packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve(dependencyGraph));
            packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
            packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
            packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
            module.compileStats = peerDepStats;
            return expect(module.packExternalModules())
              .resolves.toBeUndefined()
              .then(() =>
                BbPromise.all([
                  // The module package JSON and the composite one should have been stored
                  expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
                  expect(writeFileSyncStub.mock.calls[0][1]).toEqual(
                    JSON.stringify(expectedCompositePackageJSON, null, 2)
                  ),
                  expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
                  // The modules should have been copied
                  expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
                  // npm ls and npm prune should have been called
                  expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
                  expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
                  expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
                  expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
                ])
              );
          });
        });
      });
    });

    describe('transitive dependencies', () => {
      beforeAll(() => {
        jest.resetModules();
        jest.doMock(path.join(process.cwd(), 'package.json'), () =>
          jest.requireActual('./data/package-transitive.json')
        );
      });

      it('should install transitive dependencies', () => {
        const expectedCompositePackageJSON = {
          name: 'test-service',
          version: '1.0.0',
          description: 'Packaged externals for test-service',
          private: true,
          scripts: {},
          dependencies: {
            classnames: '2.2.6'
          }
        };
        const expectedPackageJSON = {
          name: 'test-service',
          version: '1.0.0',
          description: 'Packaged externals for test-service',
          private: true,
          scripts: {},
          dependencies: {
            classnames: '2.2.6'
          }
        };

        const dependencyGraph = {
          problems: [],
          dependencies: {
            'comp-b': { version: '1.0.0', dependencies: {} },
            'comp-c': { version: '1.0.0', dependencies: {} },
            classnames: { version: '2.2.6', dependencies: {} }
          }
        };

        const transitiveDepStats = createStatsMock(['classnames']);

        module.webpackOutputPath = '/my/Service/Path/outputPath';
        fsExtraMock.pathExists.mockImplementation((p, cb) => cb(null, false));
        fsExtraMock.copy.mockImplementation((from, to, cb) => cb());
        packagerFactoryMock.get('npm').getProdDependencies.mockReturnValue(BbPromise.resolve(dependencyGraph));
        packagerFactoryMock.get('npm').install.mockReturnValue(BbPromise.resolve());
        packagerFactoryMock.get('npm').prune.mockReturnValue(BbPromise.resolve());
        packagerFactoryMock.get('npm').runScripts.mockReturnValue(BbPromise.resolve());
        module.compileStats = transitiveDepStats;
        return expect(module.packExternalModules())
          .resolves.toBeUndefined()
          .then(() =>
            BbPromise.all([
              // The module package JSON and the composite one should have been stored
              expect(writeFileSyncStub).toHaveBeenCalledTimes(2),
              expect(writeFileSyncStub.mock.calls[0][1]).toEqual(JSON.stringify(expectedCompositePackageJSON, null, 2)),
              expect(writeFileSyncStub.mock.calls[1][1]).toEqual(JSON.stringify(expectedPackageJSON, null, 2)),
              // The modules should have been copied
              expect(fsExtraMock.copy).toHaveBeenCalledTimes(1),
              // npm ls and npm prune should have been called
              expect(packagerFactoryMock.get('npm').getProdDependencies).toHaveBeenCalledTimes(1),
              expect(packagerFactoryMock.get('npm').install).toHaveBeenCalledTimes(1),
              expect(packagerFactoryMock.get('npm').prune).toHaveBeenCalledTimes(1),
              expect(packagerFactoryMock.get('npm').runScripts).toHaveBeenCalledTimes(1)
            ])
          );
      });
    });
  });
});
