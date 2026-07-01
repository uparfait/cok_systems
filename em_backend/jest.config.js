module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
  ],
  testMatch: ['**/test/**/*.test.js'],
  verbose: true,
  testTimeout: 10000,
};
