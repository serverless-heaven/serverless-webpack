const path = require('path');
const stream = require('stream');
const fs = require('fs');
const unzipper = require('unzipper');
const chai = require('chai');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

const setupRunServerless = require('@serverless/test/setup-run-serverless-fixtures-engine');

const FIXTURES_DIR = path.resolve(__dirname, '..', '..', 'examples');

const runServerless = setupRunServerless({
  fixturesDir: FIXTURES_DIR,
  serverlessDir: path.dirname(require.resolve('serverless/package.json'))
});

async function unzipArtefacts(archivePath) {
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
  it('should support include-external-npm-packages example', async () => {
    const result = await runServerless({
      fixture: 'include-external-npm-packages',
      command: 'package',
      configExt: {
        plugins: {
          apiName: 'test-api-name',
          stackTags: {
            key: 'value'
          }
        }
      }
    });

    const name = result.fixtureData.serviceConfig.service;
    const outputDir = path.join(result.fixtureData.servicePath, '.serverless');
    const archivePath = path.join(outputDir, `${name}.zip`);
    const files = await unzipArtefacts(archivePath);

    expect(files.node_modules).to.equal(true);
    expect(JSON.parse(files['package.json'])).to.deep.equal({
      name,
      version: '1.0.0',
      description: `Packaged externals for ${name}`,
      private: true,
      scripts: {},
      dependencies: {
        fbgraph: '^1.4.4'
      }
    });
    expect(files['handler.js']).to.not.be.empty;
  }).timeout(60_000);

  it('should support include-external-npm-packages-lock-file example', async () => {
    const result = await runServerless({
      fixture: 'include-external-npm-packages-lock-file',
      command: 'package',
      configExt: {
        plugins: {
          apiName: 'test-api-name',
          stackTags: {
            key: 'value'
          }
        }
      }
    });

    const name = result.fixtureData.serviceConfig.service;
    const outputDir = path.join(result.fixtureData.servicePath, '.serverless');
    const archivePath = path.join(outputDir, `${name}.zip`);
    const files = await unzipArtefacts(archivePath);

    // fbgraph is not included because of tree-shaking
    expect(JSON.parse(files['package.json'])).to.deep.equal({
      name,
      version: '1.0.0',
      description: `Packaged externals for ${name}`,
      private: true,
      scripts: {},
      dependencies: {
        // We should use fix version to respect lock file
        lodash: '^4.17.21'
      }
    });
    expect(files['handler.js']).to.not.be.empty;
    expect(files.node_modules).to.equal(true);
  }).timeout(60_000);
});
