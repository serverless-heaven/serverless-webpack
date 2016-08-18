module.exports = {
  entry: './handler.ts',
  output: {
    libraryTarget: 'commonjs',
    path: './.webpack',
    filename: 'handler.js'
  },
  module: {
    loaders: [
      { test: /\.ts(x?)$/, loader: 'ts-loader' }
    ]
  }
};
