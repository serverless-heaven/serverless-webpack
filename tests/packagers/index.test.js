/**
 * Unit tests for packagers/index
 */

const _ = require('lodash');
const Serverless = require('serverless');
const baseModule = require('../../lib/packagers/index');

jest.mock('fs-extra');
jest.mock('../../lib/packagers/npm', () => ({
  hello: 'I am NPM'
}));
jest.mock('../../lib/packagers/yarn', () => ({
  hello: 'I am Yarn'
}));

describe('packagers factory', () => {
  let serverless;
  let module;

  beforeEach(() => {
    serverless = new Serverless({ commands: ['print'], options: {}, serviceDir: null });
    serverless.cli = {
      log: jest.fn(),
      consoleLog: jest.fn()
    };

    module = _.assign(
      {
        serverless,
        options: {
          verbose: true
        }
      },
      baseModule
    );
  });

  it('should throw on unknown packagers', () => {
    expect(() => module.get.call({ serverless }, 'unknown')).toThrow(/Could not find packager/);
  });

  it('should use plugin logger on unknown packagers when available', () => {
    const log = {
      error: jest.fn()
    };

    expect(() => module.get.call({ serverless, log }, 'unknown')).toThrow(/Could not find packager/);
    expect(log.error).toHaveBeenCalledWith('Could not find packager "unknown"');
  });

  it('should return npm packager', () => {
    const npm = module.get.call(module, 'npm');
    expect(npm).toEqual({
      hello: 'I am NPM'
    });
  });
});
