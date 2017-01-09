'use strict';

const BbPromise = require('bluebird');
const webpack = require('webpack');
const express = require('express');
const bodyParser = require('body-parser');

module.exports = {
  serve() {
    this.serverless.cli.log('Serving functions...');

    const compiler = webpack(this.webpackConfig);
    const funcConfs = this._getFuncConfigs();
    const app = this._newExpressApp(funcConfs);
    const port = this._getPort();

    app.listen(port, () =>
      compiler.watch({}, (err, stats) => {
        if (err) {
          throw err;
        }
        const loadedModules = [];
        for (let funcConf of funcConfs) {
          funcConf.handlerFunc = this.loadHandler(
            stats,
            funcConf.id,
            loadedModules.indexOf(funcConf.moduleName) < 0
          );
          loadedModules.push(funcConf.moduleName);
        }
      })
    );

    return BbPromise.resolve();
  },

  _newExpressApp(funcConfs) {
    const app = express();

    app.use(bodyParser.json({
      limit: '5mb',
      type: (req) => /json/.test(req.headers['content-type']),
    }));

    for (let funcConf of funcConfs) {
      for (let httpEvent of funcConf.events) {
        const method = httpEvent.method.toLowerCase();
        let endpoint = `/${httpEvent.path}`;
        if (this.options.stage) {
          endpoint = `/${this.options.stage}${endpoint}`;
        }
        const path = endpoint.replace(/\{(.+?)\}/g, ':$1');
        let handler = this._handlerBase(funcConf, httpEvent);
        let optionsHandler = this._optionsHandler;
        if (httpEvent.cors) {
          handler = this._handlerAddCors(handler);
          optionsHandler = this._handlerAddCors(optionsHandler);
        }
        app.options(path, optionsHandler);
        app[method](
          path,
          handler
        );
        this.serverless.cli.consoleLog(`  ${method.toUpperCase()} - http://localhost:${this._getPort()}${endpoint}`);
      }
    }

    return app;
  },

  _getFuncConfigs() {
    const funcConfs = [];
    const inputfuncConfs = this.serverless.service.functions;
    for (let funcName in inputfuncConfs) {
      const funcConf = inputfuncConfs[funcName];
      const httpEvents = funcConf.events
        .filter(e => e.hasOwnProperty('http'))
        .map(e => e.http);
      if (httpEvents.length > 0) {
        funcConfs.push(Object.assign({}, funcConf, {
          id: funcName,
          events: httpEvents,
          moduleName: funcConf.handler.split('.')[0],
          handlerFunc: null,
        }));
      }
    }
    return funcConfs;
  },

  _getPort() {
    return this.options.port || 8000;
  },

  _handlerAddCors(handler) {
    return (req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,HEAD,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type,x-amz-date,x-amz-security-token');
      handler(req, res, next);
    };
  },

  _handlerBase(funcConf, httpEvent) {
    const isLambdaProxyIntegration = httpEvent && httpEvent.integration !== 'lambda'

    return (req, res) => {
      const func = funcConf.handlerFunc;
      const event = {
        method: req.method,
        headers: req.headers,
        body: req.body,
        [isLambdaProxyIntegration ? 'pathParameters' : 'path']: req.params,
        [isLambdaProxyIntegration ? 'queryStringParameters' : 'query']: req.query
        // principalId,
        // stageVariables,
      };
      const context = this.getContext(funcConf.id);
      func(event, context, (err, resp) => {
        if (err) {
          return res.status(500).send(err);
        }

        if (isLambdaProxyIntegration) {
          res.status(resp.statusCode || 200).send(resp.body);
        } else {
          res.status(200).send(resp);
        }
      });
    }
  },

  _optionsHandler(req, res) {
    res.sendStatus(200);
  },
};
