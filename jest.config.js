module.exports = {
  clearMocks: true,
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/', '<rootDir>/coverage/', '<rootDir>/examples/'],
  coverageProvider: 'v8',
  coverageReporters: ['lcov', 'clover', 'text-summary'],
  modulePathIgnorePatterns: ['<rootDir>/examples/']
};
