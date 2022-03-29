'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const Serverless = require('serverless');
const baseModule = require('../lib/prepareStepOfflineInvoke');

describe('prepareStepOfflineInvoke', () => {
  let serverless;
  let module;

  beforeEach(() => {
    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn()
    };
    serverless.pluginManager.spawn = jest.fn();
    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );
  });

  it('should set service packaging explicitly', () => {
    serverless.pluginManager.spawn.mockResolvedValue();
    serverless.config.servicePath = 'myPath';
    module.webpackOutputPath = '.';
    module.serverless.service.package = {};

    return expect(module.prepareStepOfflineInvoke())
      .resolves.toBe(null)
      .then(() => {
        expect(module.serverless.service.package).toHaveProperty('individually', false);
        return null;
      });
  });

  it('should switch to service packaging', () => {
    serverless.pluginManager.spawn.mockResolvedValue();
    serverless.config.servicePath = 'myPath';
    module.webpackOutputPath = '.';
    module.serverless.service.package = {
      individually: true
    };

    return expect(module.prepareStepOfflineInvoke())
      .resolves.toBe(null)
      .then(() => {
        expect(module.serverless.service.package).toHaveProperty('individually', false);
        return null;
      });
  });

  it('should spawn webpack:validate', () => {
    serverless.pluginManager.spawn.mockResolvedValue();
    serverless.config.servicePath = 'myPath';
    module.webpackOutputPath = '.';

    return expect(module.prepareStepOfflineInvoke())
      .resolves.toBe(null)
      .then(() => {
        expect(serverless.pluginManager.spawn).toHaveBeenCalledTimes(1);
        expect(serverless.pluginManager.spawn).toHaveBeenCalledWith('webpack:validate');
        return null;
      });
  });

  it('should reject if spawn rejects', () => {
    serverless.pluginManager.spawn.mockReturnValue(BbPromise.reject(new Error('spawn failed')));
    serverless.config.servicePath = 'myPath';
    module.webpackOutputPath = '.';

    return expect(module.prepareStepOfflineInvoke()).rejects.toThrow('spawn failed');
  });

  it('should set location if not given by user', () => {
    serverless.pluginManager.spawn.mockResolvedValue();
    serverless.config.servicePath = '.';
    module.webpackOutputPath = '.';

    return expect(module.prepareStepOfflineInvoke())
      .resolves.toBe(null)
      .then(() => {
        expect(serverless.service).toHaveProperty('custom.stepFunctionsOffline.location', 'service');
        return null;
      });
  });

  it('should keep location if set in service config', () => {
    serverless.pluginManager.spawn.mockResolvedValue();
    serverless.config.servicePath = '.';
    module.webpackOutputPath = '.';
    _.set(module.serverless, 'service.custom.stepFunctionsOffline.location', 'myLocation');

    return expect(module.prepareStepOfflineInvoke())
      .resolves.toBe(null)
      .then(() => {
        expect(serverless.service).toHaveProperty('custom.stepFunctionsOffline.location', 'myLocation');
        return null;
      });
  });

  it('should keep location if set in options', () => {
    serverless.pluginManager.spawn.mockResolvedValue();
    serverless.config.servicePath = '.';
    module.webpackOutputPath = '.';
    module.options = {
      location: 'myLocation'
    };

    return expect(module.prepareStepOfflineInvoke())
      .resolves.toBe(null)
      .then(() => {
        expect(serverless.service).not.toHaveProperty('custom.stepFunctionsOffline.location');
        return null;
      });
  });
});
