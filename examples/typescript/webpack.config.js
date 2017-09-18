var path = require('path');
const slsw = require('serverless-webpack');

module.exports = {
  entry: slsw.lib.entries,
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx', '.json'],
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  },
  target: 'node',
  module: {
    loaders: [
      { test: /\.ts(x?)$/, loader: 'ts-loader' }
    ]
  }
};
