'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const { bestzip, hasNativeZip } = require('bestzip');
const glob = require('glob');
const semver = require('semver');
const fs = require('fs');

function setArtifactPath(funcName, func, artifactPath) {
  const version = this.serverless.getVersion();

  this.options.verbose && this.serverless.cli.log(`Setting artifact for function '${funcName}' to '${artifactPath}'`);

  // Serverless changed the artifact path location in version 1.18
  if (semver.lt(version, '1.18.0')) {
    func.artifact = artifactPath;
    func.package = _.assign({}, func.package, { disable: true });
    this.serverless.cli.log(`${funcName} is packaged by the webpack plugin. Ignore messages from SLS.`);
  } else {
    func.package = {
      artifact: artifactPath
    };
  }
}

function zip(directory, name) {
  // Check that files exist to be zipped
  const globFiles = glob.sync('**', {
    cwd: directory,
    dot: true,
    silent: true,
    follow: true,
    nodir: true
  });

  let files = globFiles;
  if (this.configuration.excludeRegex) {
    files = _.filter(globFiles, f => f.match(this.configuration.excludeRegex) === null);

    if (this.options.verbose) {
      this.serverless.cli.log(`Excluded ${globFiles.length - files.length} file(s) based on excludeRegex`);
    }
  }

  if (_.isEmpty(files)) {
    const error = new this.serverless.classes.Error('Packaging: No files found');

    return BbPromise.reject(error);
  }

  // Create artifact in temp path and move it to the package path (if any) later
  // This allows us to persist the webpackOutputPath and re-use the compiled output
  const artifactFilePath = path.join(this.webpackOutputPath, name);
  this.serverless.utils.writeFileDir(artifactFilePath);

  const zipArgs = {
    source: files,
    cwd: directory,
    destination: path.relative(directory, artifactFilePath)
  };

  return new BbPromise((resolve, reject) => {
    bestzip(zipArgs)
      .then(() => {
        resolve(artifactFilePath);
        return null;
      })
      .catch(err => {
        reject(err);
      });
  });
}

function getArtifactLocations(name) {
  const archiveName = `${name}.zip`;

  const webpackArtifact = path.join(this.webpackOutputPath, archiveName);
  const serverlessArtifact = path.join('.serverless', archiveName);

  return { webpackArtifact, serverlessArtifact };
}

function copyArtifactByName(artifactName) {
  const { webpackArtifact, serverlessArtifact } = getArtifactLocations.call(this, artifactName);

  // Make sure the destination dir exists
  this.serverless.utils.writeFileDir(serverlessArtifact);

  fs.copyFileSync(webpackArtifact, serverlessArtifact);
}

function setServiceArtifactPath(artifactPath) {
  _.set(this.serverless, 'service.package.artifact', artifactPath);
}

function isIndividialPackaging() {
  return _.get(this.serverless, 'service.package.individually');
}

function getArtifactName(entryFunction) {
  return `${entryFunction.funcName || this.serverless.service.getServiceObject().name}.zip`;
}

module.exports = {
  packageModules() {
    if (this.skipCompile) {
      return BbPromise.resolve();
    }

    const stats = this.compileStats;

    return BbPromise.mapSeries(stats.stats, (compileStats, index) => {
      const entryFunction = _.get(this.entryFunctions, index, {});
      const filename = getArtifactName.call(this, entryFunction);
      const modulePath = compileStats.compilation.compiler.outputPath;

      const startZip = _.now();
      return zip
        .call(this, modulePath, filename)
        .tap(
          () =>
            this.options.verbose &&
            this.serverless.cli.log(
              `Zip ${_.isEmpty(entryFunction) ? 'service' : 'function'} (using ${
                hasNativeZip() ? 'native' : 'node'
              } method): ${modulePath} [${_.now() - startZip} ms]`
            )
        );
    });
  },

  copyExistingArtifacts() {
    this.serverless.cli.log('Copying existing artifacts...');
    // When invoked as a part of `deploy function`,
    // only function passed with `-f` flag should be processed.
    const functionNames = this.options.function ? [this.options.function] : this.serverless.service.getAllFunctions();

    // Copy artifacts to package location
    if (isIndividialPackaging.call(this)) {
      _.forEach(functionNames, funcName => copyArtifactByName.call(this, funcName));
    } else {
      // Copy service packaged artifact
      const serviceName = this.serverless.service.getServiceObject().name;
      copyArtifactByName.call(this, serviceName);
    }

    _.forEach(functionNames, funcName => {
      const func = this.serverless.service.getFunction(funcName);

      const archiveName = isIndividialPackaging.call(this) ? funcName : this.serverless.service.getServiceObject().name;

      const { serverlessArtifact } = getArtifactLocations.call(this, archiveName);
      setArtifactPath.call(this, funcName, func, serverlessArtifact);
    });

    // Set artifact locations
    if (isIndividialPackaging.call(this)) {
      _.forEach(functionNames, funcName => {
        const func = this.serverless.service.getFunction(funcName);

        const archiveName = funcName;

        const { serverlessArtifact } = getArtifactLocations.call(this, archiveName);
        setArtifactPath.call(this, funcName, func, serverlessArtifact);
      });
    } else {
      const archiveName = this.serverless.service.getServiceObject().name;

      const { serverlessArtifact } = getArtifactLocations.call(this, archiveName);

      if (_.get(this.serverless, 'service.provider.name') === 'google') {
        setServiceArtifactPath.call(this, serverlessArtifact);
      }
    }

    return BbPromise.resolve();
  }
};
