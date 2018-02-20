'use strict';

module.exports = {
  // Placeholder flag 'useSlsHandlers'
  // indicating that user has elected to auto bundle based on 
  // handler exports listed in serverless.yml
  // i.e. user has set entry: slsw.lib.entries in webpack config
  entries: { useSlsHandlers: true }
};
