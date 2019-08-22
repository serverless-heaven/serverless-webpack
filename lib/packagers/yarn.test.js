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
    sandbox = sinon.createSandbox();
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

  it('should return packager sections', () => {
    expect(yarnModule.copyPackageSectionNames).to.deep.equal(['resolutions']);
  });

  it('does not require to copy modules', () => {
    expect(yarnModule.mustCopyModules).to.be.false;
  });

  describe('getProdDependencies', () => {
    it('should use yarn list', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: '{}', stderr: '' }));
      return expect(yarnModule.getProdDependencies('myPath', 1)).to.be.fulfilled.then(result => {
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
          }
        }
      };
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: testYarnResult, stderr: '' }));
      return expect(yarnModule.getProdDependencies('myPath', 1)).to.be.fulfilled.then(result => {
        expect(result).to.deep.equal(expectedResult);
        return null;
      });
    });

    it('should reject on critical yarn errors', () => {
      Utils.spawnProcess.returns(
        BbPromise.reject(new Utils.SpawnError('Exited with code 1', '', 'Yarn failed.\nerror Could not find module.'))
      );
      return expect(yarnModule.getProdDependencies('myPath', 1)).to.be.rejectedWith('Exited with code 1');
    });
  });

  describe('rebaseLockfile', () => {
    it('should return the original lockfile', () => {
      const testContent = 'eugfogfoigqwoeifgoqwhhacvaisvciuviwefvc';
      const testContent2 = 'eugfogfoigqwoeifgoqwhhacvaisvciuviwefvc';
      expect(yarnModule.rebaseLockfile('.', testContent)).to.equal(testContent2);
    });

    it('should rebase file references', () => {
      const testContent = `
      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"
    
      acorn@^3.0.4:
        version "3.3.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"
      
      otherModule@file:../../otherModule/the-new-version:
        version "1.2.0"

      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"

      "@myCompany/myModule@../../myModule/the-new-version":
        version "6.1.0"
        dependencies:
          aws-xray-sdk "^1.1.6"
          aws4 "^1.6.0"
          base-x "^3.0.3"
          bluebird "^3.5.1"
          chalk "^1.1.3"
          cls-bluebird "^2.1.0"
          continuation-local-storage "^3.2.1"
          lodash "^4.17.4"
          moment "^2.20.0"
          redis "^2.8.0"
          request "^2.83.0"
          ulid "^0.1.0"
          uuid "^3.1.0"
    
        acorn@^5.0.0, acorn@^5.5.0:
          version "5.5.3"
          resolved "https://registry.yarnpkg.com/acorn/-/acorn-5.5.3.tgz#f473dd47e0277a08e28e9bec5aeeb04751f0b8c9"
      `;

      const expectedContent = `
      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"
    
      acorn@^3.0.4:
        version "3.3.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"
      
      otherModule@file:../../project/../../otherModule/the-new-version:
        version "1.2.0"

      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"

      "@myCompany/myModule@../../project/../../myModule/the-new-version":
        version "6.1.0"
        dependencies:
          aws-xray-sdk "^1.1.6"
          aws4 "^1.6.0"
          base-x "^3.0.3"
          bluebird "^3.5.1"
          chalk "^1.1.3"
          cls-bluebird "^2.1.0"
          continuation-local-storage "^3.2.1"
          lodash "^4.17.4"
          moment "^2.20.0"
          redis "^2.8.0"
          request "^2.83.0"
          ulid "^0.1.0"
          uuid "^3.1.0"
    
        acorn@^5.0.0, acorn@^5.5.0:
          version "5.5.3"
          resolved "https://registry.yarnpkg.com/acorn/-/acorn-5.5.3.tgz#f473dd47e0277a08e28e9bec5aeeb04751f0b8c9"
      `;

      expect(yarnModule.rebaseLockfile('../../project', testContent)).to.equal(expectedContent);
    });
  });

  describe('install', () => {
    it('should use yarn install', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: 'installed successfully', stderr: '' }));
      return expect(yarnModule.install('myPath', {})).to.be.fulfilled.then(result => {
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
      return expect(yarnModule.install('myPath', { ignoreScripts: true })).to.be.fulfilled.then(result => {
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
      return expect(yarnModule.prune('myPath', {})).to.be.fulfilled.then(() => {
        expect(installStub).to.have.been.calledOnce;
        expect(installStub).to.have.been.calledWithExactly('myPath', {});
        return null;
      });
    });
  });

  describe('runScripts', () => {
    it('should use yarn run for the given scripts', () => {
      Utils.spawnProcess.returns(BbPromise.resolve({ stdout: 'success', stderr: '' }));
      return expect(yarnModule.runScripts('myPath', [ 's1', 's2' ])).to.be.fulfilled.then(result => {
        expect(result).to.be.undefined;
        expect(Utils.spawnProcess).to.have.been.calledTwice;
        expect(Utils.spawnProcess.firstCall).to.have.been.calledWithExactly(sinon.match(/^yarn/), [ 'run', 's1' ], {
          cwd: 'myPath'
        });
        expect(Utils.spawnProcess.secondCall).to.have.been.calledWithExactly(sinon.match(/^yarn/), [ 'run', 's2' ], {
          cwd: 'myPath'
        });
        return null;
      });
    });
  });
});
