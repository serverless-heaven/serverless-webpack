const _ = require('lodash');

module.exports = {
  stats: [
    {
      compilation: {
        chunks: [
          {
            modules: [
              {
                identifier: _.constant('"crypto"')
              },
              {
                identifier: _.constant('"uuid/v4"')
              },
              {
                identifier: _.constant('"mockery"')
              },
              {
                identifier: _.constant('"@scoped/vendor/module1"')
              },
              {
                identifier: _.constant('external "bluebird"')
              },
              {
                identifier: _.constant('external "request-promise"')
              }
            ]
          }
        ],
        compiler: {
          outputPath: '/my/Service/Path/.webpack/service'
        }
      }
    }
  ]
};
