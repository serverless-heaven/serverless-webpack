# Serverless Webpack

[![Serverless][ico-serverless]][link-serverless]
[![License][ico-license]][link-license]
[![NPM][ico-npm]][link-npm]
[![Build Status][ico-build]][link-build]
[![Coverage Status][ico-coverage]][link-coverage]
[![Contributors][ico-contributors]][link-contributors]

A Serverless v1.x plugin to build your lambda functions with [Webpack][link-webpack].

This plugin is for you if you want to use the latest Javascript version with [Babel][link-babel];
use custom [resource loaders][link-webpack-loaders], optimize your packaged functions individually
and much more!

## Highlights

* Configuration possibilities range from zero-config to fully customizable
* Support of `serverless package`, `serverless deploy` and `serverless deploy function`
* Support of `serverless invoke local` and `serverless invoke local --watch`
* Integrates with [`serverless-offline`][link-serverless-offline] to simulate local API Gateway endpoints
* When enabled in your service configuration, functions are packaged and compiled
individually, resulting in smaller Lambda packages that contain only the code and
dependencies needed to run the function. This allows the plugin to fully utilize
WebPack's [Tree-Shaking][link-webpack-tree] optimization.

## Recent improvements

* Support for individual packaging and optimization
* Integrate with `serverless invoke local` (including watch mode)
* Stabilized package handling
* Improved compatibility with other plugins
* Updated examples

For the complete release notes see the end of this document.

## Install

```bash
$ npm install serverless-webpack --save-dev
```

Add the plugin to your `serverless.yml` file:

```yaml
plugins:
  - serverless-webpack
```

## Configure

By default the plugin will look for a `webpack.config.js` in the service directory.
Alternatively, you can specify a different file or configuration in `serverless.yml`:

```yaml
custom:
  webpack: ./folder/my-webpack.config.js
```

An base Webpack configuration might look like this:

```js
// webpack.config.js

module.exports = {
  entry: './handler.js',
  target: 'node',
  module: {
    loaders: [ ... ]
  }
};
```

### serverless-webpack lib export helper

serverless-webpack exposes a lib object, that can be used in your webpack.config.js
to make the configuration easier and to build fully dynamic configurations.
This is the preferred way to configure webpack - the plugin will take care of
as much of the configuration (and subsequent changes in your services) as it can.

#### Automatic entry resolution

You can let the plugin determine the correct handler entry points at build time.
Then you do not have to care anymore when you add or remove functions from your service:

```js
// webpack.config.js
const slsw = require('serverless-webpack');

module.exports = {
  ...
  entry: slsw.lib.entries,
  ...
};
```

Custom entries that are not part of the SLS build process can be added too:

```js
// webpack.config.js
const _ = require('lodash');
const slsw = require('serverless-webpack');

module.exports = {
  ...
  entry: _.assign({
    myCustomEntry1: './custom/path/something.js'
  }, slsw.lib.entries),
  ...
};
```

#### Full customization (for experts)

The lib export also provides the `serverless` and `options` properties, through
which you can access the Serverless instance and the options given on the command-line.

This enables you to have a fully customized dynamic configuration, that can evaluate
anything available in the Serverless framework. There are really no limits.

Samples are: The current stage and the complete service definition. You thereby
have access to anything that a Serverless plugin would have access to.

Both properties should be handled with care and should never be written to,
as that will modify the running framework and leads to unpredictable behavior!

If you have cool use cases with the full customization, we might add your solution
to the plugin examples as showcase.

### Output

Note that, if the `output` configuration is not set, it will automatically be
generated to write bundles in the `.webpack` directory. If you set your own `output`
configuration make sure to add a [`libraryTarget`][link-webpack-libtarget]
for best compatibility with external dependencies:

```js
// webpack.config.js

module.exports = {
  // ...
  output: {
    libraryTarget: 'commonjs',
    path: '.webpack',
    filename: 'handler.js', // this should match the first part of function handler in `serverless.yml`
  },
  // ...
};
```

### Node modules / externals

By default, the plugin will try to bundle all dependencies. However, you don't
want to include all modules in some cases such as selectively import, excluding
builtin package (ie: `aws-sdk`) and handling webpack-incompatible modules.

