'use strict';

const BbPromise = require('bluebird');
const webpack = require('webpack');

module.exports = {
  compile() {
    const compiler = webpack(this.webpackConfig);

    return BbPromise
      .fromCallback(cb => compiler.run(cb))
      .then(stats => {
        console.log(stats.toString({
          colors: true,
          hash: false,
          version: false,
          chunks: false,
          children: false
        }));
        if (stats.compilation.errors.length) {
          throw new Error('Webpack compilation error, see above');
        }
        const outputPath = stats.compilation.compiler.outputPath;
        this.webpackOutputPath = outputPath;
        this.serverless.config.servicePath = outputPath;
        return stats;
      });
  },
};
