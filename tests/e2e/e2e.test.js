const path = require('path');
const stream = require('stream');
const fs = require('fs');
const unzipper = require('unzipper');
const { runServerless } = require('./e2eUtils');
const semver = require('semver');
const pkg = require('../../package.json');
const _ = require('lodash');

// unmock global modules
jest.unmock('bestzip');
jest.unmock('fs-extra');
jest.unmock('fs');
jest.unmock('glob');
jest.unmock('webpack');

const slsVersion = semver.parse(pkg.dependencies.serverless);
const slsMajor = slsVersion ? slsVersion.major : 3;
const nodeVersion = semver.parse(process.version);
const isWin = /^win/.test(process.platform);

async function unzipArtifacts(archivePath) {
  const files = {};

  await new Promise((resolve, reject) => {
    fs.createReadStream(archivePath)
      .pipe(unzipper.Parse())
      .pipe(
        stream.Transform({
          objectMode: true,
          transform: async function (entry, e, cb) {
            if (entry.path.startsWith('node_modules/')) {
              files.node_modules = true;
              entry.autodrain();
              cb();
              return;
            }

            if (entry.type === 'Directory') {
              files[entry.path] = true;
              entry.autodrain();
              cb();
              return;
            }

            const content = await entry.buffer();
            files[entry.path] = String(content);
            entry.autodrain();
            cb();
          }
        })
      )
      .on('error', reject)
      .on('finish', resolve);
  });

  return files;
}

describe('end-to-end testing', () => {
  if (nodeVersion.major < 12 || slsMajor !== 3 || isWin) {
    // Serverless v3 doesn't support node 10
    // We have an issue with Windows e2e tests
    it.skip('should support include-external-npm-packages example', _.noop);
  } else {
    it('should support include-external-npm-packages example', async () => {
      const fixture = 'include-external-npm-packages';
      const result = await runServerless({ fixture });

      const outputDir = path.join(result.servicePath, '.serverless');
      const archivePath = path.join(outputDir, `${fixture}.zip`);
      const files = await unzipArtifacts(archivePath);

      expect(files.node_modules).toEqual(true);
      expect(JSON.parse(files['package.json'])).toEqual({
        name: fixture,
        version: '1.0.0',
        description: `Packaged externals for ${fixture}`,
        private: true,
        scripts: {},
        dependencies: {
          fbgraph: '^1.4.4'
        }
      });
      expect(files['handler.js']).not.toHaveLength(0);
    }, 300000);
  }

  // lock-file v2 is supported by Node16+
  // We have an issue with Windows e2e tests
  if (nodeVersion.major < 16 || slsMajor !== 3 || isWin) {
    it.skip('should support include-external-npm-packages-lock-file example', _.noop);
  } else {
    it('should support include-external-npm-packages-lock-file example', async () => {
      const fixture = 'include-external-npm-packages-lock-file';
      const result = await runServerless({ fixture });

      const outputDir = path.join(result.servicePath, '.serverless');
      const archivePath = path.join(outputDir, `${fixture}.zip`);
      const files = await unzipArtifacts(archivePath);

      // fbgraph is not included because of tree-shaking
      expect(JSON.parse(files['package.json'])).toEqual({
        name: fixture,
        version: '1.0.0',
        description: `Packaged externals for ${fixture}`,
        private: true,
        scripts: {},
        dependencies: {
          // We should use fix version to respect lock file
          dotenv: '^16.0.0',
          fbgraph: '^1.4.4',
          lodash: '^4.17.21',
          'lodash.isequal': '^4.5.0'
        }
      });
      expect(files['handler.js']).not.toHaveLength(0);
      expect(files.node_modules).toEqual(true);
    }, 300000);
  }
});
