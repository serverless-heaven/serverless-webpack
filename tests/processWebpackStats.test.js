'use strict';

const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');

const processWebpackStats = require('../lib/processWebpackStats');

class ChunkMock {
  constructor(modules) {
    this.modules = modules;
    this._modules = modules;
  }

  get modulesIterable() {
    return this._modules;
  }
}

class ChunkMockNoModulesIterable {
  constructor(modules) {
    this._modules = modules;
  }
}

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('processsWebpackStats', () => {
  describe('processsWebpackStats()', () => {
    it('should get errors from normalized json stats', () => {
      const testOutputPath = '/my/Service/Path/.webpack/service';
      const testCliOutput = 'out';
      const testError = {
        test: 'foo'
      };
      const jsonStats = {
        errors: [testError],
        outputPath: testOutputPath
      };
      const testStats = {
        compilation: {
          chunks: [
            new ChunkMock([
              {
                identifier: _.constant('"crypto"')
              }
            ]),
            new ChunkMockNoModulesIterable([])
          ],
          compiler: {
            outputPath: testOutputPath
          }
        },

        toJson: sinon.stub().returns(jsonStats),
        toString: sinon.stub().returns(testCliOutput)
      };
      const testConsoleOptions = 'minimal';
      const stats = processWebpackStats.processWebpackStats(testStats, testConsoleOptions);

      sinon.assert.calledWithExactly(testStats.toJson, 'normal');
      expect(stats).to.eql({
        cliOutput: testCliOutput,
        outputPath: testOutputPath,
        errors: [testError],
        externalModules: []
      });
    });

    it('should get cliOutput as stringified stats with console options', () => {
      const testOutputPath = '/my/Service/Path/.webpack/service';
      const testCliOutput = 'out';
      const jsonStats = {
        errors: [],
        outputPath: testOutputPath
      };
      const testStats = {
        compilation: {
          chunks: [
            new ChunkMock([
              {
                identifier: _.constant('"crypto"')
              }
            ]),
            new ChunkMockNoModulesIterable([])
          ],
          compiler: {
            outputPath: testOutputPath
          }
        },

        toJson: sinon.stub().returns(jsonStats),
        toString: sinon.stub().returns(testCliOutput)
      };
      const testConsoleOptions = 'minimal';
      const stats = processWebpackStats.processWebpackStats(testStats, testConsoleOptions);

      sinon.assert.calledWithExactly(testStats.toString, testConsoleOptions);
      expect(stats).to.eql({
        cliOutput: testCliOutput,
        outputPath: testOutputPath,
        errors: [],
        externalModules: []
      });
    });
    it('should convert chunks to external modules', () => {
      const testOutputPath = '/my/Service/Path/.webpack/service';
      const testCliOutput = 'out';
      const jsonStats = {
        errors: [],
        outputPath: testOutputPath
      };
      const testStats = {
        compilation: {
          chunks: [
            new ChunkMock([
              {
                identifier: _.constant('"crypto"')
              },
              {
                identifier: _.constant('"uuid/v4"')
              },
              {
                identifier: _.constant('"mockery"')
              },
              {
                identifier: _.constant('"@scoped/vendor/module1"')
              },
              {
                identifier: _.constant('external "@scoped/vendor/module2"')
              },
              {
                identifier: _.constant('external "uuid/v4"')
              },
              {
                identifier: _.constant('external "bluebird"')
              }
            ]),
            new ChunkMockNoModulesIterable([])
          ],
          compiler: {
            outputPath: testOutputPath
          }
        },

        toJson: sinon.stub().returns(jsonStats),
        toString: sinon.stub().returns(testCliOutput)
      };
      const testConsoleOptions = 'minimal';
      const stats = processWebpackStats.processWebpackStats(testStats, testConsoleOptions);

      expect(stats).to.eql({
        cliOutput: testCliOutput,
        outputPath: testOutputPath,
        errors: [],
        externalModules: [
          {
            external: '@scoped/vendor',
            origin: undefined
          },
          {
            external: 'uuid',
            origin: undefined
          },
          {
            external: 'bluebird',
            origin: undefined
          }
        ]
      });
    });

    it('should convert chunks with no externals', () => {
      const testOutputPath = '/my/Service/Path/.webpack/service';
      const testCliOutput = 'out';
      const jsonStats = {
        errors: [],
        outputPath: testOutputPath
      };
      const testNoExtStats = {
        compilation: {
          chunks: [
            new ChunkMock([
              {
                identifier: _.constant('"crypto"')
              },
              {
                identifier: _.constant('"uuid/v4"')
              },
              {
                identifier: _.constant('"mockery"')
              },
              {
                identifier: _.constant('"@scoped/vendor/module1"')
              }
            ])
          ],
          compiler: {
            outputPath: testOutputPath
          }
        },

        toJson: sinon.stub().returns(jsonStats),
        toString: sinon.stub().returns(testCliOutput)
      };

      const testConsoleOptions = 'minimal';
      const stats = processWebpackStats.processWebpackStats(testNoExtStats, testConsoleOptions);

      expect(stats).to.eql({
        cliOutput: testCliOutput,
        outputPath: testOutputPath,
        errors: [],
        externalModules: []
      });
    });

    it('should convert chunks with stats file ref', () => {
      const testOutputPath = '/my/Service/Path/.webpack/service';
      const testCliOutput = 'out';
      const jsonStats = {
        errors: [],
        outputPath: testOutputPath
      };
      const testStatsWithFileRef = {
        compilation: {
          chunks: [
            new ChunkMock([
              {
                identifier: _.constant('"crypto"')
              },
              {
                identifier: _.constant('"uuid/v4"')
              },
              {
                identifier: _.constant('"mockery"')
              },
              {
                identifier: _.constant('"@scoped/vendor/module1"')
              },
              {
                identifier: _.constant('external "@scoped/vendor/module2"')
              },
              {
                identifier: _.constant('external "uuid/v4"')
              },
              {
                identifier: _.constant('external "localmodule"')
              },
              {
                identifier: _.constant('external "bluebird"')
              }
            ])
          ],
          compiler: {
            outputPath: testOutputPath
          }
        },

        toJson: sinon.stub().returns(jsonStats),
        toString: sinon.stub().returns(testCliOutput)
      };
      const testConsoleOptions = 'minimal';
      const stats = processWebpackStats.processWebpackStats(testStatsWithFileRef, testConsoleOptions);

      expect(stats).to.eql({
        cliOutput: testCliOutput,
        outputPath: testOutputPath,
        errors: [],
        externalModules: [
          {
            external: '@scoped/vendor',
            origin: undefined
          },
          {
            external: 'uuid',
            origin: undefined
          },
          {
            external: 'localmodule',
            origin: undefined
          },
          {
            external: 'bluebird',
            origin: undefined
          }
        ]
      });
    });

    it('should convert chunks with stats dev dependency', () => {
      const testOutputPath = '/my/Service/Path/.webpack/service';
      const testCliOutput = 'out';
      const jsonStats = {
        errors: [],
        outputPath: testOutputPath
      };
      const testStatsWithDevDependency = {
        compilation: {
          chunks: [
            new ChunkMock([
              {
                identifier: _.constant('"crypto"')
              },
              {
                identifier: _.constant('"uuid/v4"')
              },
              {
                identifier: _.constant('external "eslint"')
              },
              {
                identifier: _.constant('"mockery"')
              },
              {
                identifier: _.constant('"@scoped/vendor/module1"')
              },
              {
                identifier: _.constant('external "@scoped/vendor/module2"')
              },
              {
                identifier: _.constant('external "uuid/v4"')
              },
              {
                identifier: _.constant('external "localmodule"')
              },
              {
                identifier: _.constant('external "bluebird"')
              }
            ])
          ],
          compiler: {
            outputPath: '/my/Service/Path/.webpack/service'
          }
        },

        toJson: sinon.stub().returns(jsonStats),
        toString: sinon.stub().returns(testCliOutput)
      };
      const testConsoleOptions = 'minimal';
      const stats = processWebpackStats.processWebpackStats(testStatsWithDevDependency, testConsoleOptions);

      expect(stats).to.eql({
        cliOutput: testCliOutput,
        outputPath: testOutputPath,
        errors: [],
        externalModules: [
          {
            external: 'eslint',
            origin: undefined
          },
          {
            external: '@scoped/vendor',
            origin: undefined
          },
          {
            external: 'uuid',
            origin: undefined
          },
          {
            external: 'localmodule',
            origin: undefined
          },
          {
            external: 'bluebird',
            origin: undefined
          }
        ]
      });
    });

    it('should convert chunks with stats ignored dev dependency', () => {
      const testOutputPath = '/my/Service/Path/.webpack/service';
      const testCliOutput = 'out';
      const jsonStats = {
        errors: [],
        outputPath: testOutputPath
      };
      const testStatsWithIgnoredDevDependency = {
        compilation: {
          chunks: [
            new ChunkMock([
              {
                identifier: _.constant('"crypto"')
              },
              {
                identifier: _.constant('"uuid/v4"')
              },
              {
                identifier: _.constant('"mockery"')
              },
              {
                identifier: _.constant('"@scoped/vendor/module1"')
              },
              {
                identifier: _.constant('external "@scoped/vendor/module2"')
              },
              {
                identifier: _.constant('external "uuid/v4"')
              },
              {
                identifier: _.constant('external "localmodule"')
              },
              {
                identifier: _.constant('external "bluebird"')
              },
              {
                identifier: _.constant('external "aws-sdk"')
              }
            ])
          ],
          compiler: {
            outputPath: '/my/Service/Path/.webpack/service'
          }
        },

        toJson: sinon.stub().returns(jsonStats),
        toString: sinon.stub().returns(testCliOutput)
      };
      const testConsoleOptions = 'minimal';
      const stats = processWebpackStats.processWebpackStats(testStatsWithIgnoredDevDependency, testConsoleOptions);

      expect(stats).to.eql({
        cliOutput: testCliOutput,
        outputPath: testOutputPath,
        errors: [],
        externalModules: [
          {
            external: '@scoped/vendor',
            origin: undefined
          },
          {
            external: 'uuid',
            origin: undefined
          },
          {
            external: 'localmodule',
            origin: undefined
          },
          {
            external: 'bluebird',
            origin: undefined
          },
          {
            external: 'aws-sdk',
            origin: undefined
          }
        ]
      });
    });

    it('should convert chunks with peer dependencies', () => {
      const testOutputPath = '/my/Service/Path/.webpack/service';
      const testCliOutput = 'out';
      const jsonStats = {
        errors: [],
        outputPath: testOutputPath
      };
      const testStatsPeerDep = {
        compilation: {
          chunks: [
            new ChunkMock([
              {
                identifier: _.constant('"crypto"')
              },
              {
                identifier: _.constant('"uuid/v4"')
              },
              {
                identifier: _.constant('"mockery"')
              },
              {
                identifier: _.constant('"@scoped/vendor/module1"')
              },
              {
                identifier: _.constant('external "bluebird"')
              },
              {
                identifier: _.constant('external "request-promise"')
              }
            ])
          ],
          compiler: {
            outputPath: '/my/Service/Path/.webpack/service'
          }
        },

        toJson: sinon.stub().returns(jsonStats),
        toString: sinon.stub().returns(testCliOutput)
      };
      const testConsoleOptions = 'minimal';
      const stats = processWebpackStats.processWebpackStats(testStatsPeerDep, testConsoleOptions);

      expect(stats).to.eql({
        cliOutput: testCliOutput,
        outputPath: testOutputPath,
        errors: [],
        externalModules: [
          {
            external: 'bluebird',
            origin: undefined
          },
          {
            external: 'request-promise',
            origin: undefined
          }
        ]
      });
    });
  });
});
