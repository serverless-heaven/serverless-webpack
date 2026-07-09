const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const _ = require('lodash');
const { spawnProcess } = require('../../lib/utils');

const FIXTURES_DIR = path.resolve(__dirname, '..', '..', 'examples');
const PROJECT_DIR = path.resolve(__dirname, '..', '..');
let pluginPackagePathPromise;

async function replaceInFile(path, regex, replacement) {
  const content = await fs.promises.readFile(path, 'utf8');
  const updatedContent = _.replace(String(content), regex, replacement);
  return fs.promises.writeFile(path, updatedContent);
}

async function replaceInJson(path, updater) {
  const content = JSON.parse(await fs.promises.readFile(path, 'utf8'));
  const updatedContent = updater(content) || content;
  return fs.promises.writeFile(path, `${JSON.stringify(updatedContent, null, 2)}\n`);
}

async function setupFixture(name) {
  const fixturePath = path.join(FIXTURES_DIR, name);
  const setupFixturePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'serverless-webpack-'));
  const pluginPackagePath = await getPluginPackagePath();
  await fs.promises.cp(fixturePath, setupFixturePath, { recursive: true });

  const setupScriptPath = path.resolve(setupFixturePath, '_setup.js');
  await require(setupScriptPath)(fixturePath, setupFixturePath, {
    pluginPackagePath,
    replaceInJson,
    replaceInFile,
    spawnProcess
  });
  await fs.promises.unlink(setupScriptPath);

  return setupFixturePath;
}

async function getPluginPackagePath() {
  if (!pluginPackagePathPromise) {
    pluginPackagePathPromise = (async () => {
      const packageDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'serverless-webpack-'));
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
  const servicePath = await setupFixture(options.fixture);
  const cwd = path.join(servicePath, options.subproject || '');

  try {
    await spawnProcess('yarn', ['serverless', 'package'], { cwd });
    return cwd;
  } catch (error) {
    error.servicePath = servicePath;
    throw error;
  }
}

module.exports = {
  setupFixture,
  runServerless
};
