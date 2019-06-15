'use strict';
/**
 * Unit tests for Configuration.
 */

const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');
const childProcess = require('child_process');
const Utils = require('./utils');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('Utils', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  after(() => {
    sandbox.restore();
  });

  describe('guid', () => {
    it('should return different unique ids', () => {
      const guids = [];
      for (let i = 0; i < 10; i++) {
        guids.push(Utils.guid());
      }

      expect(_.size(_.uniq(guids))).to.equal(10);
      expect(_.size(_.compact(guids))).to.equal(10);
    });
  });

  describe('SpawnError', () => {
    it('should store stdout and stderr', () => {
      const err = new Utils.SpawnError('message', 'stdout', 'stderr');
      expect(err)
        .to.have.a.property('message')
        .that.equals('message');
      expect(err)
        .to.have.a.property('stdout')
        .that.equals('stdout');
      expect(err)
        .to.have.a.property('stderr')
        .that.equals('stderr');
    });

    it('should print message and stderr', () => {
      const err = new Utils.SpawnError('message', 'stdout', 'stderr');

      expect(err.toString()).to.equal('message\nstderr');
    });
  });

  describe('spawnProcess', () => {
    const childMock = {
      stdout: {
        setEncoding: sinon.stub(),
        on: sinon.stub()
      },
      stderr: {
        setEncoding: sinon.stub(),
        on: sinon.stub()
      },
      on: sinon.stub()
    };

    beforeEach(() => {
      sandbox.stub(childProcess, 'spawn').returns(childMock);
    });

    afterEach(() => {
      childProcess.spawn.restore();
    });

    it('should call child_process.spawn', () => {
      childMock.on.reset();
      childMock.on.withArgs('close').yields(0);
      return expect(Utils.spawnProcess('cmd', [])).to.be.fulfilled.then(result => {
        expect(childProcess.spawn).to.have.been.calledOnce;
        expect(result).to.have.a.property('stdout').that.is.empty;
        expect(result).to.have.a.property('stderr').that.is.empty;
        return null;
      });
    });

    it('should return stdout and stderr', () => {
      childMock.stdout.on.withArgs('data').yields('myOutData');
      childMock.stderr.on.withArgs('data').yields('myErrData');
      childMock.on.reset();
      childMock.on.withArgs('close').yields(0);
      return expect(Utils.spawnProcess('cmd', [])).to.be.fulfilled.then(result => {
        expect(result)
          .to.have.a.property('stdout')
          .that.equals('myOutData');
        expect(result)
          .to.have.a.property('stderr')
          .that.equals('myErrData');
        return null;
      });
    });

    it('should reject on spawn internal error', () => {
      childMock.on.reset();
      childMock.on.withArgs('error').yields(new Error('spawn ENOENT'));
      return expect(Utils.spawnProcess('cmd', [])).to.be.rejectedWith('spawn ENOENT');
    });

    it('should reject on positive exit code', () => {
      childMock.on.reset();
      childMock.on.withArgs('close').yields(1);
      return expect(Utils.spawnProcess('cmd', [])).to.be.rejectedWith(Utils.SpawnError);
    });
  });
});
