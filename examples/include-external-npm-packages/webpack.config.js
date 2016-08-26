var path = require('path');

module.exports = {
  entry: './handler.js',
  target: 'node',
  externals: ["fbgraph", "aws-sdk"] // packages to be excluded from bundled file
};
