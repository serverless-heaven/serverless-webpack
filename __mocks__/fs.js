/**
 * Mock object for fs
 */

const streamMock = {
  on: jest.fn()
};

const statMock = {
  isDirectory: jest.fn(),
  mode: 0o644
};

const actual = jest.requireActual('fs');

module.exports = {
  ...actual,
  createWriteStream: jest.fn().mockReturnValue(streamMock),
  readFile: jest.fn((_path, callback) => callback(null, Buffer.from('mock file'))),
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
  rmSync: jest.fn(),
  stat: jest.fn((_path, callback) => callback(null, statMock)),
  statSync: jest.fn().mockReturnValue(statMock),
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn(),
  promises: {
    access: jest.fn().mockRejectedValue(new Error('ENOENT')),
    cp: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('mock file'),
    rm: jest.fn().mockResolvedValue(),
    unlink: jest.fn().mockResolvedValue(),
    writeFile: jest.fn().mockResolvedValue()
  },

  _streamMock: streamMock,
  _statMock: statMock
};
