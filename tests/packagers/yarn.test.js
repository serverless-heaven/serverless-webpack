'use strict';
/**
 * Unit tests for packagers/yarn
 */

const BbPromise = require('bluebird');
const Utils = require('../../lib/utils');
const yarnModule = require('../../lib/packagers/yarn');

jest.mock('../../lib/utils', () => {
  const original = jest.requireActual('../../lib/utils');
  // eslint-disable-next-line lodash/prefer-lodash-method
  return Object.assign({}, original, {
    spawnProcess: jest.fn()
  });
});

describe('yarn', () => {
  it('should return "yarn.lock" as lockfile name', () => {
    expect(yarnModule.lockfileName).toEqual('yarn.lock');
  });

  it('should return packager sections', () => {
    expect(yarnModule.copyPackageSectionNames).toEqual(['resolutions']);
  });

  it('does not require to copy modules', () => {
    expect(yarnModule.mustCopyModules).toBe(false);
  });

  describe('getProdDependencies', () => {
    it('should use yarn list', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: '{}', stderr: '' }));
      return expect(yarnModule.getProdDependencies('myPath', 1))
        .resolves.toEqual({
          dependencies: {},
          problems: []
        })
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenNthCalledWith(
            1,
            expect.stringMatching(/^yarn/),
            ['list', '--depth=1', '--json', '--production'],
            { cwd: 'myPath' }
          );
          return null;
        });
    });

    it('should transform yarn trees to npm dependencies', () => {
      const testYarnResult =
        '{"type":"activityStart","data":{"id":0}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"bestzip@^2.1.5"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"bluebird@^3.5.1"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"fs-extra@^4.0.3"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"mkdirp@^0.5.1"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"minimist@^0.0.8"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"@sls/webpack@^1.0.0"}}\n' +
        '{"type":"tree","data":{"type":"list","trees":[' +
        '{"name":"bestzip@2.1.5","children":[],"hint":null,"color":"bold",' +
        '"depth":0},{"name":"bluebird@3.5.1","children":[],"hint":null,"color":' +
        '"bold","depth":0},{"name":"fs-extra@4.0.3","children":[],"hint":null,' +
        '"color":"bold","depth":0},{"name":"mkdirp@0.5.1","children":[{"name":' +
        '"minimist@0.0.8","children":[],"hint":null,"color":"bold","depth":0}],' +
        '"hint":null,"color":null,"depth":0},{"name":"@sls/webpack@1.0.0",' +
        '"children":[],"hint":null,"color":"bold","depth":0}]}}\n';
      const expectedResult = {
        problems: [],
        dependencies: {
          bestzip: {
            version: '2.1.5',
            dependencies: {}
          },
          bluebird: {
            version: '3.5.1',
            dependencies: {}
          },
          'fs-extra': {
            version: '4.0.3',
            dependencies: {}
          },
          mkdirp: {
            version: '0.5.1',
            dependencies: {
              minimist: {
                version: '0.0.8',
                dependencies: {}
              }
            }
          },
          '@sls/webpack': {
            version: '1.0.0',
            dependencies: {}
          }
        }
      };
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: testYarnResult, stderr: '' }));
      return expect(yarnModule.getProdDependencies('myPath', 1)).resolves.toEqual(expectedResult);
    });

    it('should reject on critical yarn errors', () => {
      Utils.spawnProcess.mockReturnValue(
        BbPromise.reject(new Utils.SpawnError('Exited with code 1', '', 'Yarn failed.\nerror Could not find module.'))
      );
      return expect(yarnModule.getProdDependencies('myPath', 1)).rejects.toThrow('Exited with code 1');
    });
  });

  describe('rebaseLockfile', () => {
    it('should return the original lockfile', () => {
      const testContent = 'eugfogfoigqwoeifgoqwhhacvaisvciuviwefvc';
      const testContent2 = 'eugfogfoigqwoeifgoqwhhacvaisvciuviwefvc';
      expect(yarnModule.rebaseLockfile('.', testContent)).toEqual(testContent2);
    });

    it('should rebase file references', () => {
      const testContent = `
      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"

      acorn@^3.0.4:
        version "3.3.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"

      otherModule@file:../../otherModule/the-new-version:
        version "1.2.0"

      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"

      "@myCompany/myModule@../../myModule/the-new-version":
        version "6.1.0"
        dependencies:
          aws-xray-sdk "^1.1.6"
          aws4 "^1.6.0"
          base-x "^3.0.3"
          bluebird "^3.5.1"
          chalk "^1.1.3"
          cls-bluebird "^2.1.0"
          continuation-local-storage "^3.2.1"
          lodash "^4.17.4"
          moment "^2.20.0"
          redis "^2.8.0"
          request "^2.83.0"
          ulid "^0.1.0"
          uuid "^3.1.0"

        acorn@^5.0.0, acorn@^5.5.0:
          version "5.5.3"
          resolved "https://registry.yarnpkg.com/acorn/-/acorn-5.5.3.tgz#f473dd47e0277a08e28e9bec5aeeb04751f0b8c9"
      `;

      const expectedContent = `
      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"

      acorn@^3.0.4:
        version "3.3.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"

      otherModule@file:../../project/../../otherModule/the-new-version:
        version "1.2.0"

      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"

      "@myCompany/myModule@../../project/../../myModule/the-new-version":
        version "6.1.0"
        dependencies:
          aws-xray-sdk "^1.1.6"
          aws4 "^1.6.0"
          base-x "^3.0.3"
          bluebird "^3.5.1"
          chalk "^1.1.3"
          cls-bluebird "^2.1.0"
          continuation-local-storage "^3.2.1"
          lodash "^4.17.4"
          moment "^2.20.0"
          redis "^2.8.0"
          request "^2.83.0"
          ulid "^0.1.0"
          uuid "^3.1.0"

        acorn@^5.0.0, acorn@^5.5.0:
          version "5.5.3"
          resolved "https://registry.yarnpkg.com/acorn/-/acorn-5.5.3.tgz#f473dd47e0277a08e28e9bec5aeeb04751f0b8c9"
      `;

      expect(yarnModule.rebaseLockfile('../../project', testContent)).toEqual(expectedContent);
    });
  });

  describe('install', () => {
    it('should use yarn install', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(yarnModule.install('myPath', {}))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenCalledWith(
            expect.stringMatching(/^yarn/),
            ['install', '--non-interactive', '--frozen-lockfile'],
            {
              cwd: 'myPath'
            }
          );
          return null;
        });
    });

    it('should use noNonInteractive option', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(yarnModule.install('myPath', { noNonInteractive: true }))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenCalledWith(
            expect.stringMatching(/^yarn/),
            ['install', '--frozen-lockfile'],
            {
              cwd: 'myPath'
            }
          );
          return null;
        });
    });

    it('should use ignoreScripts option', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(yarnModule.install('myPath', { ignoreScripts: true }))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenCalledWith(
            expect.stringMatching(/^yarn/),
            ['install', '--non-interactive', '--frozen-lockfile', '--ignore-scripts'],
            {
              cwd: 'myPath'
            }
          );
          return null;
        });
    });

    it('should use noFrozenLockfile option', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(yarnModule.install('myPath', { noFrozenLockfile: true }))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenCalledWith(
            expect.stringMatching(/^yarn/),
            ['install', '--non-interactive'],
            {
              cwd: 'myPath'
            }
          );
          return null;
        });
    });

    it('should use networkConcurrency option', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(yarnModule.install('myPath', { networkConcurrency: 1 }))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenCalledWith(
            expect.stringMatching(/^yarn/),
            ['install', '--non-interactive', '--frozen-lockfile', '--network-concurrency 1'],
            {
              cwd: 'myPath'
            }
          );
          return null;
        });
    });
  });

  describe('noInstall', () => {
    it('should skip yarn install', () => {
      return expect(yarnModule.install('myPath', { noInstall: true })).resolves.toBeUndefined();
    });
  });

  describe('prune', () => {
    it('should call install', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'success', stderr: '' }));
      return expect(yarnModule.prune('myPath', {}))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(1);
          expect(Utils.spawnProcess).toHaveBeenNthCalledWith(
            1,
            expect.stringMatching(/^yarn/),
            ['install', '--non-interactive', '--frozen-lockfile'],
            {
              cwd: 'myPath'
            }
          );
          return null;
        });
    });
  });

  describe('runScripts', () => {
    it('should use yarn run for the given scripts', () => {
      Utils.spawnProcess.mockReturnValue(BbPromise.resolve({ stdout: 'success', stderr: '' }));
      return expect(yarnModule.runScripts('myPath', ['s1', 's2']))
        .resolves.toBeUndefined()
        .then(() => {
          expect(Utils.spawnProcess).toHaveBeenCalledTimes(2);
          expect(Utils.spawnProcess).toHaveBeenNthCalledWith(1, expect.stringMatching(/^yarn/), ['run', 's1'], {
            cwd: 'myPath'
          });
          expect(Utils.spawnProcess).toHaveBeenNthCalledWith(2, expect.stringMatching(/^yarn/), ['run', 's2'], {
            cwd: 'myPath'
          });
          return null;
        });
    });
  });
});
