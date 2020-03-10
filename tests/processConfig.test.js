'use strict';

const path = require('path');
const chai = require('chai');

const processConfig = require('../lib/processConfig');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const expect = chai.expect;

describe('processConfig', () => {
  describe('setOptionsOnConfig()', () => {
    it('should override the output path if `out` option is specified', () => {
      const testConfig = {
        entry: 'test',
        context: 'testcontext',
        output: {
          path: 'originalpath',
          filename: 'filename'
        }
      };
      const testServicePath = 'testpath';
      const testOptionsOut = 'testdir';

      const testOptions = {
        out: testOptionsOut,
        servicePath: testServicePath
      };

      const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);
      expect(webpackConfig.output).to.eql({
        path: path.join(testServicePath, testOptionsOut, 'service'),
        filename: 'filename'
      });
    });

    it('should set a default `webpackConfig.context` if not present', () => {
      const testConfig = {
        entry: 'test',
        output: {}
      };
      const testServicePath = 'testpath';
      const testOptions = {
        servicePath: testServicePath
      };

      const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);
      expect(webpackConfig.context).to.equal(testServicePath);
    });

    describe('default target', () => {
      it('should set a default `webpackConfig.target` if not present', () => {
        const testConfig = {
          entry: 'test',
          output: {}
        };
        const testServicePath = 'testpath';
        const testOptions = {
          servicePath: testServicePath
        };
        const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);
        expect(webpackConfig.target).to.equal('node');
      });

      it('should not change `webpackConfig.target` if one is present', () => {
        const testConfig = {
          entry: 'test',
          target: 'myTarget',
          output: {}
        };
        const testServicePath = 'testpath';
        const testOptions = {
          servicePath: testServicePath
        };
        const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);
        expect(webpackConfig.target).to.equal('myTarget');
      });
    });

    describe('default output', () => {
      it('should set a default `webpackConfig.output` if not present', () => {
        const testEntry = 'testentry';
        const testConfig = {
          entry: testEntry
        };
        const testServicePath = 'testpath';
        const testOptions = {
          servicePath: testServicePath
        };
        const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);

        expect(webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.webpack', 'service'),
          filename: '[name].js'
        });
      });

      it('should set a default `webpackConfig.output.filename` if `entry` is an array', () => {
        const testEntry = [ 'first', 'second', 'last' ];
        const testConfig = {
          entry: testEntry
        };
        const testServicePath = 'testpath';
        const testOptions = {
          servicePath: testServicePath
        };
        const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);

        expect(webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.webpack', 'service'),
          filename: '[name].js'
        });
      });

      it('should set a default `webpackConfig.output.filename` if `entry` is not defined', () => {
        const testConfig = {};
        const testServicePath = 'testpath';
        const testOptions = {
          servicePath: testServicePath
        };
        const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);

        expect(webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.webpack', 'service'),
          filename: '[name].js'
        });
      });
    });

    describe('entryFunc', () => {
      it('should set webpackConfig output path for entry function', () => {
        const testConfig = {};
        const testServicePath = 'testpath';
        const testEntryKey = 'testKey';
        const testEntryValue = 'testValue';
        const testFuncName = 'funcName';
        const testOptions = {
          servicePath: testServicePath,
          entryFunc: {
            entry: {
              key: testEntryKey,
              value: testEntryValue
            },
            funcName: testFuncName
          }
        };

        const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);
        expect(webpackConfig.entry).to.eql({
          [testEntryKey]: testEntryValue
        });
        expect(webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.webpack', testFuncName),
          filename: '[name].js'
        });
      });

      it('should set webpackConfig output path for entry function with out set', () => {
        const testConfig = {};
        const testServicePath = 'testpath';
        const testEntryKey = 'testKey';
        const testEntryValue = 'testValue';
        const testFuncName = 'funcName';
        const testOptionsOut = 'testdir';
        const testOptions = {
          out: testOptionsOut,
          servicePath: testServicePath,
          entryFunc: {
            entry: {
              key: testEntryKey,
              value: testEntryValue
            },
            funcName: testFuncName
          }
        };

        const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);
        expect(webpackConfig.entry).to.eql({
          [testEntryKey]: testEntryValue
        });
        expect(webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, testOptionsOut, testFuncName),
          filename: '[name].js'
        });
      });

      it('should set webpackConfig output path for entry function with camelcase key', () => {
        const testConfig = {};
        const testServicePath = 'testpath';
        const testEntryKey = 'test_key';
        const testEntryKeyCamelCase = 'testKey';
        const testEntryValue = 'testValue';
        const testOptionsOut = 'testdir';
        const testOptions = {
          out: testOptionsOut,
          servicePath: testServicePath,
          entryFunc: {
            entry: {
              key: testEntryKey,
              value: testEntryValue
            }
          }
        };

        const webpackConfig = processConfig.setOptionsOnConfig(testConfig, testOptions);
        expect(webpackConfig.entry).to.eql({
          [testEntryKey]: testEntryValue
        });
        expect(webpackConfig.output).to.eql({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, testOptionsOut, testEntryKeyCamelCase),
          filename: '[name].js'
        });
      });
    });
  });
});
