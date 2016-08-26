'use strict';

const BbPromise = require('bluebird');
const fs = require('fs');
const path = require('path');
const npm = require('npm-programmatic');

module.exports = {
  packExternalModules() {

    const includes = (
        this.serverless.service.custom &&
        this.serverless.service.custom.webpackIncludeModules
    );

    return BbPromise.resolve().then(() => {
        if (!includes || includes.length === 0) {
            return;
        }
       
        this.serverless.cli.log('Packing external modules: ' + includes.join(","));

        const tmpPackageJson = path.join(this.serverless.config.servicePath, 'package.json'); 
    
        // create a temp package.json in dist directory so that we can install the dependencies later.
        fs.writeFileSync(tmpPackageJson, "{}");

        return new BbPromise((resolve, reject) => {
            npm.install(includes, {
                cwd: this.serverless.config.servicePath,
                save: false
            }).then(() => {
                fs.unlink(tmpPackageJson);
                resolve()
            }).catch(e => {
                fs.unlink(tmpPackageJson);
                reject(e);
            })
        })
    })
  },
};
