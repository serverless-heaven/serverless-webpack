'use strict';
/**
 * Unit tests for Configuration.
 */

const _ = require('lodash');
const childProcess = require('child_process');
const Utils = require('../lib/utils');

jest.mock('child_process');

describe('Utils', () => {
  describe('guid', () => {
    it('should return different unique ids', () => {
      const guids = [];
      for (let i = 0; i < 10; i++) {
        guids.push(Utils.guid());
      }

      expect(_.size(_.uniq(guids))).toEqual(10);
      expect(_.size(_.compact(guids))).toEqual(10);
    });
  });

  describe('SpawnError', () => {
    it('should store stdout and stderr', () => {
      const err = new Utils.SpawnError('message', 'stdout', 'stderr');
      expect(err).toHaveProperty('message', 'message');
      expect(err).toHaveProperty('stdout', 'stdout');
      expect(err).toHaveProperty('stderr', 'stderr');
    });

    it('should print message and stderr', () => {
      const err = new Utils.SpawnError('message', 'stdout', 'stderr');

      expect(err.toString()).toEqual('message\nstderr');
    });
  });

  describe('spawnProcess', () => {
    const childMock = {
      stdout: {
        setEncoding: jest.fn(),
        on: jest.fn()
      },
      stderr: {
        setEncoding: jest.fn(),
        on: jest.fn()
      },
      on: jest.fn()
    };

    beforeEach(() => {
      childProcess.spawn.mockReturnValue(childMock);
    });

    it('should call child_process.spawn', () => {
      childMock.on.mockReset();
      childMock.on.mockImplementation((name, cb) => {
        if (name === 'close') {
          cb(0);
        }
      });
      return expect(Utils.spawnProcess('cmd', []))
        .resolves.toEqual({ stderr: '', stdout: '' })
        .then(() => {
          expect(childProcess.spawn).toHaveBeenCalledTimes(1);
          return null;
        });
    });

    it('should return stdout and stderr', () => {
      childMock.stderr.on.mockImplementation((name, cb) => {
        if (name === 'data') {
          cb('myErrData');
        }
      });
      childMock.stdout.on.mockImplementation((name, cb) => {
        if (name === 'data') {
          cb('myOutData');
        }
      });
      childMock.on.mockReset();
      childMock.on.mockImplementation((name, cb) => {
        if (name === 'close') {
          cb(0);
        }
      });
      return expect(Utils.spawnProcess('cmd', [])).resolves.toEqual({ stderr: 'myErrData', stdout: 'myOutData' });
    });

    it('should reject on spawn internal error', () => {
      childMock.on.mockReset();
      childMock.on.mockImplementation((name, cb) => {
        if (name === 'error') {
          cb(new Error('spawn ENOENT'));
        }
      });
      return expect(Utils.spawnProcess('cmd', [])).rejects.toThrow('spawn ENOENT');
    });

    it('should reject on positive exit code', () => {
      childMock.on.mockReset();
      childMock.on.mockImplementation((name, cb) => {
        if (name === 'close') {
          cb(1);
        }
      });
      return expect(Utils.spawnProcess('cmd', [])).rejects.toThrow(Utils.SpawnError);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      expect(Utils.safeJsonParse('{"foo": "bar"}')).toEqual({ foo: 'bar' });
    });

    it('should return null for invalid JSON', () => {
      expect(Utils.safeJsonParse('{"foo":')).toEqual(null);
    });
  });

  describe('splitLines', () => {
    it('should split on new line characters', () => {
      expect(Utils.splitLines('a\r\nb\nc')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getAllNodeFunctions', () => {
    it('should return all functions with node runtime', () => {
      const mockServerless = {
        service: {
          getAllFunctions: jest.fn(() => ['foo', 'bar', 'baz']),
          getFunction: jest.fn(name => {
            if (name === 'foo') {
              return { runtime: 'nodejs6.10' };
            }
            if (name === 'bar') {
              return { runtime: 'nodejs8.10' };
            }
            if (name === 'baz') {
              return { runtime: 'python3.6' };
            }
          })
        }
      };

      expect(Utils.getAllNodeFunctions.call({ serverless: mockServerless })).toEqual(['foo', 'bar']);
    });

    it('should ignore handlers with image.uri property', () => {
      const mockServerless = {
        service: {
          getAllFunctions: jest.fn(() => ['foo', 'bar']),
          getFunction: jest.fn(name => {
            if (name === 'foo') {
              return { runtime: 'nodejs6.10' };
            }
            if (name === 'bar') {
              return { runtime: 'nodejs8.10', image: { uri: 'fake-image-uri' } };
            }
          })
        }
      };

      expect(Utils.getAllNodeFunctions.call({ serverless: mockServerless })).toEqual(['foo']);
    });

    it('should ignore handlers with image.name property', () => {
      const mockServerless = {
        service: {
          getAllFunctions: jest.fn(() => ['foo', 'bar']),
          getFunction: jest.fn(name => {
            if (name === 'foo') {
              return { runtime: 'nodejs6.10' };
            }
            if (name === 'bar') {
              return { runtime: 'nodejs8.10', image: { name: 'fake-image-name' } };
            }
          })
        }
      };

      expect(Utils.getAllNodeFunctions.call({ serverless: mockServerless })).toEqual(['foo']);
    });
  });

  describe('isProviderGoogle', () => {
    describe('when the provider is set to "google"', () => {
      const mockServerless = {
        service: {
          provider: {
            name: 'google'
          }
        }
      };

      it('should return true', () => {
        expect(Utils.isProviderGoogle(mockServerless)).toBe(true);
      });
    });

    describe('when the provider is set to "aws"', () => {
      const mockServerless = {
        service: {
          provider: {
            name: 'aws'
          }
        }
      };

      it('should return false', () => {
        expect(Utils.isProviderGoogle(mockServerless)).toBe(false);
      });
    });
  });
});
