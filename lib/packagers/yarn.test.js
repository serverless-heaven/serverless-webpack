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

    it('should use flat option', () => {
      childProcessMock.exec.yields(null, 'installed successfully', '');
      return expect(yarnModule.install('myPath', 2000, { flat: true })).to.be.fulfilled
      .then(result => {
        expect(result).to.be.undefined;
        expect(childProcessMock.exec).to.have.been.calledOnce;
        expect(childProcessMock.exec).to.have.been.calledWithExactly(
          'yarn install --frozen-lockfile --non-interactive --flat',
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

});