'use strict';
/**
 * Unit tests for Configuration.
 */

const os = require('os');
const Configuration = require('../lib/Configuration');

describe('Configuration', () => {
  describe('defaults', () => {
    let expectedDefaults;

    beforeAll(() => {
      expectedDefaults = {
        webpackConfig: 'webpack.config.js',
        includeModules: false,
        packager: 'npm',
        packagerOptions: {},
        keepOutputDirectory: false,
        config: null,
        concurrency: os.cpus().length
      };
    });

    it('should set default configuration without custom', () => {
      const config = new Configuration();
      expect(config._config).toEqual(expectedDefaults);
      expect(config.hasLegacyConfig).toBe(false);
    });

    it('should set default configuration without webpack property', () => {
      const config = new Configuration({});
      expect(config._config).toEqual(expectedDefaults);
      expect(config.hasLegacyConfig).toBe(false);
    });
  });

  describe('with legacy configuration', () => {
    it('should use custom.webpackIncludeModules', () => {
      const testCustom = { webpackIncludeModules: { forceInclude: ['mod1'] } };
      const config = new Configuration(testCustom);
      expect(config.includeModules).toEqual(testCustom.webpackIncludeModules);
    });

    it('should use custom.webpack as string', () => {
      const testCustom = { webpack: 'myWebpackFile.js' };
      const config = new Configuration(testCustom);
      expect(config.webpackConfig).toBe('myWebpackFile.js');
    });

    it('should detect it', () => {
      const testCustom = { webpack: 'myWebpackFile.js' };
      const config = new Configuration(testCustom);
      expect(config.hasLegacyConfig).toBe(true);
    });

    it('should add defaults', () => {
      const testCustom = {
        webpackIncludeModules: { forceInclude: ['mod1'] },
        webpack: 'myWebpackFile.js'
      };
      const config = new Configuration(testCustom);
      expect(config.includeModules).toEqual(testCustom.webpackIncludeModules);
      expect(config._config).toEqual({
        webpackConfig: 'myWebpackFile.js',
        includeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packagerOptions: {},
        keepOutputDirectory: false,
        config: null,
        concurrency: os.cpus().length
      });
    });
  });

  describe('with a configuration object', () => {
    it('should use it and add any defaults', () => {
      const testCustom = {
        webpack: {
          includeModules: { forceInclude: ['mod1'] },
          webpackConfig: 'myWebpackFile.js'
        }
      };
      const config = new Configuration(testCustom);
      expect(config._config).toEqual({
        webpackConfig: 'myWebpackFile.js',
        includeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packagerOptions: {},
        keepOutputDirectory: false,
        config: null,
        concurrency: os.cpus().length
      });
    });

    it('should favor new configuration', () => {
      const testCustom = {
        webpackIncludeModules: { forceExclude: ['mod2'] },
        webpack: {
          includeModules: { forceInclude: ['mod1'] },
          webpackConfig: 'myWebpackFile.js'
        }
      };
      const config = new Configuration(testCustom);
      expect(config._config).toEqual({
        webpackConfig: 'myWebpackFile.js',
        includeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packagerOptions: {},
        keepOutputDirectory: false,
        config: null,
        concurrency: os.cpus().length
      });
    });

    it('should accept a numeric string as concurrency value', () => {
      const testCustom = {
        webpack: {
          includeModules: { forceInclude: ['mod1'] },
          webpackConfig: 'myWebpackFile.js',
          concurrency: '3'
        }
      };
      const config = new Configuration(testCustom);
      expect(config.concurrency).toBe(3);
    });

    it('should not accept an invalid string as concurrency value', () => {
      const testCustom = {
        webpack: {
          includeModules: { forceInclude: ['mod1'] },
          webpackConfig: 'myWebpackFile.js',
          concurrency: '3abc'
        }
      };
      expect(() => new Configuration(testCustom)).toThrow();
    });

    it('should not accept a non-positive number as concurrency value', () => {
      const testCustom = {
        webpack: {
          includeModules: { forceInclude: ['mod1'] },
          webpackConfig: 'myWebpackFile.js',
          concurrency: 0
        }
      };
      expect(() => new Configuration(testCustom)).toThrow();
    });

    it('should be backward compatible with serializedCompile', () => {
      const testCustom = {
        webpack: {
          serializedCompile: true
        }
      };
      const config = new Configuration(testCustom);
      expect(config.concurrency).toBe(1);
    });
  });
});
