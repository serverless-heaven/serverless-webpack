'use strict';

const sinon = require('sinon');

module.exports = () => ({
  _resetSpies() {
    for (const p in this) {
      if (Object.prototype.hasOwnProperty.call(this, p) && p !== '_resetSpies') {
        this[p].reset();
      }
    }
  },
  guid: sinon.stub().returns('testguid'),
  purgeCache: sinon.spy()
});
