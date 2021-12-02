'use strict';

const path = require('path');
const os = require('os');
const { expect } = require('chai');
const fs = require('fs');
const fse = require('fs-extra');
const spawn = require('child-process-ext/spawn');
const JSZip = require('jszip');
const yaml = require('js-yaml');

const serverlessExec = path.join(__dirname, '../node_modules/.bin/serverless');

function listZipFiles(filename) {
  return new JSZip().loadAsync(fs.readFileSync(filename)).then(zip => Object.keys(zip.files));
}

describe('Integration test - Packaging', function () {
  this.timeout(5 * 60 * 1000);
  let cwd;
  let defaultServerlessConfig;

  before(async () => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'tmpdirs-serverless-webpack-'));

    await fse.copy(path.join(__dirname, 'dummy-project'), cwd);
    await spawn('npm', ['i'], { cwd });

    defaultServerlessConfig = yaml.load(fs.readFileSync(path.join(__dirname, 'dummy-project/serverless.yml'), 'utf8'));
  });

  after(() => {
    if (cwd) {
      fs.rmdirSync(cwd, { recursive: true });
    }
  });

  it('packages the default aws template with an npm dep correctly in the zip', async () => {
    await spawn(serverlessExec, ['package'], { cwd });

    const zipfiles = await listZipFiles(path.join(cwd, '.serverless/aws-nodejs.zip'));
    const nodeModules = new Set(zipfiles.filter(f => f.startsWith('node_modules')).map(f => f.split(path.sep)[1]));
    nodeModules.delete('');
    nodeModules.delete('.package-lock.json');
    const nonNodeModulesFiles = zipfiles.filter(f => !f.startsWith('node_modules'));

    expect(Array.from(nodeModules)).to.deep.equal(['universalify']);
    expect(nonNodeModulesFiles).to.deep.equal([ 'handler.js', 'package-lock.json', 'package.json' ]);

    const files = fs.readdirSync(cwd);
    expect(files).not.to.include('.webpack');
  });

  it('packages the default aws template with an npm dep correctly in the zip and keep .webpack folder', async () => {
    const serverlessConfig = {
      ...defaultServerlessConfig
    };
    serverlessConfig.custom.webpack.keepOutputDirectory = true;

    fs.writeFileSync(path.join(cwd, 'serverless.yml'), yaml.dump(serverlessConfig));

    await spawn(serverlessExec, ['package'], { cwd });

    const zipfiles = await listZipFiles(path.join(cwd, '.serverless/aws-nodejs.zip'));
    const nodeModules = new Set(zipfiles.filter(f => f.startsWith('node_modules')).map(f => f.split(path.sep)[1]));
    nodeModules.delete('');
    nodeModules.delete('.package-lock.json');
    const nonNodeModulesFiles = zipfiles.filter(f => !f.startsWith('node_modules'));

    expect(Array.from(nodeModules)).to.deep.equal(['universalify']);
    expect(nonNodeModulesFiles).to.deep.equal([ 'handler.js', 'package-lock.json', 'package.json' ]);

    const files = fs.readdirSync(cwd);
    expect(files).to.include('.webpack');
  });
});
