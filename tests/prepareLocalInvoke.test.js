'use strict';

const _ = require('lodash');
const sinon = require('sinon');
const Serverless = require('serverless');
const path = require('path');
const baseModule = require('../lib/prepareLocalInvoke');

jest.mock('../lib/utils', () => {
  return {
    purgeCache: jest.fn()
  };
});

describe('prepareLocalInvoke', () => {
  let serverless;
  let module;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn()
    };
    _.set(serverless, 'config.serverless.processedInput.options', {
      path: './event.json'
    });

    sandbox.stub(process, 'chdir');
    serverless.service.getFunction = jest.fn();

    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should store original service path', () => {
    module.serverless.service.package = {};
    module.serverless.service.getFunction.mockReturnValue({ handler: 'myFuncHandler' });
    module.webpackOutputPath = '.';
    module.serverless.config.servicePath = './servicePath';
    module.prepareLocalInvoke();

    expect(module.originalServicePath).toEqual('./servicePath');
  });

  it('should use the function folder as cwd', () => {
    module.serverless.service.package = {
      individually: true
    };
    module.options.function = 'myFunc';
    module.serverless.service.getFunction.mockReturnValue({ handler: 'myFuncHandler' });
    module.webpackOutputPath = '.webpack';
    module.serverless.config.servicePath = './servicePath';
    module.prepareLocalInvoke();

    expect(process.chdir.args[0]).toEqual([path.join('.webpack', 'myFunc')]);
  });

  it('should use the service folder as cwd', () => {
    module.serverless.service.package = {};
    module.options.function = 'myFunc';
    module.serverless.service.getFunction.mockReturnValue({ handler: 'myFuncHandler' });
    module.webpackOutputPath = '.webpack';
    module.serverless.config.servicePath = './servicePath';
    module.prepareLocalInvoke();

    expect(process.chdir.args[0]).toEqual([path.join('.webpack', 'service')]);
  });

  it('should work without path option', () => {
    module.serverless.service.package = {};
    module.serverless.service.getFunction.mockReturnValue({ handler: 'myFuncHandler' });
    module.webpackOutputPath = '.';
    module.serverless.config.servicePath = './servicePath';
    _.unset(module, 'serverless.config.serverless.processedInput.options.path');
    module.prepareLocalInvoke();

    expect(module.originalServicePath).toEqual('./servicePath');
  });
});
