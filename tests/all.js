'use strict';

describe('serverless-webpack', () => {
  require('./validate.test');
  require('./compile.test');
  require('./packageModules.test');
  require('./packExternalModules.test');
  require('./run.test');
  require('./cleanup.test');
  require('./wpwatch.test');
  require('./runPluginSupport.test');
  require('./prepareStepOfflineInvoke.test');
});
