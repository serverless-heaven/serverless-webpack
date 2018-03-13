'use strict';
/**
 * Unit tests for packagers/npm
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');

// Mocks
const childProcessMockFactory = require('../../tests/mocks/child_process.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('npm', () => {
  let sandbox;
  let npmModule;

  // Mocks
  let childProcessMock;

  before(() => {
    sandbox = sinon.sandbox.create();
    sandbox.usingPromise(BbPromise.Promise);

    childProcessMock = childProcessMockFactory.create(sandbox);

    mockery.enable({ useCleanCache: true, warnOnUnregistered: false });
    mockery.registerMock('child_process', childProcessMock);
    npmModule = require('./npm');
  });

  after(() => {
    mockery.disable();
    mockery.deregisterAll();

    sandbox.restore();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should return "package-lock.json" as lockfile name', () => {
    expect(npmModule.lockfileName).to.equal('package-lock.json');
  });

  it('requires to copy modules', () => {
    expect(npmModule.mustCopyModules).to.be.true;
  });

  describe('install', () => {
    it('should use npm install', () => {
      childProcessMock.exec.yields(null, 'installed successfully', '');
      return expect(npmModule.install('myPath', 2000)).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(childProcessMock.exec).to.have.been.calledOnce;
        expect(childProcessMock.exec).to.have.been.calledWithExactly(
          'npm install',
          {
            cwd: 'myPath',
            encoding: 'utf8',
            maxBuffer: 2000
          },
          sinon.match.any
        );
        return null;
      });
    });
  });

  describe('prune', () => {
    it('should use npm prune', () => {
      childProcessMock.exec.yields(null, 'success', '');
      return expect(npmModule.prune('myPath', 2000)).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(childProcessMock.exec).to.have.been.calledOnce;
        expect(childProcessMock.exec).to.have.been.calledWithExactly(
          'npm prune',
          {
            cwd: 'myPath',
            encoding: 'utf8',
            maxBuffer: 2000
          },
          sinon.match.any
        );
        return null;
      });
    });
  });

  describe('runScripts', () => {
    it('should use npm run for the given scripts', () => {
      childProcessMock.exec.yields(null, 'success', '');
      return expect(npmModule.runScripts('myPath', 2000, [ 's1', 's2' ])).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(childProcessMock.exec).to.have.been.calledTwice;
        expect(childProcessMock.exec.firstCall).to.have.been.calledWithExactly(
          'npm run s1',
          {
            cwd: 'myPath',
            encoding: 'utf8',
            maxBuffer: 2000
          },
          sinon.match.any
        );
        expect(childProcessMock.exec.secondCall).to.have.been.calledWithExactly(
          'npm run s2',
          {
            cwd: 'myPath',
            encoding: 'utf8',
            maxBuffer: 2000
          },
          sinon.match.any
        );
        return null;
      });
    });
  });

  describe('getProdDependencies', () => {
    it('should use npm ls', () => {
      childProcessMock.exec.yields(null, '{}', '');
      return expect(npmModule.getProdDependencies('myPath', 10, 2000)).to.be.fulfilled
      .then(result => {
        expect(result).to.be.an('object').that.is.empty;
        expect(childProcessMock.exec).to.have.been.calledOnce,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=10'
        );
        return null;
      });
    });

    it('should default to depth 1', () => {
      childProcessMock.exec.yields(null, '{}', '');
      return expect(npmModule.getProdDependencies('myPath')).to.be.fulfilled
      .then(result => {
        expect(result).to.be.an('object').that.is.empty;
        expect(childProcessMock.exec).to.have.been.calledOnce,
        expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
          'npm ls -prod -json -depth=1'
        );
        return null;
      });
    });
  });

  it('should reject if npm returns critical and minor errors', () => {
    const stderr = 'ENOENT: No such file\nnpm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon\n\n';
    childProcessMock.exec.yields(new Error('something went wrong'), '{}', stderr);
    return expect(npmModule.getProdDependencies('myPath', 1)).to.be.rejectedWith('something went wrong')
    .then(() => BbPromise.all([
      // npm ls and npm prune should have been called
      expect(childProcessMock.exec).to.have.been.calledOnce,
      expect(childProcessMock.exec.firstCall).to.have.been.calledWith(
        'npm ls -prod -json -depth=1'
      ),
    ]));
  });

  it('should ignore minor local NPM errors and log them', () => {
    const stderr = _.join(
      [
        'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
        'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
        'npm ERR! peer dep missing: sinon@2.3.8',
      ],
      '\n'
    );
    const lsResult = {
      version: '1.0.0',
      problems: [
        'npm ERR! extraneous: sinon@2.3.8 ./babel-dynamically-entries/node_modules/serverless-webpack/node_modules/sinon',
        'npm ERR! missing: internalpackage-1@1.0.0, required by internalpackage-2@1.0.0',
        'npm ERR! peer dep missing: sinon@2.3.8',
      ],
      dependencies: {
        '@scoped/vendor': '1.0.0',
        uuid: '^5.4.1',
        bluebird: '^3.4.0'
      }
    };

    childProcessMock.exec.yields(new Error('NPM error'), JSON.stringify(lsResult), stderr);
    return expect(npmModule.getProdDependencies('myPath', 1)).to.be.fulfilled
    .then(dependencies => BbPromise.all([
      // npm ls and npm prune should have been called
      expect(childProcessMock.exec).to.have.been.calledOnce,
      expect(childProcessMock.exec).to.have.been.calledWith(
        'npm ls -prod -json -depth=1'
      ),
      expect(dependencies).to.deep.equal(lsResult),
    ]));
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
