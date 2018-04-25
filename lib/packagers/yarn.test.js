'use strict';
/**
 * Unit tests for packagers/yarn
 */

const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const Utils = require('../utils');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('yarn', () => {
  let sandbox;
  let yarnModule;

  before(() => {
    sandbox = sinon.sandbox.create();
    sandbox.usingPromise(BbPromise.Promise);

    sandbox.stub(Utils, 'spawnProcess');
    yarnModule = require('./yarn');
  });

  after(() => {
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
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: '{}', stderr: '' }));
      return expect(yarnModule.getProdDependencies('myPath', 1)).to.be.fulfilled
      .then(result => {
        expect(result).to.be.an('object');
        expect(Utils.spawnProcess).to.have.been.calledOnce,
        expect(Utils.spawnProcess.firstCall).to.have.been.calledWith(
          sinon.match(/^yarn/),
          [ 'list', '--depth=1', '--json', '--production' ],
          { cwd: 'myPath' }
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
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: testYarnResult, stderr: '' }));
      return expect(yarnModule.getProdDependencies('myPath', 1)).to.be.fulfilled
      .then(result => {
        expect(result).to.deep.equal(expectedResult);
        return null;
      });
    });

    it('should reject on critical yarn errors', () => {
      Utils.spawnProcess.returns(BbPromise.reject(new Utils.SpawnError('Exited with code 1', '', 'Yarn failed.\nerror Could not find module.')));
      return expect(yarnModule.getProdDependencies('myPath', 1)).to.be.rejectedWith('Exited with code 1');
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
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(yarnModule.install('myPath', {})).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(Utils.spawnProcess).to.have.been.calledOnce;
        expect(Utils.spawnProcess).to.have.been.calledWithExactly(
          sinon.match(/^yarn/),
          [ 'install', '--frozen-lockfile', '--non-interactive' ],
          {
            cwd: 'myPath'
          }
        );
        return null;
      });
    });

    it('should use ignoreScripts option', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(yarnModule.install('myPath', { ignoreScripts: true })).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(Utils.spawnProcess).to.have.been.calledOnce;
        expect(Utils.spawnProcess).to.have.been.calledWithExactly(
          sinon.match(/^yarn/),
          [ 'install', '--frozen-lockfile', '--non-interactive', '--ignore-scripts' ],
          {
            cwd: 'myPath'
          }
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
      return expect(yarnModule.prune('myPath', {})).to.be.fulfilled
      .then(() => {
        expect(installStub).to.have.been.calledOnce;
        expect(installStub).to.have.been.calledWithExactly('myPath', {});
        return null;
      });
    });
  });

  describe('runScripts', () => {
    it('should use yarn run for the given scripts', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: 'success', stderr: '' }));
      return expect(yarnModule.runScripts('myPath', [ 's1', 's2' ])).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(Utils.spawnProcess).to.have.been.calledTwice;
        expect(Utils.spawnProcess.firstCall).to.have.been.calledWithExactly(
          sinon.match(/^yarn/),
          [ 'run', 's1' ],
          {
            cwd: 'myPath'
          }
        );
        expect(Utils.spawnProcess.secondCall).to.have.been.calledWithExactly(
          sinon.match(/^yarn/),
          [ 'run', 's2' ],
          {
            cwd: 'myPath'
          }
        );
        return null;
      });
    });
  });

});