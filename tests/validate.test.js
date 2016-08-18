'use strict';

const expect = require('chai').expect;
const validate = require('../lib/validate');

describe('validate', () => {
  it('should expose a `validate` method', () => {
    expect(validate.validate).to.be.a('function');
  });
});
