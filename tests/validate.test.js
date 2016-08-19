'use strict';

const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const Serverless = require('serverless');
const path = require('path');
const makeFsExtraMock = require('./fs-extra.mock');
chai.use(require('sinon-chai'));
const expect = chai.expect;

describe('validate', () => {
  let fsExtraMock;
  let baseModule;
  let module;
  let serverless;

  before(() => {
    mockery.enable({ warnOnUnregistered: false });
    fsExtraMock = makeFsExtraMock();
    mockery.registerMock('fs-extra', fsExtraMock);
    baseModule = require('../lib/validate');
    Object.freeze(baseModule);
  });

  after(() => {
    mockery.disable();
    mockery.deregisterAll();
  });

  beforeEach(() => {
    serverless = new Serverless();
    fsExtraMock._resetSpies();
    module = Object.assign({
      serverless,
      options: {},
    }, baseModule);
  });

  it('should expose a `validate` method', () => {
    expect(module.validate).to.be.a('function');
  });

  it('should set `webpackConfig` in the context to `custom.webpack` option', () => {
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {},
    };
    module.serverless.service.custom.webpack = testConfig;
    return module
      .validate()
      .then(() => {
        expect(module.webpackConfig).to.eql(testConfig);
      });
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
    module.serverless.service.custom.webpack = testConfig;
    return module
      .validate()
      .then(() => {
        expect(fsExtraMock.removeSync).to.have.been.calledWith(testOutPath);
      });
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
    module.serverless.service.custom.webpack = testConfig;
    return module
      .validate()
      .then(() => {
        expect(module.webpackConfig.output).to.eql({
          path: `${testServicePath}/${testOptionsOut}`,
          filename: 'filename',
        });
      });
  });

  it('should set a default `webpackConfig.context` if not present', () => {
    const testConfig = {
      entry: 'test',
      output: {},
    };
    const testServicePath = 'testpath';
    module.serverless.config.servicePath = testServicePath;
    module.serverless.service.custom.webpack = testConfig;
    return module
      .validate()
      .then(() => {
        expect(module.webpackConfig.context).to.equal(testServicePath);
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
      module.serverless.service.custom.webpack = testConfig;
      return module
        .validate()
        .then(() => {
          expect(module.webpackConfig.output).to.eql({
            libraryTarget: 'commonjs',
            path: `${testServicePath}/.webpack`,
            filename: testEntry,
          });
        });
    });

    it('should set a default `webpackConfig.output.filename` if `entry` is an array', () => {
      const testEntry = ['first', 'second', 'last'];
      const testConfig = {
        entry: testEntry,
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      return module
        .validate()
        .then(() => {
          expect(module.webpackConfig.output).to.eql({
            libraryTarget: 'commonjs',
            path: `${testServicePath}/.webpack`,
            filename: 'last',
          });
        });
    });

    it('should set a default `webpackConfig.output.filename` if `entry` is not defined', () => {
      const testConfig = {};
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      return module
        .validate()
        .then(() => {
          expect(module.webpackConfig.output).to.eql({
            libraryTarget: 'commonjs',
            path: `${testServicePath}/.webpack`,
            filename: 'handler.js',
          });
        });
    });
  });

  describe('config file load', () => {
    it('should load a webpack config from file if `custom.webpack` is a string', () => {
      const testConfig = 'testconfig'
      const testServicePath = 'testpath';
      const requiredPath = `${testServicePath}/${testConfig}`;
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      serverless.utils.fileExistsSync = sinon.stub().returns(true);
      const loadedConfig = {
        entry: 'testentry',
      };
      mockery.registerMock(requiredPath, loadedConfig);
      return module
        .validate()
        .then(() => {
          expect(serverless.utils.fileExistsSync).to.have.been.calledWith(requiredPath);
          expect(module.webpackConfig).to.eql(loadedConfig);
          mockery.deregisterMock(requiredPath);
        });
    });

    it('should throw if providing an invalid file', () => {
      const testConfig = 'testconfig'
      const testServicePath = 'testpath';
      const requiredPath = `${testServicePath}/${testConfig}`;
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.webpack = testConfig;
      serverless.utils.fileExistsSync = sinon.stub().returns(false);
      const loadedConfig = {
        entry: 'testentry',
      };
      expect(module.validate.bind(module)).to.throw(/could not find/);
    });

    it('should load a default file if no custom config is provided', () => {
      const testConfig = 'webpack.config.js';
      const testServicePath = 'testpath';
      const requiredPath = `${testServicePath}/${testConfig}`;
      module.serverless.config.servicePath = testServicePath;
      serverless.utils.fileExistsSync = sinon.stub().returns(true);
      const loadedConfig = {
        entry: 'testentry',
      };
      mockery.registerMock(requiredPath, loadedConfig);
      return module
        .validate()
        .then(() => {
          expect(serverless.utils.fileExistsSync).to.have.been.calledWith(requiredPath);
          expect(module.webpackConfig).to.eql(loadedConfig);
          mockery.deregisterMock(requiredPath);
        });
    });
  });
});
