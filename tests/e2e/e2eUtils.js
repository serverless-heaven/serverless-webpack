'use strict';

const fse = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const provisionTmpDir = require('@serverless/test/provision-tmp-dir');
const originalRunServerless = require('@serverless/test/run-serverless');
const { spawnProcess } = require('../../lib/utils');

const FIXTURES_DIR = path.resolve(__dirname, '..', '..', 'examples');

async function replaceInFile(path, regex, replacement) {
  const content = await fse.readFile(path, 'utf8');
  const updatedContent = _.replace(String(content), regex, replacement);
  return fse.writeFile(path, updatedContent);
}

async function setupFixture(name) {
  const fixturePath = path.join(FIXTURES_DIR, name);
  const setupFixturePath = await provisionTmpDir();
  await fse.copy(fixturePath, setupFixturePath);

  const setupScriptPath = path.resolve(setupFixturePath, '_setup.js');
  await require(setupScriptPath)(fixturePath, setupFixturePath, { replaceInFile, spawnProcess });
  await fse.unlink(setupScriptPath);

  return setupFixturePath;
}

async function runServerless(options) {
  const runServerlessOptions = {
    command: 'package'
  };

  const servicePath = await setupFixture(options.fixture);

  runServerlessOptions.cwd = servicePath;
  const SERVERLESS_DIR = path.join(servicePath, 'node_modules', 'serverless');
  try {
    const result = await originalRunServerless(SERVERLESS_DIR, runServerlessOptions);
    result.servicePath = servicePath;
    return result;
  } catch (error) {
    error.servicePath = servicePath;
    throw error;
  }
}

module.exports = {
  setupFixture,
  runServerless
};
