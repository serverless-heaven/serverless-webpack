'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const path = require('path');
const Serverless = require('serverless');

// Mocks
const fsMockFactory = require('../tests/mocks/fs.mock');
const mockery = require('mockery');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('compileStats', () => {
  let baseModule;
  let module;
  let sandbox;
  let serverless;
  let fsMock;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise.Promise);

    fsMock = fsMockFactory.create(sandbox);

    mockery.enable({ warnOnUnregistered: false });
    mockery.registerMock('fs', fsMock);

    baseModule = require('./compileStats');
    Object.freeze(baseModule);
  });

  beforeEach(() => {
    serverless = new Serverless();
    serverless.cli = {
      log: sandbox.stub()
    };
    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );
  });

  afterEach(() => {
    fsMock.writeFileSync.reset();
    fsMock.readFileSync.reset();
    mockery.disable();
    mockery.deregisterAll();
    sandbox.restore();
  });

  describe('get', () => {
    it('should return this.stats if available', () => {
      const stats = { stats: [{}] };
      module.stats = stats;

      const result = module.get();

      expect(result).to.equal(stats);
    });

    it('should load stats from file if this.stats is not present', () => {
      const webpackOutputPath = '.webpack';

      const statsFile = { stats: [{ outputPath: 'service/path' }] };
      const mappedFile = { stats: [{ outputPath: path.resolve(webpackOutputPath, 'service', 'path') }] };
      module.webpackOutputPath = webpackOutputPath;

      const fullStatsPath = path.join(webpackOutputPath, 'stats.json');

      fsMock.readFileSync.withArgs(fullStatsPath).returns(JSON.stringify(statsFile));

      const stats = module.get();

      expect(fsMock.readFileSync).to.be.calledWith(fullStatsPath);
      expect(stats).to.deep.equal(mappedFile);
    });

    it('should fail if compile stats are not loaded', () => {
      const webpackOutputPath = '.webpack';

      const statsFile = { stats: [] };

      module.webpackOutputPath = webpackOutputPath;

      const fullStatsPath = path.join(webpackOutputPath, 'stats.json');

      fsMock.readFileSync.withArgs(fullStatsPath).returns(JSON.stringify(statsFile));

      expect(() => module.get()).to.throw(/Packaging: No stats information found/);
    });
  });

  describe('save', () => {
    it('should set this.stats', () => {
      const webpackOutputPath = '.webpack';
      module.webpackOutputPath = webpackOutputPath;

      const stats = { stats: [{ toJson: () => ({ outputPath: '.webpack/service/path' }) }] };

      module.save(stats);

      expect(module.stats).to.equal(stats);
    });

    it('should write stats to a file', () => {
      const webpackOutputPath = '/tmp/.webpack';
      module.webpackOutputPath = webpackOutputPath;

      const stats = { stats: [{ toJson: () => ({ outputPath: '/tmp/.webpack/service/path' }) }] };

      const fullStatsPath = path.join(webpackOutputPath, 'stats.json');

      const fileContent = JSON.stringify({ stats: [{ outputPath: path.join('service', 'path') }] }, null, 2);

      module.save(stats);

      expect(fsMock.writeFileSync).to.be.calledWith(fullStatsPath, fileContent);
    });
  });
});
