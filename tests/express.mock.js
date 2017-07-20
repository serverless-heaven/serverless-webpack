const sinon = require('sinon');

const appMock = {
  listen: sinon.spy(),
  use: sinon.spy(),
  get: sinon.spy(),
  post: sinon.spy(),
  options: sinon.spy(),
  all: sinon.spy(),
};

const expressMock = sinon.stub().returns(appMock);
expressMock.appMock = appMock;
expressMock._resetSpies = () => {
  expressMock.reset();
  appMock.listen.reset();
  appMock.use.reset();
  appMock.get.reset();
  appMock.post.reset();
  appMock.options.reset();
  appMock.all.reset();
};

module.exports = () => expressMock;
