'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const childProcess = require('child_process');

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

/**
 * Remove the specified module from the require cache.
 * @param {string} moduleName
 */
function purgeCache(moduleName) {
  return searchAndProcessCache(moduleName, function (mod) {
    delete require.cache[mod.id];
  }).then(() => {
    _.forEach(_.keys(module.constructor._pathCache), function (cacheKey) {
      if (cacheKey.indexOf(moduleName) > 0) {
        delete module.constructor._pathCache[cacheKey];
      }
    });
    return BbPromise.resolve();
  });
}

function searchAndProcessCache(moduleName, processor) {
  let mod_src = require.resolve(moduleName);
  const visitedModules = [];
  if (mod_src && (mod_src = require.cache[mod_src]) !== undefined) {
    const modStack = [mod_src];

    while (!_.isEmpty(modStack)) {
      const mod = modStack.pop();
      if (!_.includes(visitedModules, mod)) {
        visitedModules.push(mod);
        Array.prototype.push.apply(modStack, mod.children);
        processor(mod);
      }
    }
  }
  return BbPromise.resolve();
}

class SpawnError extends Error {
  constructor(message, stdout, stderr) {
    super(message);
    this.stdout = stdout;
    this.stderr = stderr;
  }

  toString() {
    return `${this.message}\n${this.stderr}`;
  }
}

/**
 * Executes a child process without limitations on stdout and stderr.
 * On error (exit code is not 0), it rejects with a SpawnProcessError that contains the stdout and stderr streams,
 * on success it returns the streams in an object.
 * @param {string} command - Command
 * @param {string[]} [args] - Arguments
 * @param {Object} [options] - Options for child_process.spawn
 */
function spawnProcess(command, args, options) {
  return new BbPromise((resolve, reject) => {
    const child = childProcess.spawn(command, args, options);
    let stdout = '';
    let stderr = '';
    // Configure stream encodings
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    // Listen to stream events
    child.stdout.on('data', data => {
      stdout += data;
    });
    child.stderr.on('data', data => {
      stderr += data;
    });
    child.on('error', err => {
      reject(err);
    });
    child.on('close', exitCode => {
      if (exitCode !== 0) {
        reject(new SpawnError(`${command} ${_.join(args, ' ')} failed with code ${exitCode}`, stdout, stderr));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function splitLines(str) {
  return _.split(str, /\r?\n/);
}

function isNodeRuntime(runtime) {
  return runtime.match(/node/);
}

function getAllNodeFunctions() {
  const functions = this.serverless.service.getAllFunctions();

  return _.filter(functions, funcName => {
    const func = this.serverless.service.getFunction(funcName);

    // if `uri` is provided, it means the image isn't built by Serverless so we shouldn't take care of it
    if (func.image && func.image.uri) {
      return false;
    }

    return isNodeRuntime(func.runtime || this.serverless.service.provider.runtime || 'nodejs');
  });
}

module.exports = {
  guid,
  purgeCache,
  searchAndProcessCache,
  SpawnError,
  spawnProcess,
  safeJsonParse,
  splitLines,
  getAllNodeFunctions,
  isNodeRuntime
};
