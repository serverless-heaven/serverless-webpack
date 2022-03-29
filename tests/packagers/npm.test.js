'use strict';
/**
 * Unit tests for packagers/npm
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const Utils = require('../../lib/utils');
const { sep } = require('path');
const npmModule = require('../../lib/packagers/npm');
const fseMock = require('fs-extra');
const fsMock = require('fs');

jest.mock('fs-extra');
jest.mock('fs');
jest.mock('../../lib/utils', () => {
  const original = jest.requireActual('../../lib/utils');
  // eslint-disable-next-line lodash/prefer-lodash-method
  return Object.assign({}, original, {
    spawnProcess: jest.fn()
  });
});

describe('npm', () => {
  beforeEach(() => {
    fsMock.readFileSync.mockReturnValue(false);
  });

  it('should return "package-lock.json" as lockfile name', () => {
    expect(npmModule.lockfileName).toEqual('package-lock.json');
  });

  it('should return no packager sections', () => {
    expect(npmModule.copyPackageSectionNames).toEqual([]);
  });

  it('requires to copy modules', () => {
    expect(npmModule.mustCopyModules).toBe(true);
  });

  describe('install', () => {
    it('should use npm install', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(npmModule.install('myPath', {}))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenCalledWith(expect.stringMatching(/^npm/), ['install'], {
            cwd: 'myPath'
          });
          return null;
        });
    });
  });

  describe('noInstall', () => {
    it('should skip npm install', () => {
      return expect(npmModule.install('myPath', { noInstall: true }))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(0);
          return null;
        });
    });
  });

  describe('prune', () => {
    it('should use npm prune', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'success', stderr: '' }));
      return expect(npmModule.prune('myPath'))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenCalledWith(expect.stringMatching(/^npm/), ['prune'], {
            cwd: 'myPath'
          });
          return null;
        });
    });
  });

  describe('runScripts', () => {
    it('should use npm run for the given scripts', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'success', stderr: '' }));
      return expect(npmModule.runScripts('myPath', ['s1', 's2']))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(2);
          expect(Utils.spawnProcess).toHaveBeenNthCalledWith(1, expect.stringMatching(/^npm/), ['run', 's1'], {
            cwd: 'myPath'
          });
          expect(Utils.spawnProcess).toHaveBeenNthCalledWith(2, expect.stringMatching(/^npm/), ['run', 's2'], {
            cwd: 'myPath'
          });
          return null;
        });
    });
  });

  describe('getProdDependencies', () => {
    describe('without lock file', () => {
      it('should use npm ls', () => {
        Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: '{}', stderr: '' }));
        return expect(npmModule.getProdDependencies('myPath', 10))
          .resolves.toEqual({})
          .then(() => {
            expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
            expect(Utils.spawnProcess).toHaveBeenCalledWith(
              expect.stringMatching(/^npm/),
              ['ls', '-prod', '-json', '-depth=10'],
              { cwd: 'myPath' }
            );
            expect(fseMock.pathExistsSync).toHaveBeenCalledWith(`myPath${sep}package-lock.json`);
            return null;
          });
      });

      it('should default to depth 1', () => {
        Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: '{}', stderr: '' }));
        return expect(npmModule.getProdDependencies('myPath'))
          .resolves.toEqual({})
          .then(() => {
            expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
            expect(Utils.spawnProcess).toHaveBeenCalledWith(
              expect.stringMatching(/^npm/),
              ['ls', '-prod', '-json', '-depth=1'],
              { cwd: 'myPath' }
            );
            expect(fseMock.pathExistsSync).toHaveBeenCalledWith(`myPath${sep}package-lock.json`);
            return null;
          });
      });
    });

    describe('with lock file', () => {
      it('should use npm ls when lock file is not version 2', () => {
        fseMock.pathExistsSync.mockReturnValue(true);
        fsMock.readFileSync.mockReturnValue(JSON.stringify({ lockfileVersion: 1 }));
        Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: '{}', stderr: '' }));
        return expect(npmModule.getProdDependencies('myPath'))
          .resolves.toEqual({})
          .then(() => {
            expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
            expect(Utils.spawnProcess).toHaveBeenCalledWith(
              expect.stringMatching(/^npm/),
              ['ls', '-prod', '-json', '-depth=1'],
              { cwd: 'myPath' }
            );
            expect(fseMock.pathExistsSync).toHaveBeenCalledWith(`myPath${sep}package-lock.json`);
            expect(fsMock.readFileSync).toHaveBeenCalledWith(`myPath${sep}package-lock.json`);
            return null;
          });
      });

      it('should returns lock file when is version 2', () => {
        fseMock.pathExistsSync.mockReturnValue(true);
        const lockData = {
          lockfileVersion: 2,
          dependencies: {
            '@babel/code-frame': {
              version: '7.16.7',
              resolved: 'https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.16.7.tgz',
              integrity:
                'sha512-iAXqUn8IIeBTNd72xsFlgaXHkMBMt6y4HJp1tIaK465CWLT/fG1aqB7ykr95gHHmlBdGbFeWWfyB4NJJ0nmeIg==',
              dev: true,
              requires: {
                '@babel/highlight': '^7.16.7'
              }
            }
          }
        };
        fsMock.readFileSync.mockReturnValue(JSON.stringify(lockData));
        return expect(npmModule.getProdDependencies('myPath'))
          .resolves.toEqual(lockData)
          .then(() => {
            expect(Utils.spawnProcess).toHaveBeenCalledTimes(0);
            expect(fseMock.pathExistsSync).toHaveBeenCalledWith(`myPath${sep}package-lock.json`);
            expect(fsMock.readFileSync).toHaveBeenCalledWith(`myPath${sep}package-lock.json`);
            return null;
          });
      });

      it('should lockfile path be customisable', () => {
        fseMock.pathExistsSync.mockReturnValue(true);
        const lockData = {
          lockfileVersion: 2,
          dependencies: {
            '@babel/code-frame': {
              version: '7.16.7',
              resolved: 'https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.16.7.tgz',
              integrity:
                'sha512-iAXqUn8IIeBTNd72xsFlgaXHkMBMt6y4HJp1tIaK465CWLT/fG1aqB7ykr95gHHmlBdGbFeWWfyB4NJJ0nmeIg==',
              dev: true,
              requires: {
                '@babel/highlight': '^7.16.7'
              }
            }
          }
        };
        fsMock.readFileSync.mockReturnValue(JSON.stringify(lockData));
        return expect(
          npmModule.getProdDependencies('root-workspace/packages/my-package', 1, {
            lockFile: '../../package-lock.json'
          })
        )
          .resolves.toEqual(lockData)
          .then(() => {
            expect(Utils.spawnProcess).toHaveBeenCalledTimes(0);
            expect(fseMock.pathExistsSync).toHaveBeenCalledWith(`root-workspace${sep}package-lock.json`);
            expect(fsMock.readFileSync).toHaveBeenCalledWith(`root-workspace${sep}package-lock.json`);
            return null;
          });
      });
    });
  });

  it('should reject if npm returns critical and minor errors', () => {
    const stderr =
      'ENOENT: No such file\nnpm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon\n\n';
    Utils.spawnProcess.mockReturnValue(
      BbPromise.reject(new Utils.SpawnError('Command execution failed', '{}', stderr))
    );
    return expect(npmModule.getProdDependencies('myPath', 1, {}))
      .rejects.toThrow('Command execution failed')
      .then(() => {
        // npm ls and npm prune should have been called
        expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
        expect(Utils.spawnProcess).toHaveBeenCalledWith(
          expect.stringMatching(/^npm/),
          ['ls', '-prod', '-json', '-depth=1'],
          { cwd: 'myPath' }
        );
        return null;
      });
  });

  it('should reject if an error happens without any information in stdout', () => {
    Utils.spawnProcess.mockReturnValue(BbPromise.reject(new Utils.SpawnError('Command execution failed', '', '')));
    return expect(npmModule.getProdDependencies('myPath', 1))
      .rejects.toThrow('Command execution failed')
      .then(() =>
        Promise.all([
          // npm ls and npm prune should have been called
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1),
          expect(Utils.spawnProcess).toHaveBeenCalledWith(
            expect.stringMatching(/^npm/),
            ['ls', '-prod', '-json', '-depth=1'],
            { cwd: 'myPath' }
          )
        ])
      );
  });

  it('should ignore minor local NPM errors and log them (NPM < 7)', () => {
    const stderr = _.join(
      [
        'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
        'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
        'npm ERR! peer dep missing: sinon@2.3.8'
      ],
      '\n'
    );
    const lsResult = {
      version: '1.0.0',
      problems: [
        'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
        'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
        'npm ERR! peer dep missing: sinon@2.3.8'
      ],
      dependencies: {
        '@scoped/vendor': '1.0.0',
        uuid: '^5.4.1',
        bluebird: '^3.4.0'
      }
    };

    Utils.spawnProcess.mockReturnValue(
      BbPromise.reject(new Utils.SpawnError('Command execution failed', JSON.stringify(lsResult), stderr))
    );
    return expect(npmModule.getProdDependencies('myPath', 1))
      .resolves.toEqual(lsResult)
      .then(() =>
        Promise.all([
          // npm ls and npm prune should have been called
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1),
          expect(Utils.spawnProcess).toHaveBeenCalledWith(
            expect.stringMatching(/^npm/),
            ['ls', '-prod', '-json', '-depth=1'],
            { cwd: 'myPath' }
          )
        ])
      );
  });

  it('should ignore minor local NPM errors and log them (NPM >= 7)', () => {
    const stderr = _.join(
      [
        'npm ERR! code ELSPROBLEMS',
        'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
        'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
        'npm ERR! peer dep missing: sinon@2.3.8',
        '{',
        '  "error": {',
        '    "code": "ELSPROBLEMS",',
        '    "summary": "extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon\nmissing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0\npeer dep missing: sinon@2.3.8',
        '    "detail": ""',
        '  }',
        '}'
      ],
      '\n'
    );
    const lsResult = {
      version: '1.0.0',
      problems: [
        'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
        'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
        'npm ERR! peer dep missing: sinon@2.3.8'
      ],
      dependencies: {
        '@scoped/vendor': '1.0.0',
        uuid: '^5.4.1',
        bluebird: '^3.4.0'
      }
    };

    Utils.spawnProcess.mockReturnValue(
      BbPromise.reject(new Utils.SpawnError('Command execution failed', JSON.stringify(lsResult), stderr))
    );
    return expect(npmModule.getProdDependencies('myPath', 1))
      .resolves.toEqual(lsResult)
      .then(() =>
        Promise.all([
          // npm ls and npm prune should have been called
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1),
          expect(Utils.spawnProcess).toHaveBeenCalledWith(
            expect.stringMatching(/^npm/),
            ['ls', '-prod', '-json', '-depth=1'],
            { cwd: 'myPath' }
          )
        ])
      );
  });

  it('should rebase lock file references', () => {
    const expectedLocalModule = 'file:../../locals/../../mymodule';
    const fakePackageLockJSON = {
      name: 'test-service',
      version: '1.0.0',
      description: 'Packaged externals for test-service',
      private: true,
      dependencies: {
        '@scoped/vendor': '1.0.0',
        uuid: {
          version: '^5.4.1'
        },
        bluebird: {
          version: '^3.4.0'
        },
        localmodule: {
          version: 'file:../../mymodule'
        }
      }
    };
    const expectedPackageLockJSON = {
      name: 'test-service',
      version: '1.0.0',
      description: 'Packaged externals for test-service',
      private: true,
      dependencies: {
        '@scoped/vendor': '1.0.0',
        uuid: {
          version: '^5.4.1'
        },
        bluebird: {
          version: '^3.4.0'
        },
        localmodule: {
          version: expectedLocalModule
        }
      }
    };

    npmModule.rebaseLockfile('../../locals', fakePackageLockJSON);
    expect(fakePackageLockJSON).toEqual(expectedPackageLockJSON);
  });
});
