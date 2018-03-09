'use strict';
/**
 * Unit tests for packagers/yarn
 */

const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');

// Mocks
const childProcessMockFactory = require('../../tests/mocks/child_process.mock');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('yarn', () => {
  let sandbox;
  let yarnModule;

  // Mocks
  let childProcessMock;

  before(() => {
    sandbox = sinon.sandbox.create();
    sandbox.usingPromise(BbPromise.Promise);

    childProcessMock = childProcessMockFactory.create(sandbox);

    mockery.enable({ useCleanCache: true, warnOnUnregistered: false });
    mockery.registerMock('child_process', childProcessMock);
    yarnModule = require('./yarn');
  });

  after(() => {
    mockery.disable();
    mockery.deregisterAll();

    sandbox.restore();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should return "yarn.lock" as lockfile name', () => {
    expect(yarnModule.lockfileName).to.equal('yarn.lock');
  });

  it('does not require to copy modules', () => {
    expect(yarnModule.mustCopyModules).to.be.false;
  });

  describe('getProdDependencies', () => {
    it('should use yarn list', () => {
      childProcessMock.exec.yields(null, '{}', '');
      return expect(yarnModule.getProdDependencies('myPath', 1, 2000)).to.be.fulfilled
      .then(result => {
        expect(result).to.be.an('object');
        expect(childProcessMock.exec).to.have.been.calledOnce;
        expect(childProcessMock.exec).to.have.been.calledWithExactly(
          'yarn list --depth=1 --json --production',
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

    it('should transform yarn trees to npm dependencies', () => {
      const testYarnResult = `{"type":"tree","data":{"type":"list","trees":[
        {"name":"archiver@2.1.1","children":[],"hint":null,"color":"bold",
        "depth":0},{"name":"bluebird@3.5.1","children":[],"hint":null,"color":
        "bold","depth":0},{"name":"fs-extra@4.0.3","children":[],"hint":null,
        "color":"bold","depth":0},{"name":"mkdirp@0.5.1","children":[{"name":
        "minimist@0.0.8","children":[],"hint":null,"color":"bold","depth":0}],
        "hint":null,"color":null,"depth":0},{"name":"@sls/webpack@1.0.0", 
        "children":[],"hint":null,"color":"bold","depth":0}]}}`;
      const expectedResult = {
        problems: [],
        dependencies: {
          archiver: {
            version: '2.1.1',
            dependencies: {}
          },
          bluebird: {
            version: '3.5.1',
            dependencies: {}
          },
          'fs-extra': {
            version: '4.0.3',
            dependencies: {}
          },
          mkdirp: {
            version: '0.5.1',
            dependencies: {
              minimist: {
                version: '0.0.8',
                dependencies: {}
              }
            }
          },
          '@sls/webpack': {
            version: '1.0.0',
            dependencies: {}
          },
        }
      };
      childProcessMock.exec.yields(null, testYarnResult, '');
      return expect(yarnModule.getProdDependencies('myPath', 1, 2000)).to.be.fulfilled
      .then(result => {
        expect(result).to.deep.equal(expectedResult);
        return null;
      });
    });

    it('should reject on critical yarn errors', () => {
      childProcessMock.exec.yields(new Error('Exited with code 1'), '', 'Yarn failed.\nerror Could not find module.');
      return expect(yarnModule.getProdDependencies('myPath', 1, 2000)).to.be.rejectedWith('Exited with code 1');
    });

  });

  describe('rebaseLockfile', () => {
    it('should return the original lockfile', () => {
      const testContent = 'eugfogfoigqwoeifgoqwhhacvaisvciuviwefvc';
      const testContent2 = 'eugfogfoigqwoeifgoqwhhacvaisvciuviwefvc';
      yarnModule.rebaseLockfile('.', testContent);
      expect(testContent).to.equal(testContent2);
    });
  });

  describe('install', () => {
    it('should use yarn install', () => {
      childProcessMock.exec.yields(null, 'installed successfully', '');
      return expect(yarnModule.install('myPath', 2000, {})).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(childProcessMock.exec).to.have.been.calledOnce;
        expect(childProcessMock.exec).to.have.been.calledWithExactly(
          'yarn install --frozen-lockfile --non-interactive',
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

    it('should use ignoreScripts option', () => {
      childProcessMock.exec.yields(null, 'installed successfully', '');
      return expect(yarnModule.install('myPath', 2000, { ignoreScripts: true })).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(childProcessMock.exec).to.have.been.calledOnce;
        expect(childProcessMock.exec).to.have.been.calledWithExactly(
          'yarn install --frozen-lockfile --non-interactive --ignore-scripts',
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
    let installStub;

    before(() => {
      installStub = sandbox.stub(yarnModule, 'install').returns(BbPromise.resolve());
    });

    after(() => {
      installStub.restore();
    });

    it('should call install', () => {
      return expect(yarnModule.prune('myPath', 2000, {})).to.be.fulfilled
      .then(() => {
        expect(installStub).to.have.been.calledOnce;
        expect(installStub).to.have.been.calledWithExactly('myPath', 2000, {});
        return null;
      });
    });
  });

  describe('runScripts', () => {
    it('should use yarn run for the given scripts', () => {
      childProcessMock.exec.yields(null, 'success', '');
      return expect(yarnModule.runScripts('myPath', 2000, [ 's1', 's2' ])).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(childProcessMock.exec).to.have.been.calledTwice;
        expect(childProcessMock.exec.firstCall).to.have.been.calledWithExactly(
          'yarn run s1',
          {
            cwd: 'myPath',
            encoding: 'utf8',
            maxBuffer: 2000
          },
          sinon.match.any
        );
        expect(childProcessMock.exec.secondCall).to.have.been.calledWithExactly(
          'yarn run s2',
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

});