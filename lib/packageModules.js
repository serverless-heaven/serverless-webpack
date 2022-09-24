'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const glob = require('glob');
const archiver = require('archiver');
const semver = require('semver');
const fs = require('fs');
const { getAllNodeFunctions, isProviderGoogle } = require('./utils');

function setArtifactPath(funcName, func, artifactPath) {
  const version = this.serverless.getVersion();

  if (this.log) {
    this.log.verbose(`Setting artifact for function '${funcName}' to '${artifactPath}'`);
  } else {
    this.options.verbose && this.serverless.cli.log(`Setting artifact for function '${funcName}' to '${artifactPath}'`);
  }

  // Serverless changed the artifact path location in version 1.18
  if (semver.lt(version, '1.18.0')) {
    func.artifact = artifactPath;
    func.package = _.assign({}, func.package, { disable: true });
    if (!this.log) {
      this.serverless.cli.log(`${funcName} is packaged by the webpack plugin. Ignore messages from SLS.`);
    }
  } else {
    func.package = {
      artifact: artifactPath
    };
  }
}

/**
 * Copy pasted from Serverless
 *
 * @see https://github.com/serverless/serverless/blob/63d54e1537e10ae63c171892edd886f6b81e83f6/lib/plugins/package/lib/zipService.js#L65
 */
function serverlessZip(args) {
  const { artifactFilePath, directory, files } = args;

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
                // necessary to get the same hash when zipping the same content
                // as well as `contents.sort` few lines above
                date: new Date(0)
              });
            }
          );

          return zip.finalize();
        })
        .catch(reject);
    });
  });
}

/**
 * Copy pasted from Serverless
 *
 * @see https://github.com/serverless/serverless/blob/63d54e1537e10ae63c171892edd886f6b81e83f6/lib/plugins/package/lib/zipService.js#L112
 */
function getFileContentAndStat(directory, filePath) {
  const fullPath = `${directory}/${filePath}`;

  return BbPromise.all([
    // Get file contents and stat in parallel
    fs.readFileAsync(fullPath),
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

function zip(directory, zipFileName) {
  // Check that files exist to be zipped
  let files = glob.sync('**', {
    cwd: directory,
    dot: true,
    silent: true,
    follow: true,
    nodir: true
  });

  // if excludeRegex option is defined, we'll have to list all files to be zipped
  // and then force the node way to zip to avoid hitting the arguments limit (ie: E2BIG)
  // when using the native way (ie: the zip command)
  if (this.configuration.excludeRegex) {
    const existingFilesLength = files.length;
    files = _.filter(files, f => f.match(this.configuration.excludeRegex) === null);

    if (this.log) {
      this.log.verbose(`Excluded ${existingFilesLength - files.length} file(s) based on excludeRegex`);
    } else {
      this.options.verbose &&
        this.serverless.cli.log(`Excluded ${existingFilesLength - files.length} file(s) based on excludeRegex`);
    }
  }

  if (_.isEmpty(files)) {
    const error = new this.serverless.classes.Error('Packaging: No files found');

    return BbPromise.reject(error);
  }

  // Create artifact in temp path and move it to the package path (if any) later
  // This allows us to persist the webpackOutputPath and re-use the compiled output
  const artifactFilePath = path.join(this.webpackOutputPath, zipFileName);
  this.serverless.utils.writeFileDir(artifactFilePath);

  return serverlessZip.call(this, {
    directory,
    artifactFilePath,
    files
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
    if (this.log) {
      this.log.verbose('[Webpack] Packaging modules');
      this.progress.get('webpack').notice('[Webpack] Packaging modules');
    }

    const stats = this.compileStats;

    return BbPromise.mapSeries(stats.stats, (compileStats, index) => {
      const entryFunction = _.get(this.entryFunctions, index, {});
      const filename = getArtifactName.call(this, entryFunction);
      const modulePath = compileStats.outputPath;

      const startZip = _.now();
      return zip.call(this, modulePath, filename).tap(() => {
        if (this.log) {
          this.log.verbose(
            `Zip ${_.isEmpty(entryFunction) ? 'service' : 'function'}: ${modulePath} [${_.now() - startZip} ms]`
          );
        } else {
          this.options.verbose &&
            this.serverless.cli.log(
              `Zip ${_.isEmpty(entryFunction) ? 'service' : 'function'}: ${modulePath} [${_.now() - startZip} ms]`
            );
        }
      });
    });
  },

  copyExistingArtifacts() {
    if (this.log) {
      this.log.verbose('[Webpack] Copying existing artifacts');
      this.progress.get('webpack').notice('[Webpack] Copying existing artifacts');
    } else {
      this.serverless.cli.log('Copying existing artifacts...');
    }
    // When invoked as a part of `deploy function`,
    // only function passed with `-f` flag should be processed.
    const functionNames = this.options.function ? [this.options.function] : getAllNodeFunctions.call(this);
    const serviceName = this.serverless.service.getServiceObject().name;
    const individualPackagingEnabled = isIndividualPackaging.call(this);
    const providerIsGoogle = isProviderGoogle(this.serverless);

    // Copy artifacts to package location
    if (individualPackagingEnabled) {
      _.forEach(functionNames, funcName => copyArtifactByName.call(this, funcName));
    } else {
      // Copy service packaged artifact
      copyArtifactByName.call(this, serviceName);
    }

    // Loop through every function and make sure that the correct artifact is assigned
    // (the one built by webpack)
    _.forEach(functionNames, funcName => {
      const func = this.serverless.service.getFunction(funcName);

      // When individual packaging is enabled, each functions gets it's own
      // artifact, otherwise every function gets set to the same artifact
      const archiveName = individualPackagingEnabled ? funcName : serviceName;

      const { serverlessArtifact } = getArtifactLocations.call(this, archiveName);
      setArtifactPath.call(this, funcName, func, serverlessArtifact);
    });

    // If we are deploying to 'google' we need to set an artifact for the whole service,
    // rather than for each function, so there is special case here
    if (!individualPackagingEnabled && providerIsGoogle) {
      const archiveName = serviceName;

      // This may look similar to the loop above, but note that this calls
      // setServiceArtifactPath rather than setArtifactPath
      const { serverlessArtifact } = getArtifactLocations.call(this, archiveName);
      setServiceArtifactPath.call(this, serverlessArtifact);
    }

    return BbPromise.resolve();
  }
};
