const sinon = require('sinon');

const AppMock = sandbox => ({
  listen: sandbox.stub(),
  use: sandbox.stub(),
  get: sandbox.stub(),
  post: sandbox.stub(),
  options: sandbox.stub(),
});

const ExpressMock = sandbox => {
  const appMock = AppMock(sandbox);
  const mock = sandbox.stub().returns(appMock);
  mock.appMock = appMock;
  return mock;
}

module.exports = sandbox => ExpressMock(sandbox);
