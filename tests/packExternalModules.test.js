'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');

// Mocks
const childProcessMockFactory = require('./mocks/child_process.mock');
const fsExtraMockFactory = require('./mocks/fs-extra.mock');
const packageMock = require('./mocks/package.mock.json');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('packExternalModules', () => {
  let sandbox;
  let baseModule;
  let serverless;
  let module;

  // Mocks
  let childProcessMock;
  let fsExtraMock;
  // Serverless stubs
  let writeFileSyncStub;

  before(() => {
    sandbox = sinon.sandbox.create();
    sandbox.usingPromise(BbPromise);

    childProcessMock = childProcessMockFactory.create(sandbox);
    fsExtraMock = fsExtraMockFactory.create(sandbox);

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('child_process', childProcessMock);
    mockery.registerMock('fs-extra', fsExtraMock);
    mockery.registerMock(path.join(process.cwd(), 'package.json'), packageMock);
    baseModule = require('../lib/packExternalModules');
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
    _.set(serverless, 'service.service', 'test-service');

    writeFileSyncStub = sandbox.stub(serverless.utils, 'writeFileSync');
    _.set(serverless, 'service.custom.webpackIncludeModules', true);

    module = _.assign({
      serverless,
      options: {
        verbose: true
      },
    }, baseModule);
  });

  afterEach(() => {
    // Reset all counters and restore all stubbed functions
    writeFileSyncStub.reset();
    childProcessMock.exec.reset();
    fsExtraMock.pathExists.reset();
    fsExtraMock.copy.reset();
    sandbox.reset();
    sandbox.restore();
  });

  describe('packExternalModules()', () => {
    // Test data
    const stats = {
      stats: [
        {
          compilation: {
            chunks: [
              {
                modules: [
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
                    identifier: _.constant('external "bluebird"')
                  },
                ]
              }
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
              {
                modules: [
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
                ]
              }
            ],
            compiler: {
              outputPath: '/my/Service/Path/.webpack/service'
            }
          }
        }
      ]
    };

    it('should do nothing if webpackIncludeModules is not set', () => {
      _.unset(serverless, 'service.custom.webpackIncludeModules');
      module.compileStats = { stats: [] };
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        expect(fsExtraMock.copy).to.not.have.been.called,
        expect(childProcessMock.exec).to.not.have.been.called,
        expect(writeFileSyncStub).to.not.have.been.called,
      ]));
    });

    it('should install external modules', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };
      const expectedPackageJSON = {
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      childProcessMock.exec.onFirstCall().yields(null, '{}', '');
      childProcessMock.exec.onSecondCall().yields(null, '', '');
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.copy).to.have.been.calledOnce,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledThrice,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
        expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
          'npm install'
        ),
        expect(childProcessMock.exec.thirdCall).to.have.been.calledWith(
          'npm prune'
        )
      ]));
    });

    it('should skip module copy for Google provider', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };
      const expectedPackageJSON = {
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
      childProcessMock.exec.onFirstCall().yields(null, '{}', '');
      childProcessMock.exec.onSecondCall().yields(null, '', '');
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.copy).to.have.not.been.called,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledTwice,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
        expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
          'npm install'
        )
      ]));
    });

    it('should reject if npm install fails', () => {
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      childProcessMock.exec.onFirstCall().yields(null, '{}', '');
      childProcessMock.exec.onSecondCall().yields(new Error('npm install failed'));
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.rejectedWith('npm install failed')
      .then(() => BbPromise.all([
        // npm ls and npm install should have been called
        expect(childProcessMock.exec).to.have.been.calledTwice,
      ]));
    });

    it('should reject if npm returns a critical error', () => {
      const stderr = 'ENOENT: No such file';
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      childProcessMock.exec.yields(new Error('something went wrong'), '{}', stderr);
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.rejectedWith('something went wrong')
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.not.have.been.called,
        // The modules should have been copied
        expect(fsExtraMock.copy).to.not.have.been.called,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledOnce,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
      ]));
    });

    it('should reject if npm returns critical and minor errors', () => {
      const stderr = 'ENOENT: No such file\nnpm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon\n\n';
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      childProcessMock.exec.yields(new Error('something went wrong'), '{}', stderr);
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.rejectedWith('something went wrong')
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.not.have.been.called,
        // The modules should have been copied
        expect(fsExtraMock.copy).to.not.have.been.called,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledOnce,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
      ]));
    });

    it('should ignore minor local NPM errors and log them', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };
      const expectedPackageJSON = {
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };
      const stderr = _.join(
        [
          'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
          'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
          'npm ERR! peer dep missing: sinon@2.3.8',
        ],
        '\n'
      );
      const lsResult = {
        version: '1.0.0',
        problems: [
          'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
          'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
          'npm ERR! peer dep missing: sinon@2.3.8',
        ],
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      childProcessMock.exec.onFirstCall().yields(new Error('NPM error'), JSON.stringify(lsResult), stderr);
      childProcessMock.exec.onSecondCall().yields(null, '', '');
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.pathExists).to.have.been.calledOnce,
        expect(fsExtraMock.copy).to.have.been.calledOnce,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledThrice,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
        expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
          'npm install'
        ),
        expect(childProcessMock.exec.thirdCall).to.have.been.calledWith(
          'npm prune'
        )
      ]));
    });

    it('should not install modules if no external modules are reported', () => {
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.copy.yields();
      childProcessMock.exec.yields(null, '{}', '');
      module.compileStats = noExtStats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.not.have.been.called,
        // The modules should have been copied
        expect(fsExtraMock.copy).to.not.have.been.called,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledOnce,
      ]));
    });

    it('should install external modules when forced', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0',
          pg: '^4.3.5'
        }
      };
      const expectedPackageJSON = {
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0',
          pg: '^4.3.5'
        }
      };
      serverless.service.custom = {
        webpackIncludeModules: {
          forceInclude: ['pg']
        }
      };
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      childProcessMock.exec.onFirstCall().yields(null, '{}', '');
      childProcessMock.exec.onSecondCall().yields(null, '', '');
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.copy).to.have.been.calledOnce,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledThrice,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
        expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
          'npm install'
        ),
        expect(childProcessMock.exec.thirdCall).to.have.been.calledWith(
          'npm prune'
        )
      ]));
    });

    it('should add forced external modules without version when not in production dependencies', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0',
          'not-in-prod-deps': ''
        }
      };
      const expectedPackageJSON = {
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0',
          'not-in-prod-deps': ''
        }
      };
      serverless.service.custom = {
        webpackIncludeModules: {
          forceInclude: ['not-in-prod-deps']
        }
      };
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      childProcessMock.exec.onFirstCall().yields(null, '{}', '');
      childProcessMock.exec.onSecondCall().yields(null, '', '');
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.copy).to.have.been.calledOnce,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledThrice,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
        expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
          'npm install'
        ),
        expect(childProcessMock.exec.thirdCall).to.have.been.calledWith(
          'npm prune'
        )
      ]));
    });

    it('should exclude external modules when forced', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          pg: '^4.3.5'
        }
      };
      const expectedPackageJSON = {
        dependencies: {
          '@scoped/vendor': '1.0.0',
          bluebird: '^3.4.0',
          pg: '^4.3.5'
        }
      };
      serverless.service.custom = {
        webpackIncludeModules: {
          forceInclude: ['pg'],
          forceExclude: ['uuid']
        }
      };
      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, false);
      fsExtraMock.copy.yields();
      childProcessMock.exec.onFirstCall().yields(null, '{}', '');
      childProcessMock.exec.onSecondCall().yields(null, '', '');
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.copy).to.have.been.calledOnce,
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledThrice,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
        expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
          'npm install'
        ),
        expect(childProcessMock.exec.thirdCall).to.have.been.calledWith(
          'npm prune'
        )
      ]));
    });

    it('should read package-lock if found', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };
      const expectedPackageJSON = {
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, true);
      fsExtraMock.copy.yields();
      childProcessMock.exec.onFirstCall().yields(null, '{}', '');
      childProcessMock.exec.onSecondCall().yields(null, '', '');
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.copy).to.have.been.calledTwice,
        expect(fsExtraMock.copy.firstCall).to.have.been.calledWith(
          sinon.match(/package-lock.json$/)
        ),
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledThrice,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
        expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
          'npm install'
        ),
        expect(childProcessMock.exec.thirdCall).to.have.been.calledWith(
          'npm prune'
        )
      ]));
    });

    it('should continue if package-lock cannot be read', () => {
      const expectedCompositePackageJSON = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Packaged externals for test-service',
        private: true,
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };
      const expectedPackageJSON = {
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      fsExtraMock.pathExists.yields(null, true);
      fsExtraMock.copy.onFirstCall().yields(new Error('Failed to read package-lock.json'));
      fsExtraMock.copy.onSecondCall().yields();
      childProcessMock.exec.onFirstCall().yields(null, '{}', '');
      childProcessMock.exec.onSecondCall().yields(null, '', '');
      childProcessMock.exec.onThirdCall().yields();
      module.compileStats = stats;
      return expect(module.packExternalModules()).to.be.fulfilled
      .then(() => BbPromise.all([
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.copy).to.have.been.calledTwice,
        expect(fsExtraMock.copy.firstCall).to.have.been.calledWith(
          sinon.match(/package-lock.json$/)
        ),
        // npm ls and npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledThrice,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        ),
        expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
          'npm install'
        ),
        expect(childProcessMock.exec.thirdCall).to.have.been.calledWith(
          'npm prune'
        )
      ]));
    });

    describe('peer dependencies', () => {
      before(() => {
        const peerDepPackageJson = require('./data/package-peerdeps.json');
        mockery.deregisterMock(path.join(process.cwd(), 'package.json'));
        mockery.registerMock(path.join(process.cwd(), 'package.json'), peerDepPackageJson);
        // Mock request-promise package.json
        const rpPackageJson = require('./data/rp-package.json');
        const rpPackagePath = path.join(
          process.cwd(),
          'node_modules',
          'request-promise',
          'package.json'
        );
        mockery.registerMock(rpPackagePath, rpPackageJson);
      });

      after(() => {
        mockery.deregisterMock(path.join(process.cwd(), 'package.json'));
        mockery.registerMock(path.join(process.cwd(), 'package.json'), packageMock);
        const rpPackagePath = path.join(
          process.cwd(),
          'node_modules',
          'request-promise',
          'package.json'
        );
        mockery.deregisterMock(rpPackagePath);
      });

      it('should install external peer dependencies', () => {
        const expectedCompositePackageJSON = {
          name: 'test-service',
          version: '1.0.0',
          description: 'Packaged externals for test-service',
          private: true,
          dependencies: {
            bluebird: '^3.5.0',
            'request-promise': '^4.2.1',
            request: '^2.82.0'
          }
        };
        const expectedPackageJSON = {
          dependencies: {
            bluebird: '^3.5.0',
            'request-promise': '^4.2.1',
            request: '^2.82.0'
          }
        };

        const dependencyGraph = require('./data/npm-ls-peerdeps.json');
        const peerDepStats = require('./data/stats-peerdeps.js');

        module.webpackOutputPath = 'outputPath';
        fsExtraMock.pathExists.yields(null, false);
        fsExtraMock.copy.yields();
        childProcessMock.exec.onFirstCall().yields(null, JSON.stringify(dependencyGraph), '');
        childProcessMock.exec.onSecondCall().yields(null, '', '');
        childProcessMock.exec.onThirdCall().yields();
        module.compileStats = peerDepStats;
        return expect(module.packExternalModules()).to.be.fulfilled
        .then(() => BbPromise.all([
          // The module package JSON and the composite one should have been stored
          expect(writeFileSyncStub).to.have.been.calledTwice,
          expect(writeFileSyncStub.firstCall.args[1]).to.equal(JSON.stringify(expectedCompositePackageJSON, null, 2)),
          expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
          // The modules should have been copied
          expect(fsExtraMock.copy).to.have.been.calledOnce,
          // npm ls and npm prune should have been called
          expect(childProcessMock.exec).to.have.been.calledThrice,
          expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
            'npm ls -prod -json -depth=1'
          ),
          expect(childProcessMock.exec.secondCall).to.have.been.calledWith(
            'npm install'
          ),
          expect(childProcessMock.exec.thirdCall).to.have.been.calledWith(
            'npm prune'
          )
        ]));
      });
    });
  });
});
