'use strict';

const BbPromise = require('bluebird');
const webpack = require('webpack');
const express = require('express');
const bodyParser = require('body-parser');

module.exports = {
  serve() {
    this.serverless.cli.log('Serving functions...');

    const compiler = webpack(this.webpackConfig);
    const app = this._newExpressApp();
    const port = this._getPort();

    app.listen(port, () => {
      compiler.watch({}, (err, stats) => {
        if (err) {
          throw err;
        }
        this.handler = this.loadHandler(stats);
      });
    });

    return BbPromise.resolve();
  },

  _newExpressApp() {
    const app = express();
    const funcConfs = this._getFuncConfigs();

    app.use(bodyParser.json({ limit: '5mb' }));

    app.use((req, res, next) => {
      if(req.method !== 'OPTIONS') {
        next();
      } else {
        res.status(200).end();
      }
    });

    for (let funcConf of funcConfs) {
      for (let httpEvent of funcConf.events) {
        const method = httpEvent.method.toLowerCase();
        const endpoint = `/${httpEvent.path}`;
        const path = endpoint.replace(/\{(.+?)\}/g, ':$1');
        let handler = this._handerBase(funcConf.id);
        if (httpEvent.cors) {
          handler = this._handlerAddCors(handler);
        }
        app[method](
          path, // TODO add env prefix
          handler
        );
        console.log(`  ${method.toUpperCase()} - http://localhost:${this._getPort()}${endpoint}`);
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
      res.header( 'Access-Control-Allow-Methods', 'GET,PUT,HEAD,PATCH,POST,DELETE,OPTIONS');
      res.header( 'Access-Control-Allow-Headers', 'Authorization,Content-Type,x-amz-date,x-amz-security-token');
      handler(req, res, next);
    };
  },

  _handerBase(funcId) {
    return (req, res, next) => {
      const func = this.handler[funcId];
      const event = {
        method: req.method,
        headers: req.headers,
        body: req.body,
        path: req.params,
        query: req.query,
        // principalId,
        // stageVariables,
      };
      const context = this.getContext(funcId);
      func(event, context, (err, resp) => {
        if (err) {
          console.error(err);
          res.sendStatus(500);
        } else {
          res.status(200).send(resp);
        }
      });
    }
  },
};
