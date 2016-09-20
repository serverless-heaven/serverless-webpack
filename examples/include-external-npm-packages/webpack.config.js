var nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './handler.js',
  target: 'node',
  externals: [nodeExternals()] // exclude external modules
};
