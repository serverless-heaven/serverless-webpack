'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const makeWebpackMock = require('./webpack.mock');
const makeJestWorkerMock = require('./mocks/jest-worker.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

const webpackConfigFilePath = './webpack.config.js';

const testWebpackConfig = {
  output: { path: '/home/hello' },
  entry: undefined,
  context: undefined,
  node: undefined,
  target: undefined
};

describe('compile', () => {
  let sandbox;
  let webpackMock;
  let jestWorkerMock;
  let baseModule;
  let serverless;
  let module;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise);

    webpackMock = makeWebpackMock(sandbox);
    jestWorkerMock = makeJestWorkerMock(sandbox);

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('webpack', webpackMock);
    mockery.registerMock('jest-worker', jestWorkerMock);
    mockery.registerMock(webpackConfigFilePath, {});
    baseModule = require('../lib/compile');
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

    module = _.assign(
      {
        serverless,
        options: {},
        webpackConfigFilePath
      },
      baseModule
    );
  });

  afterEach(() => {
    // This will reset the webpackMock too
    sandbox.restore();
  });

  it('should expose a `compile` method', () => {
    expect(module.compile).to.be.a('function');
  });

  it('should compile with webpack from a context configuration', () => {
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    return expect(module.compile()).to.be.fulfilled.then(() => {
      expect(webpackMock).to.have.been.calledWith(testWebpackConfig);
      expect(webpackMock.compilerMock.run).to.have.been.calledOnce;
      return null;
    });
  });

  it('should fail if configuration is missing', () => {
    module.webpackConfig = testWebpackConfig;
    module.configuration = undefined;
    return expect(module.compile()).to.be.rejectedWith('Missing plugin configuration');
  });

  it('should fail if there are compilation errors', () => {
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    // We stub errors here. It will be reset again in afterEach()
    sandbox.stub(webpackMock.statsMock.compilation, 'errors').value(['error']);
    return expect(module.compile()).to.be.rejectedWith(/compilation error/);
  });

  it('should work with multi compile', () => {
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
          toString: sandbox.stub().returns('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.reset();
    webpackMock.compilerMock.run.yields(null, multiStats);
    return expect(module.compile()).to.be.fulfilled.then(() => {
      expect(webpackMock).to.have.been.calledWith(testWebpackConfig);
      expect(webpackMock.compilerMock.run).to.have.been.calledOnce;
      return null;
    });
  });

  it('should work with concurrent compile', () => {
    const testWebpackMultiConfig = [
      {
        output: {
          path: '/home/hello'
        },
        entry: undefined,
        context: undefined,
        node: undefined,
        target: undefined
      },
      {
        output: {
          path: '/home/hello2'
        },
        entry: undefined,
        context: undefined,
        node: undefined,
        target: undefined
      }
    ];
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
          toString: sandbox.stub().returns('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackMultiConfig;
    module.configuration = { concurrency: 2 };
    webpackMock.compilerMock.run.reset();
    webpackMock.compilerMock.run.yields(null, multiStats);
    return expect(module.compile()).to.be.fulfilled.then(() => {
      expect(webpackMock).to.have.been.calledWith(testWebpackMultiConfig[0]);
      expect(webpackMock).to.have.been.calledWith(testWebpackMultiConfig[1]);
      expect(webpackMock.compilerMock.run).to.have.been.calledTwice;
      return null;
    });
  });

  it('should use correct stats option', () => {
    const testWebpackStatsConfig = {
      stats: 'minimal',
      output: {
        path: '/home/hello'
      },
      entry: undefined,
      context: undefined,
      node: undefined,
      target: undefined
    };
    const mockStats = {
      compilation: {
        errors: [],
        compiler: {
          outputPath: 'statsMock-outputPath'
        },
        modules: []
      },
      toString: sandbox.stub().returns('testStats'),
      hasErrors: _.constant(false)
    };

    module.webpackConfig = testWebpackStatsConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.reset();
    webpackMock.compilerMock.run.yields(null, mockStats);
    mockery.registerMock(webpackConfigFilePath, testWebpackStatsConfig);
    return expect(module.compile())
      .to.be.fulfilled.then(() => {
        expect(webpackMock).to.have.been.calledWith(testWebpackStatsConfig);
        expect(mockStats.toString.firstCall.args).to.eql([testWebpackStatsConfig.stats]);
        module.webpackConfig = [testWebpackStatsConfig];
        return expect(module.compile()).to.be.fulfilled;
      })
      .then(() => {
        expect(webpackMock).to.have.been.calledWith(testWebpackStatsConfig);
        expect(mockStats.toString.args).to.eql([ [testWebpackStatsConfig.stats], [testWebpackStatsConfig.stats] ]);
        mockery.registerMock(webpackConfigFilePath, {});
        return null;
      });
  });

  it('should set stats outputPath', () => {
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
          toString: sandbox.stub().returns('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.reset();
    webpackMock.compilerMock.run.yields(null, multiStats);
    return expect(module.compile()).to.be.fulfilled.then(() => {
      expect(module.compileStats.stats[0].outputPath).to.equal('compileStats-outputPath');
      return null;
    });
  });

  it('should set stats externals', () => {
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'compileStats-outputPath'
            },
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
            ]
          },
          toString: sandbox.stub().returns('testStats'),
          hasErrors: _.constant(false)
        }
      ]
    };
    module.webpackConfig = testWebpackConfig;
    module.configuration = { concurrency: 1 };
    webpackMock.compilerMock.run.reset();
    webpackMock.compilerMock.run.yields(null, multiStats);
    return expect(module.compile()).to.be.fulfilled.then(() => {
      expect(module.compileStats.stats[0].externalModules).to.eql([
        { external: '@scoped/vendor', origin: undefined },
        { external: 'uuid', origin: undefined },
        { external: 'localmodule', origin: undefined },
        { external: 'bluebird', origin: undefined },
        { external: 'aws-sdk', origin: undefined }
      ]);
      return null;
    });
  });
});
