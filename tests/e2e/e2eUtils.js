const fse = require('fs-extra');
const path = require('node:path');
const _ = require('lodash');
const provisionTmpDir = require('@serverless/test/provision-tmp-dir');
const originalRunServerless = require('@serverless/test/run-serverless');
const { spawnProcess } = require('../../lib/utils');

const FIXTURES_DIR = path.resolve(__dirname, '..', '..', 'examples');
const PROJECT_DIR = path.resolve(__dirname, '..', '..');
let pluginPackagePathPromise;

async function replaceInFile(path, regex, replacement) {
  const content = await fse.readFile(path, 'utf8');
  const updatedContent = _.replace(String(content), regex, replacement);
  return fse.writeFile(path, updatedContent);
}

async function replaceInJson(path, updater) {
  const content = await fse.readJson(path);
  const updatedContent = updater(content) || content;
  return fse.writeJson(path, updatedContent, { spaces: 2 });
}

async function setupFixture(name) {
  const fixturePath = path.join(FIXTURES_DIR, name);
  const setupFixturePath = await provisionTmpDir();
  const pluginPackagePath = await getPluginPackagePath();
  await fse.copy(fixturePath, setupFixturePath);

  const setupScriptPath = path.resolve(setupFixturePath, '_setup.js');
  await require(setupScriptPath)(fixturePath, setupFixturePath, {
    pluginPackagePath,
    replaceInJson,
    replaceInFile,
    spawnProcess
  });
  await fse.unlink(setupScriptPath);

  return setupFixturePath;
}

async function getPluginPackagePath() {
  if (!pluginPackagePathPromise) {
    pluginPackagePathPromise = (async () => {
      const packageDir = await provisionTmpDir();
      const npmCommand = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';
      const { stdout } = await spawnProcess(
        npmCommand,
        ['pack', '--pack-destination', packageDir, '--cache', path.join(packageDir, '.npm-cache')],
        { cwd: PROJECT_DIR }
      );
      const packageFile = stdout.trim().split(/\r?\n/).pop();
      const packagePath = path.isAbsolute(packageFile) ? packageFile : path.join(packageDir, packageFile);

      return packagePath.replace(/\\/g, '/');
    })();
    pluginPackagePathPromise.catch(() => {
      pluginPackagePathPromise = undefined;
    });
  }

  return pluginPackagePathPromise;
}

async function runServerless(options) {
  const runServerlessOptions = {
    command: 'package'
  };

  const servicePath = await setupFixture(options.fixture);
  runServerlessOptions.cwd = path.join(servicePath, options.subproject || '');

  try {
    if (options.useSpawnProcess) {
      await spawnProcess('yarn', ['serverless', 'package'], { cwd: servicePath });
    } else {
      await originalRunServerless(path.join(servicePath, 'node_modules', 'serverless'), runServerlessOptions);
    }

    return runServerlessOptions.cwd;
  } catch (error) {
    error.servicePath = servicePath;
    throw error;
  }
}

module.exports = {
  setupFixture,
  runServerless
};
