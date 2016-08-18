module.exports = {
  entry: './handler.js',
  module: {
    loaders: [{
      test: /\.js$/,
      loaders: ['babel'],
      include: __dirname,
    }]
  }
};
