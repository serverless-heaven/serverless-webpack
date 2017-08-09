'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');

// Mocks
const npmMockFactory = require('./mocks/npm-programmatic.mock');
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
  let npmMock;
  let childProcessMock;
  let fsExtraMock;
  // Serverless stubs
  let writeFileSyncStub;

  before(() => {
    sandbox = sinon.sandbox.create();
    sandbox.usingPromise(BbPromise);

    npmMock = npmMockFactory.create(sandbox);
    childProcessMock = childProcessMockFactory.create(sandbox);
    fsExtraMock = fsExtraMockFactory.create(sandbox);

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('npm-programmatic', npmMock);
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

    writeFileSyncStub = sandbox.stub(serverless.utils, 'writeFileSync');
    _.set(serverless, 'service.custom.webpackIncludeModules', true);

    module = _.assign({
      serverless,
      options: {},
    }, baseModule);
  });

  afterEach(() => {
    // Reset all counters and restore all stubbed functions
    sandbox.reset();
    sandbox.restore();
  });

  describe('packageModules()', () => {
    it('should do nothing if webpackIncludeModules is not set', () => {
      _.unset(serverless, 'service.custom.webpackIncludeModules');
      return expect(module.packExternalModules({ stats: [] })).to.eventually.deep.equal({ stats: [] })
      .then(() => BbPromise.all([
        expect(npmMock.install).to.not.have.been.called,
        expect(fsExtraMock.copy).to.not.have.been.called,
        expect(childProcessMock.exec).to.not.have.been.called,
        expect(writeFileSyncStub).to.not.have.been.called,
      ]));
    });

    it('should install external modules', () => {
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
      const expectedPackageJSON = {
        dependencies: {
          '@scoped/vendor': '1.0.0',
          uuid: '^5.4.1',
          bluebird: '^3.4.0'
        }
      };

      module.webpackOutputPath = 'outputPath';
      npmMock.install.returns(BbPromise.resolve());
      fsExtraMock.copy.yields();
      childProcessMock.exec.yields();
      childProcessMock.execSync.returns('{}');
      return expect(module.packExternalModules(stats)).to.be.fulfilled
      .then(() => BbPromise.all([
        // npm install should have been called with all externals from the package mock
        expect(npmMock.install).to.have.been.calledOnce,
        expect(npmMock.install).to.have.been.calledWithExactly([
          '@scoped/vendor@1.0.0',
          'uuid@^5.4.1',
          'bluebird@^3.4.0'
        ],
        {
          cwd: 'outputPath/dependencies',
          maxBuffer: 204800,
          save: true
        }),
        // The module package JSON and the composite one should have been stored
        expect(writeFileSyncStub).to.have.been.calledTwice,
        expect(writeFileSyncStub.firstCall.args[1]).to.equal('{}'),
        expect(writeFileSyncStub.secondCall.args[1]).to.equal(JSON.stringify(expectedPackageJSON, null, 2)),
        // The modules should have been copied
        expect(fsExtraMock.copy).to.have.been.calledOnce,
        // npm prune should have been called
        expect(childProcessMock.exec).to.have.been.calledOnce,
      ]));
    });
  });
});
