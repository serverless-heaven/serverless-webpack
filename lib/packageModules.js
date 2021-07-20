'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const { nativeZip, hasNativeZip } = require('bestzip');
const glob = require('glob');
const archiver = require('archiver');
const semver = require('semver');
const fs = require('fs');
const { getAllNodeFunctions } = require('./utils');

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

function getZipMethod() {
  if (this.configuration.tryNativeZip && hasNativeZip()) {
    if (this.options.verbose) {
      this.serverless.cli.log("Using native zip - note that this will break serverless' change detection");
    }
    return nativeZip;
  }
  if (this.options.verbose) {
    this.serverless.cli.log("Using serverless' zip method");
  }
  return serverlessZip.bind(this);
}

function serverlessZip(args) {
  const artifactFilePath = args.artifactFilePath;
  const directory = args.directory;
  const files = args.files;

  const zip = archiver.create('zip');
  const output = fs.createWriteStream(artifactFilePath);
  return new BbPromise((resolve, reject) => {
    output.on('close', () => resolve(artifactFilePath));
    output.on('error', err => reject(err));
    zip.on('error', err => reject(err));

    output.on('open', () => {
      zip.pipe(output);

      // normalize both maps to avoid problems with e.g. Path Separators in different shells
      const normalizedFiles = _.uniq(_.map(files, file => path.normalize(file)));

      BbPromise.all(_.map(normalizedFiles, file => getFileContentAndStat.call(this, directory, file)))
        .then(contents => {
          _.forEach(
            contents.sort((content1, content2) => content1.filePath.localeCompare(content2.filePath)),
            file => {
              const name = file.filePath;
              // Ensure file is executable if it is locally executable or
              // we force it to be executable if platform is windows
              const mode = file.stat.mode & 0o100 || process.platform === 'win32' ? 0o755 : 0o644;
              zip.append(file.data, {
                name,
                mode,
                date: new Date(0) // necessary to get the same hash when zipping the same content
              });
            }
          );

          return zip.finalize();
        })
        .catch(reject);
    });
  });
}

function getFileContentAndStat(directory, filePath) {
  const fullPath = `${directory}/${filePath}`;
  return BbPromise.all([
    // Get file contents and stat in parallel
    getFileContent(fullPath),
    fs.statAsync(fullPath)
  ]).then(
    result => ({
      data: result[0],
      stat: result[1],
      filePath
    }),
    error => {
      throw new this.serverless.classes.Error(
        `Cannot read file ${filePath} due to: ${error.message}`,
        'CANNOT_READ_FILE'
      );
    }
  );
}

function getFileContent(fullPath) {
  return fs.readFileAsync(fullPath);
}

function zip(directory, name) {
  // Check that files exist to be zipped
  let files = glob.sync('**', {
    cwd: directory,
    dot: true,
    silent: true,
    follow: true,
    nodir: true
  });

  let zipMethod = getZipMethod.call(this);

  // if excludeRegex option is defined, we'll have to list all files to be zipped
  // and then force the node way to zip to avoid hitting the arguments limit (ie: E2BIG)
  // when using the native way (ie: the zip command)
  if (this.configuration.excludeRegex) {
    const existingFilesLength = files.length;
    files = _.filter(files, f => f.match(this.configuration.excludeRegex) === null);

    if (this.options.verbose) {
      this.serverless.cli.log(`Excluded ${existingFilesLength - files.length} file(s) based on excludeRegex`);
    }

    zipMethod = serverlessZip;
  }

  if (_.isEmpty(files)) {
    const error = new this.serverless.classes.Error('Packaging: No files found');

    return BbPromise.reject(error);
  }

  // Create artifact in temp path and move it to the package path (if any) later
  // This allows us to persist the webpackOutputPath and re-use the compiled output
  const artifactFilePath = path.join(this.webpackOutputPath, name);
  this.serverless.utils.writeFileDir(artifactFilePath);

  let zipArgs;
  if (zipMethod === nativeZip) {
    zipArgs = {
      source: './',
      cwd: directory,
      destination: path.relative(directory, artifactFilePath)
    };
  } else {
    zipArgs = {
      artifactFilePath,
      directory,
      files
    };
  }

  return new BbPromise((resolve, reject) => {
    zipMethod(zipArgs)
      .then(() => {
        resolve(artifactFilePath);

        this.options.verbose &&
          this.serverless.cli.log(`Zip method used: ${zipMethod.name === 'nodeZip' ? 'node' : 'native'}`);

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

function isIndividualPackaging() {
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
      const modulePath = compileStats.outputPath;

      const startZip = _.now();
      return zip
        .call(this, modulePath, filename)
        .tap(
          () =>
            this.options.verbose &&
            this.serverless.cli.log(
              `Zip ${_.isEmpty(entryFunction) ? 'service' : 'function'}: ${modulePath} [${_.now() - startZip} ms]`
            )
        );
    });
  },

  copyExistingArtifacts() {
    this.serverless.cli.log('Copying existing artifacts...');
    // When invoked as a part of `deploy function`,
    // only function passed with `-f` flag should be processed.
    const functionNames = this.options.function ? [this.options.function] : getAllNodeFunctions.call(this);

    // Copy artifacts to package location
    if (isIndividualPackaging.call(this)) {
      _.forEach(functionNames, funcName => copyArtifactByName.call(this, funcName));
    } else {
      // Copy service packaged artifact
      const serviceName = this.serverless.service.getServiceObject().name;
      copyArtifactByName.call(this, serviceName);
    }

    _.forEach(functionNames, funcName => {
      const func = this.serverless.service.getFunction(funcName);

      const archiveName = isIndividualPackaging.call(this) ? funcName : this.serverless.service.getServiceObject().name;

      const { serverlessArtifact } = getArtifactLocations.call(this, archiveName);
      setArtifactPath.call(this, funcName, func, serverlessArtifact);
    });

    // Set artifact locations
    if (isIndividualPackaging.call(this)) {
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
