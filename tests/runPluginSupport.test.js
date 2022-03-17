'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const sinon = require('sinon');
const Serverless = require('serverless');
const path = require('path');
const baseModule = require('../lib/runPluginSupport');

const pluginPath = path.join('plugin', 'run', 'utils');
const deployFunctionsToLocalEmulatorStub = require(path.join(pluginPath, 'deployFunctionsToLocalEmulator'));
const getLocalRootUrlStub = require(path.join(pluginPath, 'getLocalRootUrl'));

jest.mock('plugins/run/utils/deployFunctionsToLocalEmulator', () => jest.fn().mockResolvedValue(), { virtual: true });
jest.mock('plugins/run/utils/getLocalRootUrl', () => jest.fn(), { virtual: true });
// Support windowsr
jest.mock('plugins\\run\\utils\\deployFunctionsToLocalEmulator', () => jest.fn().mockResolvedValue(), {
  virtual: true
});
jest.mock('plugins\\run\\utils\\getLocalRootUrl', () => jest.fn(), { virtual: true });

describe('runPluginSupport', () => {
  let sandbox;
  let serverless;
  let module;
  let chdirStub;

  beforeAll(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn(),
      consoleLog: jest.fn()
    };

    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );

    _.set(serverless, 'config.serverlessPath', '.');

    chdirStub = sandbox.stub(process, 'chdir');
  });

  afterEach(() => {
    chdirStub.reset();
    sandbox.restore();
  });

  describe('prepareRun', () => {
    it('should prepare environment and save original values', () => {
      const prepareRun = module.prepareRun.bind(module);
      const servicePath = path.join('my', 'servicePath');
      const webpackOutputPath = path.join('webpack', 'output', 'path');

      _.set(serverless, 'config.servicePath', servicePath);
      _.set(module, 'webpackOutputPath', webpackOutputPath);
      _.unset(module, 'keepOutputDirectory');

      return expect(prepareRun())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.join(
            expect(module.originalServicePath).toEqual(servicePath),
            expect(module.originalWebpackOutputPath).toEqual(webpackOutputPath),
            expect(module.keepOutputDirectory).toBe(true),
            expect(serverless.config.servicePath).toEqual(path.join(webpackOutputPath, 'service')),
            expect(chdirStub.args[0]).toEqual([serverless.config.servicePath])
          )
        );
    });
  });

  describe('watchRun', () => {
    beforeEach(() => {
      _.set(module, 'webpackConfig.output.path', 'outputPath');
    });

    it('should invoke hook and deploy functions', () => {
      const watchRun = module.watchRun.bind(module);
      const service = {
        name: 'testService',
        functions: {}
      };
      _.set(module, 'hooks[before:run:run]', jest.fn().mockResolvedValue());
      _.set(serverless, 'service', service);

      return expect(watchRun())
        .resolves.toBeUndefined()
        .then(() =>
          BbPromise.join(
            expect(deployFunctionsToLocalEmulatorStub).toHaveBeenCalledTimes(1),
            expect(getLocalRootUrlStub).toHaveBeenCalledTimes(1),
            expect(deployFunctionsToLocalEmulatorStub).toHaveBeenCalledWith(service, undefined, undefined)
          )
        );
    });
  });
});
