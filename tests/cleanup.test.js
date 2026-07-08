const _ = require('lodash');
const fs = require('node:fs');
const Serverless = require('serverless');
const Configuration = require('../lib/Configuration');
const baseModule = require('../lib/cleanup');

describe('cleanup', () => {
  let serverless;
  let module;
  let dirExistsSyncStub;
  let rmStub;

  beforeEach(() => {
    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn(),
      error: jest.fn(),
      consoleLog: jest.fn()
    };

    dirExistsSyncStub = jest.fn();
    serverless.utils.dirExistsSync = dirExistsSyncStub;
    rmStub = jest.spyOn(fs.promises, 'rm').mockResolvedValue();

    module = _.assign(
      {
        serverless,
        options: {
          verbose: true
        },
        webpackOutputPath: 'my/Output/Path',
        configuration: new Configuration()
      },
      baseModule
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should remove output dir if it exists', () => {
    dirExistsSyncStub.mockReturnValue(true);
    rmStub.mockResolvedValue(true);

    return expect(module.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(1);
        expect(dirExistsSyncStub).toHaveBeenCalledWith('my/Output/Path');
        expect(rmStub).toHaveBeenCalledTimes(1);
        expect(serverless.cli.log).toHaveBeenCalledWith('Removing my/Output/Path done');
        return null;
      });
  });

  it('should log nothing is verbose is false', () => {
    dirExistsSyncStub.mockReturnValue(true);
    rmStub.mockResolvedValue(true);

    module = _.assign({}, module, { options: { verbose: false } });

    return expect(module.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(1);
        expect(dirExistsSyncStub).toHaveBeenCalledWith('my/Output/Path');
        expect(rmStub).toHaveBeenCalledTimes(1);
        expect(serverless.cli.log).toHaveBeenCalledTimes(0);
        return null;
      });
  });

  it('should log an error if it occurs', () => {
    dirExistsSyncStub.mockReturnValue(true);
    rmStub.mockRejectedValue('remove error');

    return expect(module.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(serverless.cli.log).toHaveBeenCalledWith('Error occurred while removing my/Output/Path: remove error');

        return null;
      });
  });

  it('should not call remove if output dir does not exists', () => {
    dirExistsSyncStub.mockReturnValue(false);

    return expect(module.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(1);
        expect(dirExistsSyncStub).toHaveBeenCalledWith('my/Output/Path');
        expect(rmStub).toHaveBeenCalledTimes(0);
        return null;
      });
  });

  it('should keep output dir if keepOutputDir = true', () => {
    dirExistsSyncStub.mockReturnValue(true);

    const configuredModule = _.assign({}, module, {
      keepOutputDirectory: true
    });
    return expect(configuredModule.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(0);
        expect(rmStub).toHaveBeenCalledTimes(0);
        return null;
      });
  });

  it('should keep output dir if keepOutputDir = true in configuration', () => {
    dirExistsSyncStub.mockReturnValue(true);

    const configuredModule = _.assign({}, module, {
      configuration: new Configuration({ webpack: { keepOutputDirectory: true } })
    });

    return expect(configuredModule.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(0);
        expect(rmStub).toHaveBeenCalledTimes(0);
        return null;
      });
  });
});
