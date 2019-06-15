'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const Serverless = require('serverless');
const path = require('path');
const Utils = require('./utils');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('prepareLocalInvoke', () => {
  let serverless;
  let baseModule;
  let module;
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(BbPromise.Promise);

    baseModule = require('./prepareLocalInvoke');
    Object.freeze(baseModule);
  });

  beforeEach(() => {
    serverless = new Serverless();
    serverless.cli = {
      log: sandbox.stub()
    };
    _.set(serverless, 'config.serverless.processedInput.options', {
      path: './event.json'
    });

    sandbox.stub(Utils, 'purgeCache');
    sandbox.stub(process, 'chdir');
    sandbox.stub(serverless.service, 'getFunction');

    module = _.assign(
      {
        serverless,
        options: {}
      },
      baseModule
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should store original service path', () => {
    module.serverless.service.package = {};
    module.serverless.service.getFunction.returns({ handler: 'myFuncHandler' });
    module.webpackOutputPath = '.';
    module.serverless.config.servicePath = './servicePath';
    module.prepareLocalInvoke();

    expect(module.originalServicePath).to.equal('./servicePath');
  });

  it('should use the function folder as cwd', () => {
    module.serverless.service.package = {
      individually: true
    };
    module.options.function = 'myFunc';
    module.serverless.service.getFunction.returns({ handler: 'myFuncHandler' });
    module.webpackOutputPath = '.webpack';
    module.serverless.config.servicePath = './servicePath';
    module.prepareLocalInvoke();

    expect(process.chdir).to.have.been.calledWithExactly(path.join('.webpack', 'myFunc'));
  });

  it('should use the service folder as cwd', () => {
    module.serverless.service.package = {};
    module.options.function = 'myFunc';
    module.serverless.service.getFunction.returns({ handler: 'myFuncHandler' });
    module.webpackOutputPath = '.webpack';
    module.serverless.config.servicePath = './servicePath';
    module.prepareLocalInvoke();

    expect(process.chdir).to.have.been.calledWithExactly(path.join('.webpack', 'service'));
  });

  it('should work without path option', () => {
    module.serverless.service.package = {};
    module.serverless.service.getFunction.returns({ handler: 'myFuncHandler' });
    module.webpackOutputPath = '.';
    module.serverless.config.servicePath = './servicePath';
    _.unset(module, 'serverless.config.serverless.processedInput.options.path');
    module.prepareLocalInvoke();

    expect(module.originalServicePath).to.equal('./servicePath');
  });
});
