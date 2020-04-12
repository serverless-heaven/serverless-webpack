'use strict';
/**
 * Unit tests for packagers/npm
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const Utils = require('../utils');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('npm', () => {
  let sandbox;
  let npmModule;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise.Promise);

    sandbox.stub(Utils, 'spawnProcess');
    npmModule = require('./npm');
  });

  after(() => {
    sandbox.restore();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should return "package-lock.json" as lockfile name', () => {
    expect(npmModule.lockfileName).to.equal('package-lock.json');
  });

  it('should return no packager sections', () => {
    expect(npmModule.copyPackageSectionNames).to.be.an('array').that.is.empty;
  });

  it('requires to copy modules', () => {
    expect(npmModule.mustCopyModules).to.be.true;
  });

  describe('install', () => {
    it('should use npm install', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(npmModule.install('myPath')).to.be.fulfilled.then(result => {
        expect(result).to.be.undefined;
        expect(Utils.spawnProcess).to.have.been.calledOnce;
        expect(Utils.spawnProcess).to.have.been.calledWithExactly(sinon.match(/^npm/), ['install'], {
          cwd: 'myPath'
        });
        return null;
      });
    });
  });

  describe('prune', () => {
    it('should use npm prune', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: 'success', stderr: '' }));
      return expect(npmModule.prune('myPath')).to.be.fulfilled.then(result => {
        expect(result).to.be.undefined;
        expect(Utils.spawnProcess).to.have.been.calledOnce;
        expect(Utils.spawnProcess).to.have.been.calledWithExactly(sinon.match(/^npm/), ['prune'], {
          cwd: 'myPath'
        });
        return null;
      });
    });
  });

  describe('runScripts', () => {
    it('should use npm run for the given scripts', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: 'success', stderr: '' }));
      return expect(npmModule.runScripts('myPath', [ 's1', 's2' ])).to.be.fulfilled.then(result => {
        expect(result).to.be.undefined;
        expect(Utils.spawnProcess).to.have.been.calledTwice;
        expect(Utils.spawnProcess.firstCall).to.have.been.calledWithExactly(sinon.match(/^npm/), [ 'run', 's1' ], {
          cwd: 'myPath'
        });
        expect(Utils.spawnProcess.secondCall).to.have.been.calledWithExactly(sinon.match(/^npm/), [ 'run', 's2' ], {
          cwd: 'myPath'
        });
        return null;
      });
    });
  });

  describe('getProdDependencies', () => {
    it('should use npm ls', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: '{}', stderr: '' }));
      return expect(npmModule.getProdDependencies('myPath', 10)).to.be.fulfilled.then(result => {
        expect(result).to.be.an('object').that.is.empty;
        expect(Utils.spawnProcess).to.have.been.calledOnce,
        expect(Utils.spawnProcess.firstCall).to.have.been.calledWith(sinon.match(/^npm/), [
          'ls',
          '-prod',
          '-json',
          '-depth=10'
        ]);
        return null;
      });
    });

    it('should default to depth 1', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: '{}', stderr: '' }));
      return expect(npmModule.getProdDependencies('myPath')).to.be.fulfilled.then(result => {
        expect(result).to.be.an('object').that.is.empty;
        expect(Utils.spawnProcess).to.have.been.calledOnce,
        expect(Utils.spawnProcess.firstCall).to.have.been.calledWith(sinon.match(/^npm/), [
          'ls',
          '-prod',
          '-json',
          '-depth=1'
        ]);
        return null;
      });
    });
  });

  it('should reject if npm returns critical and minor errors', () => {
    const stderr =
      'ENOENT: No such file\nnpm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon\n\n';
    Utils.spawnProcess.returns(BbPromise.reject(new Utils.SpawnError('Command execution failed', '{}', stderr)));
    return expect(npmModule.getProdDependencies('myPath', 1))
      .to.be.rejectedWith('Command execution failed')
      .then(() =>
        BbPromise.all([
          // npm ls and npm prune should have been called
          expect(Utils.spawnProcess).to.have.been.calledOnce,
          expect(Utils.spawnProcess.firstCall).to.have.been.calledWith(sinon.match(/^npm/), [
            'ls',
            '-prod',
            '-json',
            '-depth=1'
          ])
        ])
      );
  });

  it('should reject if an error happens without any information in stdout', () => {
    Utils.spawnProcess.returns(BbPromise.reject(new Utils.SpawnError('Command execution failed', '', '')));
    return expect(npmModule.getProdDependencies('myPath', 1))
      .to.be.rejectedWith('Command execution failed')
      .then(() =>
        BbPromise.all([
          // npm ls and npm prune should have been called
          expect(Utils.spawnProcess).to.have.been.calledOnce,
          expect(Utils.spawnProcess.firstCall).to.have.been.calledWith(sinon.match(/^npm/), [
            'ls',
            '-prod',
            '-json',
            '-depth=1'
          ])
        ])
      );
  });

  it('should ignore minor local NPM errors and log them', () => {
    const stderr = _.join(
      [
        'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
        'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
        'npm ERR! peer dep missing: sinon@2.3.8'
      ],
      '\n'
    );
    const lsResult = {
      version: '1.0.0',
      problems: [
        'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
        'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
        'npm ERR! peer dep missing: sinon@2.3.8'
      ],
      dependencies: {
        '@scoped/vendor': '1.0.0',
        uuid: '^5.4.1',
        bluebird: '^3.4.0'
      }
    };

    Utils.spawnProcess.returns(
      BbPromise.reject(new Utils.SpawnError('Command execution failed', JSON.stringify(lsResult), stderr))
    );
    return expect(npmModule.getProdDependencies('myPath', 1)).to.be.fulfilled.then(dependencies =>
      BbPromise.all([
        // npm ls and npm prune should have been called
        expect(Utils.spawnProcess).to.have.been.calledOnce,
        expect(Utils.spawnProcess.firstCall).to.have.been.calledWith(sinon.match(/^npm/), [
          'ls',
          '-prod',
          '-json',
          '-depth=1'
        ]),
        expect(dependencies).to.deep.equal(lsResult)
      ])
    );
  });

  it('should rebase lock file references', () => {
    const expectedLocalModule = 'file:../../locals/../../mymodule';
    const fakePackageLockJSON = {
      name: 'test-service',
      version: '1.0.0',
      description: 'Packaged externals for test-service',
      private: true,
      dependencies: {
        '@scoped/vendor': '1.0.0',
        uuid: {
          version: '^5.4.1'
        },
        bluebird: {
          version: '^3.4.0'
        },
        localmodule: {
          version: 'file:../../mymodule'
        }
      }
    };
    const expectedPackageLockJSON = {
      name: 'test-service',
      version: '1.0.0',
      description: 'Packaged externals for test-service',
      private: true,
      dependencies: {
        '@scoped/vendor': '1.0.0',
        uuid: {
          version: '^5.4.1'
        },
        bluebird: {
          version: '^3.4.0'
        },
        localmodule: {
          version: expectedLocalModule
        }
      }
    };

    npmModule.rebaseLockfile('../../locals', fakePackageLockJSON);
    expect(fakePackageLockJSON).to.deep.equal(expectedPackageLockJSON);
  });
});
