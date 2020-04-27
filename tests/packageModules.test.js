'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const chai = require('chai');
const path = require('path');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');

// Mocks
const fsMockFactory = require('./mocks/fs.mock');
const globMockFactory = require('./mocks/glob.mock');
const archiverMockFactory = require('./mocks/archiver.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('packageModules', () => {
  let sandbox;
  let baseModule;
  let serverless;
  let module;

  // Mocks
  let fsMock;
  let globMock;
  let archiverMock;
  // Serverless stubs
  let writeFileDirStub;
  let getAllFunctionsStub;
  let getFunctionStub;
  let getServiceObjectStub;
  let getVersionStub;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise);

    fsMock = fsMockFactory.create(sandbox);
    archiverMock = archiverMockFactory.create(sandbox);
    globMock = globMockFactory.create(sandbox);

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('archiver', archiverMock);
    mockery.registerMock('fs', fsMock);
    mockery.registerMock('glob', globMock);
    baseModule = require('../lib/packageModules');
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

    writeFileDirStub = sandbox.stub(serverless.utils, 'writeFileDir');
    getAllFunctionsStub = sandbox.stub(serverless.service, 'getAllFunctions');
    getFunctionStub = sandbox.stub(serverless.service, 'getFunction');
    getServiceObjectStub = sandbox.stub(serverless.service, 'getServiceObject');
    getVersionStub = sandbox.stub(serverless, 'getVersion');

    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );
  });

  afterEach(() => {
    // Reset all counters and restore all stubbed functions
    sandbox.reset();
    sandbox.restore();
  });

  describe('packageModules()', () => {
    it('should do nothing if no compile stats are available', () => {
      module.compileStats = { stats: [] };
      return expect(module.packageModules()).to.be.fulfilled.then(() =>
        BbPromise.all([
          expect(archiverMock.create).to.not.have.been.called,
          expect(writeFileDirStub).to.not.have.been.called,
          expect(fsMock.createWriteStream).to.not.have.been.called,
          expect(globMock.sync).to.not.have.been.called
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
              compilation: {
                compiler: {
                  outputPath: '/my/Service/Path/.webpack/service'
                }
              }
            }
          ]
        };
        const files = [ 'README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map' ];
        const allFunctions = [ 'func1', 'func2' ];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        sandbox.stub(serverless.config, 'servicePath').value('/my/Service/Path');
        getVersionStub.returns('1.18.0');
        getServiceObjectStub.returns({
          name: 'test-service'
        });
        getAllFunctionsStub.returns(allFunctions);
        getFunctionStub.withArgs('func1').returns(func1);
        getFunctionStub.withArgs('func2').returns(func2);
        // Mock behavior
        globMock.sync.returns(files);
        fsMock._streamMock.on.withArgs('open').yields();
        fsMock._streamMock.on.withArgs('close').yields();
        fsMock._statMock.isDirectory.returns(false);

        const expectedArtifactPath = path.join('.serverless', 'test-service.zip');

        module.compileStats = stats;
        return expect(module.packageModules()).to.be.fulfilled.then(() =>
          BbPromise.all([
            expect(func1)
              .to.have.a.nested.property('package.artifact')
              .that.equals(expectedArtifactPath),
            expect(func2)
              .to.have.a.nested.property('package.artifact')
              .that.equals(expectedArtifactPath)
          ])
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
          const stats = {
            stats: [
              {
                compilation: {
                  compiler: {
                    outputPath: '/my/Service/Path/.webpack/service'
                  }
                }
              }
            ]
          };
          const files = [ 'README.md', 'index.js' ];
          const allFunctions = [ 'func1', 'func2' ];
          const func1 = {
            handler: 'handler1',
            events: []
          };
          const func2 = {
            handler: 'handler2',
            events: []
          };
          sandbox.stub(serverless.config, 'servicePath').value('/my/Service/Path');
          getVersionStub.returns('1.18.0');
          getServiceObjectStub.returns({
            name: 'test-service'
          });
          getAllFunctionsStub.returns(allFunctions);
          getFunctionStub.withArgs('func1').returns(func1);
          getFunctionStub.withArgs('func2').returns(func2);
          // Mock behavior
          globMock.sync.returns(files);
          fsMock._streamMock.on.withArgs('open').yields();
          fsMock._streamMock.on.withArgs('close').yields();
          fsMock._statMock.isDirectory.returns(false);

          const expectedArtifactPath = path.join('.serverless', 'test-service.zip');

          module.compileStats = stats;
          return expect(module.packageModules()).to.be.fulfilled.then(() =>
            expect(serverless.service)
              .to.have.a.nested.property('package.artifact')
              .that.equals(expectedArtifactPath)
          );
        });
      });

      it('should set the function artifact depending on the serverless version', () => {
        // Test data
        const stats = {
          stats: [
            {
              compilation: {
                compiler: {
                  outputPath: '/my/Service/Path/.webpack/service'
                }
              }
            }
          ]
        };
        const files = [ 'README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map' ];
        const allFunctions = [ 'func1', 'func2' ];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        sandbox.stub(serverless.config, 'servicePath').value('/my/Service/Path');
        getServiceObjectStub.returns({
          name: 'test-service'
        });
        getAllFunctionsStub.returns(allFunctions);
        getFunctionStub.withArgs('func1').returns(func1);
        getFunctionStub.withArgs('func2').returns(func2);
        // Mock behavior
        globMock.sync.returns(files);
        fsMock._streamMock.on.withArgs('open').yields();
        fsMock._streamMock.on.withArgs('close').yields();
        fsMock._statMock.isDirectory.returns(false);

        const expectedArtifactPath = path.join('.serverless', 'test-service.zip');

        module.compileStats = stats;
        return BbPromise.each([ '1.18.1', '2.17.0', '10.15.3' ], version => {
          getVersionStub.returns(version);
          return expect(module.packageModules()).to.be.fulfilled.then(() =>
            BbPromise.all([
              expect(func1)
                .to.have.a.nested.property('package.artifact')
                .that.equals(expectedArtifactPath),
              expect(func2)
                .to.have.a.nested.property('package.artifact')
                .that.equals(expectedArtifactPath)
            ])
          );
        }).then(() =>
          BbPromise.each([ '1.17.0', '1.16.0-alpha', '1.15.3' ], version => {
            getVersionStub.returns(version);
            return expect(module.packageModules()).to.be.fulfilled.then(() =>
              BbPromise.all([
                expect(func1)
                  .to.have.a.nested.property('artifact')
                  .that.equals(expectedArtifactPath),
                expect(func2)
                  .to.have.a.nested.property('artifact')
                  .that.equals(expectedArtifactPath),
                expect(func1).to.have.a.nested.property('package.disable').that.is.true,
                expect(func2).to.have.a.nested.property('package.disable').that.is.true
              ])
            );
          })
        );
      });

      it('should reject if no files are found', () => {
        // Test data
        const stats = {
          stats: [
            {
              compilation: {
                compiler: {
                  outputPath: '/my/Service/Path/.webpack/service'
                }
              }
            }
          ]
        };
        const files = [];
        const allFunctions = [ 'func1', 'func2' ];
        const func1 = {
          handler: 'src/handler1',
          events: []
        };
        const func2 = {
          handler: 'src/handler2',
          events: []
        };
        // Serverless behavior
        sandbox.stub(serverless.config, 'servicePath').value('/my/Service/Path');
        getVersionStub.returns('1.18.0');
        getServiceObjectStub.returns({
          name: 'test-service'
        });
        getAllFunctionsStub.returns(allFunctions);
        getFunctionStub.withArgs('func1').returns(func1);
        getFunctionStub.withArgs('func2').returns(func2);
        // Mock behavior
        globMock.sync.returns(files);
        fsMock._streamMock.on.withArgs('open').yields();
        fsMock._streamMock.on.withArgs('close').yields();
        fsMock._statMock.isDirectory.returns(false);

        module.compileStats = stats;
        return expect(module.packageModules()).to.be.rejectedWith('Packaging: No files found');
      });
    });

    describe('with individual packaging', () => {
      // Test data
      const stats = {
        stats: [
          {
            compilation: {
              compiler: {
                outputPath: '/my/Service/Path/.webpack/func1'
              }
            }
          },
          {
            compilation: {
              compiler: {
                outputPath: '/my/Service/Path/.webpack/func2'
              }
            }
          }
        ]
      };
      const files = [ 'README.md', 'src/handler1.js', 'src/handler1.js.map', 'src/handler2.js', 'src/handler2.js.map' ];
      const allFunctions = [ 'func1', 'func2' ];
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
        sandbox.stub(serverless.config, 'servicePath').value('/my/Service/Path');
        getVersionStub.returns('1.18.0');
        getServiceObjectStub.returns({
          name: 'test-service'
        });
        getAllFunctionsStub.returns(allFunctions);
        getFunctionStub.withArgs('func1').returns(func1);
        getFunctionStub.withArgs('func2').returns(func2);
        // Mock behavior
        globMock.sync.returns(files);
        fsMock._streamMock.on.withArgs('open').yields();
        fsMock._streamMock.on.withArgs('close').yields();
        fsMock._statMock.isDirectory.returns(false);

        module.compileStats = stats;
        return expect(module.packageModules()).to.be.fulfilled.then(() =>
          BbPromise.all([
            expect(func1)
              .to.have.a.nested.property('package.artifact')
              .that.equals(path.join('.serverless', 'func1.zip')),
            expect(func2)
              .to.have.a.nested.property('package.artifact')
              .that.equals(path.join('.serverless', 'func2.zip'))
          ])
        );
      });
    });
  });
});
