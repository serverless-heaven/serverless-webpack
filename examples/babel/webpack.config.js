module.exports = {
  entry: [
    'babel-polyfill',
    './handler.js'
  ],
  target: 'node',
  module: {
    loaders: [{
      test: /\.js$/,
      loaders: ['babel'],
      include: __dirname,
      exclude: /node_modules/,
    }]
  }
};
