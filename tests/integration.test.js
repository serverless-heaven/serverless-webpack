'use strict';

const path = require('path');
const { expect } = require('chai');
const fs = require('fs');
const fse = require('fs-extra');
const spawn = require('child-process-ext/spawn');
const JSZip = require('jszip');

const serverlessExec = path.join(__dirname, '../node_modules/.bin/serverless');
const fixturesDir = path.resolve(__dirname, 'fixtures');
const fixturesEngine = require('@serverless/test/setup-fixtures-engine')(fixturesDir);

function listZipFiles(filename) {
  return new JSZip().loadAsync(fs.readFileSync(filename)).then(zip => Object.keys(zip.files));
}

describe('Integration test - Packaging', function () {
  this.timeout(1000 * 60 * 10); // Involves time-taking npm install

  // let runServerless;
  let serviceDir;
  let updateConfig;
  let serviceConfig;

  before(async () => {
    ({ servicePath: serviceDir, updateConfig, serviceConfig } = await fixturesEngine.setup('dummy-project'));
  });

  after(() => {
    if (serviceDir) {
      fse.emptyDirSync(serviceDir);
      fse.rmdirSync(serviceDir, { recursive: true });
    }
  });

  afterEach(() => {
    updateConfig({ plugins: null });
    fse.rmdirSync(`${serviceDir}/.serverless`, { recursive: true });
  });

  it('packages with a npm dep correctly in the zip', async () => {
    await spawn(serverlessExec, ['package'], { cwd: serviceDir });

    const zipfiles = await listZipFiles(path.join(serviceDir, `.serverless/${serviceConfig.service}.zip`));
    const nodeModules = new Set(zipfiles.filter(f => f.startsWith('node_modules')).map(f => f.split(path.sep)[1]));
    nodeModules.delete('');
    nodeModules.delete('.bin');
    nodeModules.delete('.package-lock.json');
    const nonNodeModulesFiles = zipfiles.filter(f => !f.startsWith('node_modules'));

    expect(Array.from(nodeModules)).to.deep.equal(['universalify']);
    expect(nonNodeModulesFiles).to.deep.equal(['handler.js', 'package-lock.json', 'package.json']);

    const files = fs.readdirSync(serviceDir);
    expect(files).not.to.include('.webpack');
  });

  it('packages with a npm dep correctly in the zip and keep .webpack folder', async () => {
    updateConfig({
      custom: {
        webpack: {
          keepOutputDirectory: true
        }
      }
    });

    await spawn(serverlessExec, ['package'], { cwd: serviceDir });

    const zipfiles = await listZipFiles(path.join(serviceDir, `.serverless/${serviceConfig.service}.zip`));
    const nodeModules = new Set(zipfiles.filter(f => f.startsWith('node_modules')).map(f => f.split(path.sep)[1]));
    nodeModules.delete('');
    nodeModules.delete('.bin');
    nodeModules.delete('.package-lock.json');
    const nonNodeModulesFiles = zipfiles.filter(f => !f.startsWith('node_modules'));

    expect(Array.from(nodeModules)).to.deep.equal(['universalify']);
    expect(nonNodeModulesFiles).to.deep.equal(['handler.js', 'package-lock.json', 'package.json', 'webpack.config.js']);

    const files = fs.readdirSync(serviceDir);
    console.log(files)
    expect(files).to.include('.webpack');
  });
});
