'use strict';

const BbPromise = require('bluebird');
const webpack = require('webpack');
const fs = require('fs');
const path = require('path');
const npm = require('npm-programmatic');

module.exports = {
  packExternalModules() {

    const externals = this.webpackConfig.externals;

    return BbPromise.resolve().then(() => {
        if (!externals || externals.length === 0) {
            return;
        }
       
        this.serverless.cli.log('packing external modules');

        const tmpPackageJson = path.join(this.webpackOutputPath, 'package.json'); 
    
        // create a temp package.json in dist directory so that we can install the dependencies later.
        fs.writeFileSync(tmpPackageJson, "{}");

        return new BbPromise((resolve, reject) => {
            npm.install(externals, {
                cwd: this.webpackOutputPath,
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
