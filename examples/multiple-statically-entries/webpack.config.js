var path = require('path');

module.exports = {
  entry: {
    first: './first.js',
    second: './second.js'
  },
  target: 'node',
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  },
};