In this case you might add external modules in
[Webpack's `externals` configuration][link-webpack-externals].
Those modules can be included in the Serverless bundle with the `webpackIncludeModules`
option in `serverless.yml`:

```js
// webpack.config.js
var nodeExternals = require('webpack-node-externals')

module.exports = {
  // we use webpack-node-externals to excludes all node deps.
  // You can manually set the externals too.
  externals: [nodeExternals()],
}
```

```yaml
# serverless.yml
custom:
  webpackIncludeModules: true # enable auto-packing of external modules
```


All modules stated in `externals` will be excluded from bundled files. If an excluded module
is stated as `dependencies` in `package.json`, it will be packed into the Serverless
artifact under the `node_modules` directory.

By default, the plugin will use the `package.json` file in working directory, If you want to
use a different package file, set `packagePath` to your custom `package.json`:

```yaml
# serverless.yml
custom:
  webpackIncludeModules:
    packagePath: '../package.json' # relative path to custom package.json file.
```
> Note that only relative path is supported at the moment.


Sometimes it might happen that you use dynamic requires in your code, i.e. you
require modules that are only known at runtime. Webpack is not able to detect
such externals and the compiled package will miss the needed dependencies.
In such cases you can force the plugin to include certain modules by setting
them in the `forceInclude` array property. However the module must appear in
your service's production dependencies in `package.json`.

```yaml
# serverless.yml
custom:
  webpackIncludeModules:
    forceInclude:
      - module1
      - module2
```


You can find an example setups in the [`examples`][link-examples] folder.

#### Service level packaging

If you do not enable individual packaging in your service (serverless.yml), the
plugin creates one ZIP file for all functions (the service package) that includes
all node modules used in the service. This is the fastest packaging, but not the
optimal one, as node modules are always packaged, that are not needed by some
functions.

#### Optimization / Individual packaging per function

A better way to do the packaging, is to enable individual packaging in your
service:

```yaml
# serverless.yml
...
package:
  individually: true
...
```

This will switch the plugin to per function packaging which makes use of the multi-compiler
feature of Webpack. That means, that Webpack compiles **and optimizes** each
function individually, removing unnecessary imports and reducing code sizes
significantly. Tree-Shaking only makes sense with this approach.

Now the needed external node modules are also detected by Webpack per function
and the plugin only packages the needed ones into the function artifacts. As a
result, the deployed artifacts are smaller, depending on the functions and
cold-start times (to install the functions into the cloud at runtime) are reduced
too.

The individual packaging should be combined with the _automatic entry resolution_ (see above).

The individual packaging needs more time at the packaging phase, but you'll
get that paid back twice at runtime.

## Usage

### Automatic bundling

The normal Serverless deploy procedure will automatically bundle with Webpack:

- Create the Serverless project with `serverless create -t aws-nodejs`
- Install Serverless Webpack as above
- Deploy with `serverless deploy`

### Run a function locally

The plugin fully integrates with `serverless invoke local`. To run your bundled functions
locally you can:

```bash
$ serverless invoke local --function <function-name>
```

All options that are supported by invoke local can be used as usual:

- `--function` or `-f` (required) is the name of the function to run
- `--path` or `-p` (optional) is a JSON file path used as the function input event
- `--data` or `-d` (optional) inline JSON data used as the function input event

> :exclamation: The old `webpack invoke` command has been disabled.

### Run a function locally on source changes

Or to run a function every time the source files change use the `--watch` option
together with `serverless invoke local`:

```bash
$ serverless invoke local --function <function-name> --path event.json --watch
```

Everytime the sources are changed, the function will be executed again with the
changed sources. The command will watch until the process is terminated.

If you have your sources located on a file system that does not offer events,
you can enable polling with the `--webpack-use-polling=<time in ms>` option.
If you omit the value, it defaults to 3000 ms.

All options that are supported by invoke local can be used as usual:

- `--function` or `-f` (required) is the name of the function to run
- `--path` or `-p` (optional) is a JSON file path used as the function input event
- `--data` or `-d` (optional) inline JSON data used as the function input event

> :exclamation: The old `webpack watch` command has been disabled.

### Usage with serverless-offline

The plugin integrates very well with [serverless-offline][link-serverless-offline] to
simulate AWS Lambda and AWS API Gateway locally.

Add the plugins to your `serverless.yml` file and make sure that `serverless-webpack`
precedes `serverless-offline` as the order is important:
```yaml
  plugins:
    ...
    - serverless-webpack
    ...
    - serverless-offline
    ...
```

Run `serverless offline` or `serverless offline start` to start the Lambda/API simulation.

In comparison to `serverless offline`, the `start` command will fire an `init` and a `end` lifecycle hook which is needed for `serverless-offline` and e.g. `serverless-dynamodb-local` to switch off resources (see below).

You can find an example setup in the [`examples`][link-examples] folder.

If you have your sources located on a file system that does not offer events,
e.g. a mounted volume in a Docker container, you can enable polling with the
`--webpack-use-polling=<time in ms>` option. If you omit the value, it defaults
to 3000 ms.

#### Custom paths

If you do not use the default path and override it in your Webpack configuration,
you have use the `--location` option.

#### serverless-dynamodb-local

Configure your service the same as mentioned above, but additionally add the `serverless-dynamodb-local`
plugin as follows:
```yaml
  plugins:
    - serverless-webpack
    - serverless-dynamodb-local
    - serverless-offline
```

Run `serverless offline start`.

#### Other useful options

You can reduce the clutter generated by `serverless-offline` with `--dontPrintOutput` and
disable timeouts with `--noTimeout`.

### Bundle with webpack

To just bundle and see the output result use:

```bash
$ serverless webpack --out dist
```

Options are:

- `--out` or `-o` (optional) The output directory. Defaults to `.webpack`.

### Simulate API Gateway locally

:exclamation: The serve command has been removed. See above how to achieve the
same functionality with the [`serverless-offline`][link-serverless-offline] plugin.

## Example with Babel

In the [`examples`][link-examples] folder there is a Serverless project using this
plugin with Babel. To try it, from inside the example folder:

- `npm install` to install dependencies
- `serverless invoke local -f hello` to run the example function

## Provider Support

Plugin commands are supported by the following providers. ⁇ indicates that command has not been tested with that provider.

|                       | AWS Lambda | Apache OpenWhisk | Azure Functions | Google Cloud Functions |
|-----------------------|------------|------------------|-----------------|------------------------|
| webpack               |      ✔︎     |         ✔︎        |        ⁇        |            ⁇           |
| invoke local          |      ✔︎     |         ✔︎        |        ⁇        |            ⁇           |
| invoke local --watch  |      ✔︎     |         ✔︎        |        ⁇        |            ⁇           |

## Release Notes

* 3.1.2
  * Fix issue where dependencies with dots in their names would not be installed [#251][link-251]

* 3.1.1
  * Fix issue where locked dependencies (package-lock.json) were ignored [#245][link-245]

* 3.1.0
  * Allow filesystem polling in watch mode (`--webpack-use-polling`) [#215][link-215]
  * Allow forced include of not referenced modules [#217][link-217]
  * Automatically include peer dependencies of used modules [#223][link-223]
  * Show explicit message if the provided webpack config can not be loaded [#234][link-234]
  * Improve examples [#227][link-227]
  * Update 3rd party provider compatibility table [#221][link-221]
  * Added automatic Travis and Coveralls builds to increase stability

* 3.0.0
  * Integrate with `serverless invoke local` [#151][link-151]
  * Support watch mode with `serverless invoke local --watch`
  * Stabilized and improved the bundling of node modules [#116][link-116], [#117][link-117]
  * Improved interoperability with Serverless and 3rd party plugins [#173][link-173]
  * Support individual packaging of the functions in a service [#120][link-120]
  * Allow setting stdio max buffers for NPM operations [#185][link-185]
  * Support bundling of node modules via node-externals whitelist [#186][link-186]
  * Removed the `webpack serve` command in favor of [`serverless-offline`][link-serverless-offline] [#152][link-152]
  * Updated examples [#179][link-179]
  * Added missing unit tests to improve code stability
  * Fixed unit tests to run on Windows [#145][link-145]

* 2.2.2
  * Reverted breaking change introduced in default output config [#202][link-202]

* 2.2.1
  * Restore functionality for Google provider [#193][link-193]

* 2.2.0
  * Allow full dynamic configurations [#158][link-158]
  * Fix a bug that prevented the entries lib export to work with TypeScript [#165][link-165]

* 2.1.0
  * Added support for webpack configuration in TypeScript format [#129][link-129]
  * Fixed bug with serverless-offline exec [#154][link-154]
  * Added unit tests for cleanup. Updated test framework [#11][link-11]
  * Support single function deploy and packaging [#107][link-107]
  * Fixed path exception bug with individual packaging and SLS 1.18 [#159][link-159]

* 2.0.0
  * Support arbitrary Webpack versions as peer dependency [#83][link-83]
  * Support `serverless offline start` invocation [#131][link-131]
  * Documentation updates [#88][link-88], [#132][link-132], [#140][link-140], [#141][link-141], [#144][link-144]
  * Print Webpack stats on recompile [#127][link-127]

[ico-serverless]: http://public.serverless.com/badges/v3.svg
[ico-license]: https://img.shields.io/github/license/serverless-heaven/serverless-webpack.svg
[ico-npm]: https://img.shields.io/npm/v/serverless-webpack.svg
[ico-build]: https://travis-ci.org/serverless-heaven/serverless-webpack.svg?branch=master
[ico-coverage]: https://coveralls.io/repos/github/serverless-heaven/serverless-webpack/badge.svg?branch=master
[ico-contributors]: https://img.shields.io/github/contributors/serverless-heaven/serverless-webpack.svg

[link-serverless]: http://www.serverless.com/
[link-license]: ./blob/master/LICENSE
[link-npm]: https://www.npmjs.com/package/serverless-webpack
[link-build]: https://travis-ci.org/serverless-heaven/serverless-webpack
[link-coverage]: https://coveralls.io/github/serverless-heaven/serverless-webpack?branch=master
[link-contributors]: https://github.com/serverless-heaven/serverless-webpack/graphs/contributors

[link-webpack]: https://webpack.github.io/
[link-babel]: https://babeljs.io/
[link-webpack-loaders]: https://webpack.github.io/docs/loaders.html
[link-webpack-libtarget]: https://webpack.github.io/docs/configuration.html#output-librarytarget
[link-webpack-tree]: https://webpack.js.org/guides/tree-shaking/
[link-webpack-externals]: https://webpack.github.io/docs/configuration.html#externals
[link-examples]: ./examples
[link-serverless-offline]: https://www.npmjs.com/package/serverless-offline
[link-serverless-dynamodb-local]: https://www.npmjs.com/package/serverless-dynamodb-local

[comment]: # (Referenced issues)

[link-135]: https://github.com/serverless-heaven/serverless-webpack/issues/135

[link-83]: https://github.com/serverless-heaven/serverless-webpack/pull/83
[link-88]: https://github.com/serverless-heaven/serverless-webpack/pull/88
[link-127]: https://github.com/serverless-heaven/serverless-webpack/pull/127
[link-131]: https://github.com/serverless-heaven/serverless-webpack/pull/131
[link-132]: https://github.com/serverless-heaven/serverless-webpack/pull/132
[link-140]: https://github.com/serverless-heaven/serverless-webpack/pull/140
[link-141]: https://github.com/serverless-heaven/serverless-webpack/issues/141
[link-144]: https://github.com/serverless-heaven/serverless-webpack/issues/144

[link-11]: https://github.com/serverless-heaven/serverless-webpack/issues/11
[link-107]: https://github.com/serverless-heaven/serverless-webpack/issues/107
[link-129]: https://github.com/serverless-heaven/serverless-webpack/pull/129
[link-154]: https://github.com/serverless-heaven/serverless-webpack/issues/154
[link-159]: https://github.com/serverless-heaven/serverless-webpack/issues/159

[link-158]: https://github.com/serverless-heaven/serverless-webpack/issues/158
[link-165]: https://github.com/serverless-heaven/serverless-webpack/issues/165

[link-193]: https://github.com/serverless-heaven/serverless-webpack/issues/193

[link-116]: https://github.com/serverless-heaven/serverless-webpack/issues/116
[link-117]: https://github.com/serverless-heaven/serverless-webpack/issues/117
[link-120]: https://github.com/serverless-heaven/serverless-webpack/issues/120
[link-145]: https://github.com/serverless-heaven/serverless-webpack/issues/145
[link-151]: https://github.com/serverless-heaven/serverless-webpack/issues/151
[link-152]: https://github.com/serverless-heaven/serverless-webpack/issues/152
[link-173]: https://github.com/serverless-heaven/serverless-webpack/issues/173
[link-179]: https://github.com/serverless-heaven/serverless-webpack/pull/179
[link-185]: https://github.com/serverless-heaven/serverless-webpack/pull/185
[link-186]: https://github.com/serverless-heaven/serverless-webpack/pull/186

[link-202]: https://github.com/serverless-heaven/serverless-webpack/issues/202

[link-215]: https://github.com/serverless-heaven/serverless-webpack/issues/215
[link-217]: https://github.com/serverless-heaven/serverless-webpack/issues/217
[link-221]: https://github.com/serverless-heaven/serverless-webpack/pull/221
[link-223]: https://github.com/serverless-heaven/serverless-webpack/issues/223
[link-227]: https://github.com/serverless-heaven/serverless-webpack/pull/227
[link-234]: https://github.com/serverless-heaven/serverless-webpack/pull/234

[link-245]: https://github.com/serverless-heaven/serverless-webpack/issues/245

[link-251]: https://github.com/serverless-heaven/serverless-webpack/issues/251
