'use strict';
/**
 * Unit tests for Configuration.
 */

const chai = require('chai');
const Configuration = require('./Configuration');

const expect = chai.expect;

describe('Configuration', () => {
  describe('defaults', () => {
    let expectedDefaults;

    before(() => {
      expectedDefaults = {
        webpackConfig: 'webpack.config.js',
        webpackIncludeModules: false,
        packager: 'npm',
        packExternalModulesMaxBuffer: 200 * 1024,
        config: null
      };
    });

    it('should set default configuration without custom', () => {
      const config = new Configuration();
      expect(config).to.have.a.property('_config').that.deep.equals(expectedDefaults);
      expect(config).to.have.a.property('hasLegacyConfig').that.is.false;
    });

    it('should set default configuration without webpack property', () => {
      const config = new Configuration({});
      expect(config).to.have.a.property('_config').that.deep.equals(expectedDefaults);
      expect(config).to.have.a.property('hasLegacyConfig').that.is.false;
    });
  });

  describe('with legacy configuration', () => {
    it('should use custom.webpackIncludeModules', () => {
      const testCustom = { webpackIncludeModules: { forceInclude: ['mod1'] } };
      const config = new Configuration(testCustom);
      expect(config).to.have.a.property('webpackIncludeModules').that.deep.equals(testCustom.webpackIncludeModules);
    });

    it('should use custom.packExternalModulesMaxBuffer', () => {
      const testCustom = { packExternalModulesMaxBuffer: 4711 };
      const config = new Configuration(testCustom);
      expect(config).to.have.a.property('packExternalModulesMaxBuffer').that.equals(4711);
    });

    it('should use custom.webpack as string', () => {
      const testCustom = { webpack: 'myWebpackFile.js' };
      const config = new Configuration(testCustom);
      expect(config).to.have.a.property('webpackConfig').that.equals('myWebpackFile.js');
    });

    it('should detect it', () => {
      const testCustom = { webpack: 'myWebpackFile.js' };
      const config = new Configuration(testCustom);
      expect(config).to.have.a.property('hasLegacyConfig').that.is.true;
    });

    it('should add defaults', () => {
      const testCustom = { 
        webpackIncludeModules: { forceInclude: ['mod1'] },
        webpack: 'myWebpackFile.js'
      };
      const config = new Configuration(testCustom);
      expect(config).to.have.a.property('webpackIncludeModules').that.deep.equals(testCustom.webpackIncludeModules);
      expect(config._config).to.deep.equal({
        webpackConfig: 'myWebpackFile.js',
        webpackIncludeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packExternalModulesMaxBuffer: 200 * 1024,
        config: null
      });
    });
  });

  describe('with a configuration object', () => {
    it('should use it and add any defaults', () => {
      const testCustom = {
        webpack: {
          webpackIncludeModules: { forceInclude: ['mod1'] },
          webpackConfig: 'myWebpackFile.js'
        }
      };
      const config = new Configuration(testCustom);
      expect(config._config).to.deep.equal({
        webpackConfig: 'myWebpackFile.js',
        webpackIncludeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packExternalModulesMaxBuffer: 200 * 1024,
        config: null
      });
    });

    it('should favor new configuration', () => {
      const testCustom = {
        webpackIncludeModules: { forceExclude: ['mod2'] },
        webpack: {
          webpackIncludeModules: { forceInclude: ['mod1'] },
          webpackConfig: 'myWebpackFile.js'
        }
      };
      const config = new Configuration(testCustom);
      expect(config._config).to.deep.equal({
        webpackConfig: 'myWebpackFile.js',
        webpackIncludeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packExternalModulesMaxBuffer: 200 * 1024,
        config: null
      });
    });
  });
});
