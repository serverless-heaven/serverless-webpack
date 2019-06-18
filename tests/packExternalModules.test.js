'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const Configuration = require('../lib/Configuration');

// Mocks
const fsExtraMockFactory = require('./mocks/fs-extra.mock');
const packageMock = require('./mocks/package.mock.json');
const packageLocalRefMock = require('./mocks/packageLocalRef.mock.json');
const packageIgnoredDevDepsMock = require('./mocks/packageIgnoredDevDeps.mock.json');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

class ChunkMock {
  constructor(modules) {
    this._modules = modules;
  }

  get modulesIterable() {
    return this._modules;
  }
}

class ChunkMockNoModulesIterable {
  constructor(modules) {
    this._modules = modules;
  }
}

const packagerMockFactory = {
  create(sandbox) {
    const packagerMock = {
      lockfileName: 'mocked-lock.json',
      copyPackageSectionNames: [ 'section1', 'section2' ],
      mustCopyModules: true,
      rebaseLockfile: sandbox.stub(),
      getProdDependencies: sandbox.stub(),
      install: sandbox.stub(),
      prune: sandbox.stub(),
      runScripts: sandbox.stub()
    };

    return packagerMock;
  }
};

describe('packExternalModules', () => {
  let sandbox;
  let baseModule;
  let serverless;
  let module;

  // Mocks
  let packagerFactoryMock;
  let packagerMock;
  let fsExtraMock;
  // Serverless stubs
  let writeFileSyncStub;
  let readFileSyncStub;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise.Promise);

    packagerMock = packagerMockFactory.create(sandbox);
    fsExtraMock = fsExtraMockFactory.create(sandbox);

    // Setup packager mocks
    packagerFactoryMock = {
      get: sinon.stub()
    };
    packagerFactoryMock.get.withArgs('npm').returns(packagerMock);
    packagerFactoryMock.get.throws(new Error('Packager not mocked'));

    mockery.enable({ useCleanCache: true, warnOnUnregistered: false });
    mockery.registerMock('fs-extra', fsExtraMock);
    mockery.registerMock('./packagers', packagerFactoryMock);
    mockery.registerMock(path.join(process.cwd(), 'package.json'), packageMock);
    baseModule = require('../lib/packExternalModules');
    Object.freeze(baseModule);
  });

  after(() => {
    mockery.disable();
    mockery.deregisterAll();
    sandbox.restore();
  });

  beforeEach(() => {
    serverless = new Serverless();
    serverless.cli = {
      log: sandbox.stub(),
      consoleLog: sandbox.stub()
    };
    _.set(serverless, 'service.service', 'test-service');

    writeFileSyncStub = sandbox.stub(serverless.utils, 'writeFileSync');
    readFileSyncStub = sandbox.stub(serverless.utils, 'readFileSync');
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
    // Reset all counters and restore all stubbed functions
    writeFileSyncStub.restore();
    readFileSyncStub.restore();
    fsExtraMock.pathExists.reset();
    fsExtraMock.copy.reset();
    sandbox.reset();
  });

  describe('packExternalModules()', () => {
    // Test data
    const stats = {
      stats: [
        {
          compilation: {
            chunks: [
              new ChunkMock([
                {
                  identifier: _.constant('"crypto"')
                },
                {
                  identifier: _.constant('"uuid/v4"')
                },
                {
                  identifier: _.constant('"mockery"')
                },
                {
                  identifier: _.constant('"@scoped/vendor/module1"')
                },
                {
                  identifier: _.constant('external "@scoped/vendor/module2"')
                },
                {
                  identifier: _.constant('external "uuid/v4"')
                },
                {
                  identifier: _.constant('external "bluebird"')
                }
              ]),
              new ChunkMockNoModulesIterable([])
            ],
            compiler: {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          }
        }
      ]
    };
    const noExtStats = {
      stats: [
        {
          compilation: {
            chunks: [
              new ChunkMock([
                {
                  identifier: _.constant('"crypto"')
                },
                {
                  identifier: _.constant('"uuid/v4"')
                },
                {
                  identifier: _.constant('"mockery"')
                },
                {
                  identifier: _.constant('"@scoped/vendor/module1"')
                }
              ])
            ],
            compiler: {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          }
        }
      ]
    };
    const statsWithFileRef = {
      stats: [
        {
          compilation: {
            chunks: [
              new ChunkMock([
                {
                  identifier: _.constant('"crypto"')
                },
                {
                  identifier: _.constant('"uuid/v4"')
                },
                {
                  identifier: _.constant('"mockery"')
                },
                {
                  identifier: _.constant('"@scoped/vendor/module1"')
                },
                {
                  identifier: _.constant('external "@scoped/vendor/module2"')
                },
                {
                  identifier: _.constant('external "uuid/v4"')
                },
                {
                  identifier: _.constant('external "localmodule"')
                },
                {
                  identifier: _.constant('external "bluebird"')
                }
              ])
            ],
            compiler: {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          }
        }
      ]
    };
    const statsWithDevDependency = {
      stats: [
        {
          compilation: {
            chunks: [
              new ChunkMock([
                {
                  identifier: _.constant('"crypto"')
                },
                {
                  identifier: _.constant('"uuid/v4"')
                },
                {
                  identifier: _.constant('external "eslint"')
                },
                {
                  identifier: _.constant('"mockery"')
                },
                {
                  identifier: _.constant('"@scoped/vendor/module1"')
                },
                {
                  identifier: _.constant('external "@scoped/vendor/module2"')
                },
                {
                  identifier: _.constant('external "uuid/v4"')
                },
                {
                  identifier: _.constant('external "localmodule"')
                },
                {
                  identifier: _.constant('external "bluebird"')
                }
              ])
            ],
            compiler: {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          }
        }
      ]
    };
    const statsWithIgnoredDevDependency = {
      stats: [
        {
          compilation: {
            chunks: [
              new ChunkMock([
                {
                  identifier: _.constant('"crypto"')
                },
                {
                  identifier: _.constant('"uuid/v4"')
                },
                {
                  identifier: _.constant('"mockery"')
                },
                {
                  identifier: _.constant('"@scoped/vendor/module1"')
                },
                {
                  identifier: _.constant('external "@scoped/vendor/module2"')
                },
                {
                  identifier: _.constant('external "uuid/v4"')
                },
                {
                  identifier: _.constant('external "localmodule"')
                },
                {
                  identifier: _.constant('external "bluebird"')
                },
                {
                  identifier: _.constant('external "aws-sdk"')
                }
              ])
            ],
            compiler: {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          }
        }
      ]
    };

    it('should do nothing if webpackIncludeModules is not set', () => {
      module.configuration = new Configuration();
      module.compileStats = { stats: [] };
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          expect(fsExtraMock.copy).to.not.have.been.called,
          expect(packagerFactoryMock.get).to.not.have.been.called,
          expect(writeFileSyncStub).to.not.have.been.called
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        },
        section1: originalPackageJSON.section1
      };

      module.webpackOutputPath = 'outputPath';
      readFileSyncStub.onFirstCall().returns(originalPackageJSON);
      readFileSyncStub.throws(new Error('Unexpected call to readFileSync'));
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledTwice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules should have been copied
          expect(fsExtraMock.copy).to.have.been.calledOnce,
          // npm ls and npm prune should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledTwice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules should have been copied
          expect(fsExtraMock.copy).to.have.been.calledOnce,
          // npm ls and npm prune should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
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
          uuid: '^5.4.1',
          localmodule: 'file:../../locals/../../mymodule',
          bluebird: '^3.4.0'
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
          uuid: '^5.4.1',
          localmodule: expectedLocalModule,
          bluebird: '^3.4.0'
        }
      };

      const fakePackageLockJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: {
            version: '^5.4.1'
          },
          bluebird: {
            version: '^3.4.0'
          },
          localmodule: {
            version: 'file:../../mymodule'
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
      module.webpackOutputPath = 'outputPath';
      readFileSyncStub.onFirstCall().returns(packageLocalRefMock);
      readFileSyncStub.returns(fakePackageLockJSON);
      fsExtraMock.pathExists.yields(null, true);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.rebaseLockfile.callsFake((pathToPackageRoot, lockfile) => lockfile);
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = statsWithFileRef;

      sandbox.stub(process, 'cwd').returns(path.join('/my/Service/Path'));
      mockery.registerMock(path.join(process.cwd(), 'locals', 'package.json'), packageLocalRefMock);

      return expect(module.packExternalModules())
        .to.be.fulfilled.then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).to.have.been.calledThrice,
            expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.thirdCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules and the lock file should have been copied
            expect(fsExtraMock.copy).to.have.been.calledTwice,
            // Lock file rebase should have been called
            expect(packagerMock.rebaseLockfile).to.have.been.calledOnce,
            expect(packagerMock.rebaseLockfile).to.have.been.calledWith(
              sinon.match.any,
              sinon.match(fakePackageLockJSON)
            ),
            // npm ls and npm prune should have been called
            expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
            expect(packagerMock.install).to.have.been.calledOnce,
            expect(packagerMock.prune).to.have.been.calledOnce,
            expect(packagerMock.runScripts).to.have.been.calledOnce
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      _.set(serverless, 'service.provider.name', 'google');
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledTwice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules should have been copied
          expect(fsExtraMock.copy).to.have.not.been.called,
          // npm ls and npm prune should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.not.have.been.called,
          expect(packagerMock.runScripts).to.not.have.been.called
        ])
      );
    });

    it('should reject if packager install fails', () => {
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.callsFake(() => BbPromise.reject(new Error('npm install failed')));
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .to.be.rejectedWith('npm install failed')
        .then(() =>
          BbPromise.all([
            // npm ls and npm install should have been called
            expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
            expect(packagerMock.install).to.have.been.calledOnce,
            expect(packagerMock.prune).to.not.have.been.called,
            expect(packagerMock.runScripts).to.not.have.been.called
          ])
        );
    });

    it('should reject if packager returns a critical error', () => {
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.callsFake(() => BbPromise.reject(new Error('something went wrong')));
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .to.be.rejectedWith('something went wrong')
        .then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).to.not.have.been.called,
            // The modules should have been copied
            expect(fsExtraMock.copy).to.not.have.been.called,
            // npm ls and npm prune should have been called
            expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
            expect(packagerMock.install).to.not.have.been.called,
            expect(packagerMock.prune).to.not.have.been.called,
            expect(packagerMock.runScripts).to.not.have.been.called
          ])
        );
    });

    it('should not install modules if no external modules are reported', () => {
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve());
      module.compileStats = noExtStats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.not.have.been.called,
          // The modules should have been copied
          expect(fsExtraMock.copy).to.not.have.been.called,
          // npm install and npm prune should not have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.not.have.been.called,
          expect(packagerMock.prune).to.not.have.been.called,
          expect(packagerMock.runScripts).to.not.have.been.called
        ])
      );
    });

    it('should report ignored packager problems in verbose mode', () => {
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(
        BbPromise.resolve({
          problems: [ 'Problem 1', 'Problem 2' ]
        })
      );
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() => {
        expect(packagerMock.getProdDependencies).to.have.been.calledOnce;
        expect(serverless.cli.log).to.have.been.calledWith('=> Problem 1');
        expect(serverless.cli.log).to.have.been.calledWith('=> Problem 2');
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
          uuid: '^5.4.1',
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0',
          pg: '^4.3.5'
        }
      };
      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            forceInclude: ['pg']
          }
        }
      });
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledTwice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules should have been copied
          expect(fsExtraMock.copy).to.have.been.calledOnce,
          // npm ls and npm prune should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0',
          'not-in-prod-deps': ''
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0',
          'not-in-prod-deps': ''
        }
      };
      module.configuration = new Configuration({
        webpack: {
          includeModules: {
            forceInclude: ['not-in-prod-deps']
          }
        }
      });
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledTwice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules should have been copied
          expect(fsExtraMock.copy).to.have.been.calledOnce,
          // npm ls and npm prune should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
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
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledTwice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules should have been copied
          expect(fsExtraMock.copy).to.have.been.calledOnce,
          // npm ls and npm prune should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
        ])
      );
    });

    it('should reject if devDependency is required at runtime', () => {
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = statsWithDevDependency;
      return expect(module.packExternalModules())
        .to.be.rejectedWith('Serverless-webpack dependency error: eslint.')
        .then(() =>
          BbPromise.all([
            expect(module.serverless.cli.log).to.have.been.calledWith(
              sinon.match(/ERROR: Runtime dependency 'eslint' found in devDependencies/)
            ),
            // npm ls and npm install should have been called
            expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
            expect(packagerMock.install).to.not.have.been.called,
            expect(packagerMock.prune).to.not.have.been.called,
            expect(packagerMock.runScripts).to.not.have.been.called
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
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = statsWithIgnoredDevDependency;
      mockery.registerMock(path.join(process.cwd(), 'ignoreDevDeps', 'package.json'), packageIgnoredDevDepsMock);
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          expect(module.serverless.cli.log).to.have.been.calledWith(
            sinon.match(/INFO: Runtime dependency 'aws-sdk' found in devDependencies/)
          ),
          // npm ls and npm install should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
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
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = statsWithDevDependency;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // npm ls and npm install should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, true);
      fsExtraMock.copy.yields();
      readFileSyncStub.onFirstCall().returns(packageMock);
      readFileSyncStub.returns({ info: 'lockfile' });
      packagerMock.rebaseLockfile.callsFake((pathToPackageRoot, lockfile) => lockfile);
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledThrice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify({ info: 'lockfile' }, null, 2)),
          expect(writeFileSyncStub.thirdCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules and the lock file should have been copied
          expect(fsExtraMock.copy).to.have.been.calledTwice,
          // npm ls and npm prune should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      readFileSyncStub.onFirstCall().returns(packageMock);
      readFileSyncStub.throws(new Error('Failed to read package-lock.json'));
      fsExtraMock.pathExists.yields(null, true);
      fsExtraMock.copy.onFirstCall().yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledTwice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules should have been copied
          expect(fsExtraMock.copy).to.have.been.calledOnce,
          // npm ls and npm prune should have been called
          expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
          expect(packagerMock.install).to.have.been.calledOnce,
          expect(packagerMock.prune).to.have.been.calledOnce,
          expect(packagerMock.runScripts).to.have.been.calledOnce
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
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
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.onFirstCall().yields();
      packagerMock.getProdDependencies.returns(BbPromise.resolve({}));
      packagerMock.install.returns(BbPromise.resolve());
      packagerMock.prune.returns(BbPromise.resolve());
      packagerMock.runScripts.returns(BbPromise.resolve());
      packagerMock.mustCopyModules = false;
      module.compileStats = stats;
      return expect(module.packExternalModules())
        .to.be.fulfilled.then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).to.have.been.calledTwice,
            expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should not have been copied
            expect(fsExtraMock.copy).to.not.have.been.called,
            // npm ls and npm prune should have been called
            expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
            expect(packagerMock.install).to.have.been.calledOnce,
            expect(packagerMock.prune).to.have.been.calledOnce,
            expect(packagerMock.runScripts).to.have.been.calledOnce
          ])
        )
        .finally(() => {
          packagerMock.mustCopyModules = true;
        });
    });

    describe('peer dependencies', () => {
      before(() => {
        const peerDepPackageJson = require('./data/package-peerdeps.json');
        mockery.deregisterMock(path.join(process.cwd(), 'package.json'));
        mockery.registerMock(path.join(process.cwd(), 'package.json'), peerDepPackageJson);
        // Mock request-promise package.json
        const rpPackageJson = require('./data/rp-package.json');
        const rpPackagePath = path.join(process.cwd(), 'node_modules', 'request-promise', 'package.json');
        mockery.registerMock(rpPackagePath, rpPackageJson);
      });

      after(() => {
        mockery.deregisterMock(path.join(process.cwd(), 'package.json'));
        mockery.registerMock(path.join(process.cwd(), 'package.json'), packageMock);
        const rpPackagePath = path.join(process.cwd(), 'node_modules', 'request-promise', 'package.json');
        mockery.deregisterMock(rpPackagePath);
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
        const peerDepStats = {
          stats: [
            {
              compilation: {
                chunks: [
                  new ChunkMock([
                    {
                      identifier: _.constant('"crypto"')
                    },
                    {
                      identifier: _.constant('"uuid/v4"')
                    },
                    {
                      identifier: _.constant('"mockery"')
                    },
                    {
                      identifier: _.constant('"@scoped/vendor/module1"')
                    },
                    {
                      identifier: _.constant('external "bluebird"')
                    },
                    {
                      identifier: _.constant('external "request-promise"')
                    }
                  ])
                ],
                compiler: {
                  outputPath: '/my/Service/Path/.webpack/service'
                }
              }
            }
          ]
        };

        module.webpackOutputPath = 'outputPath';
        fsExtraMock.pathExists.yields(null, false);
        fsExtraMock.copy.yields();
        packagerMock.getProdDependencies.returns(BbPromise.resolve(dependencyGraph));
        packagerMock.install.returns(BbPromise.resolve());
        packagerMock.prune.returns(BbPromise.resolve());
        packagerMock.runScripts.returns(BbPromise.resolve());
        module.compileStats = peerDepStats;
        return expect(module.packExternalModules()).to.be.fulfilled.then(() =>
          BbPromise.all([
            // The module package JSON and the composite one should have been stored
            expect(writeFileSyncStub).to.have.been.calledTwice,
            expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
            expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
            // The modules should have been copied
            expect(fsExtraMock.copy).to.have.been.calledOnce,
            // npm ls and npm prune should have been called
            expect(packagerMock.getProdDependencies).to.have.been.calledOnce,
            expect(packagerMock.install).to.have.been.calledOnce,
            expect(packagerMock.prune).to.have.been.calledOnce,
            expect(packagerMock.runScripts).to.have.been.calledOnce
          ])
        );
      });
    });
  });
});
