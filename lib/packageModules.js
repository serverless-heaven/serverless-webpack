'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');
const glob = require('glob');
const semver = require('semver');

function setArtifactPath(funcName, func, artifactPath) {
  const version = this.serverless.getVersion();

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
  const zip = archiver.create('zip');
  // Create artifact in temp path and move it to the package path (if any) later
  const artifactFilePath = path.join(this.serverless.config.servicePath, '.serverless', name);
  this.serverless.utils.writeFileDir(artifactFilePath);

  const output = fs.createWriteStream(artifactFilePath);

  const files = glob.sync('**', {
    cwd: directory,
    dot: true,
    silent: true,
    follow: true
  });

  if (_.isEmpty(files)) {
    const error = new this.serverless.classes.Error('Packaging: No files found');
    return BbPromise.reject(error);
  }

  output.on('open', () => {
    zip.pipe(output);

    _.forEach(files, filePath => {
      const fullPath = path.resolve(directory, filePath);

      const stats = fs.statSync(fullPath);

      if (!stats.isDirectory(fullPath)) {
        zip.append(fs.readFileSync(fullPath), {
          name: filePath,
          mode: stats.mode,
          date: new Date(0) // necessary to get the same hash when zipping the same content
        });
      }
    });

    zip.finalize();
  });

  return new BbPromise((resolve, reject) => {
    output.on('close', () => resolve(artifactFilePath));
    zip.on('error', err => reject(err));
  });
}

module.exports = {
  packageModules() {
    const stats = this.compileStats;

    return BbPromise.mapSeries(stats.stats, (compileStats, index) => {
      const entryFunction = _.get(this.entryFunctions, index, {});
      const filename = `${entryFunction.funcName || this.serverless.service.getServiceObject().name}.zip`;
      const modulePath = compileStats.compilation.compiler.outputPath;

      const startZip = _.now();
      return zip
        .call(this, modulePath, filename)
        .tap(
          () =>
            this.options.verbose &&
            this.serverless.cli.log(
              `Zip ${_.isEmpty(entryFunction) ? 'service' : 'function'}: ${modulePath} [${_.now() - startZip} ms]`
            )
        )
        .then(artifactPath => {
          if (_.get(this.serverless, 'service.package.individually')) {
            setArtifactPath.call(
              this,
              entryFunction.funcName,
              entryFunction.func,
              path.relative(this.serverless.config.servicePath, artifactPath)
            );
          }
          return artifactPath;
        });
    }).then(artifacts => {
      if (!_.get(this.serverless, 'service.package.individually') && !_.isEmpty(artifacts)) {
        // Set the service artifact to all functions
        const allFunctionNames = this.serverless.service.getAllFunctions();
        _.forEach(allFunctionNames, funcName => {
          const func = this.serverless.service.getFunction(funcName);
          setArtifactPath.call(this, funcName, func, path.relative(this.serverless.config.servicePath, artifacts[0]));
        });
        // For Google set the service artifact path
        if (_.get(this.serverless, 'service.provider.name') === 'google') {
          _.set(
            this.serverless,
            'service.package.artifact',
            path.relative(this.serverless.config.servicePath, artifacts[0])
          );
        }
      }

      return null;
    });
  }
};
