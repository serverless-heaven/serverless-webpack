# Serverless Webpack

[![Serverless][ico-serverless]][link-serverless]
[![License][ico-license]][link-license]
[![NPM][ico-npm]][link-npm]
[![Build Status][ico-build]][link-build]
[![Coverage Status][ico-coverage]][link-coverage]
[![Contributors][ico-contributors]][link-contributors]

A Serverless v1.x & v2.x plugin to build your lambda functions with [Webpack][link-webpack].

This plugin is for you if you want to use the latest Javascript version with [Babel][link-babel];
use custom [resource loaders][link-webpack-loaders], optimize your packaged functions individually
and much more!

## Highlights

- Configuration possibilities range from zero-config to fully customizable
- Support of `serverless package`, `serverless deploy` and `serverless deploy function`
- Support of `serverless invoke local` and `serverless invoke local --watch`
- Support of `serverless run` and `serverless run --watch`
- Integrates with [`serverless-offline`][link-serverless-offline] to simulate local API Gateway endpoints
- When enabled in your service configuration, functions are packaged and compiled
  individually, resulting in smaller Lambda packages that contain only the code and
  dependencies needed to run the function. This allows the plugin to fully utilize
  WebPack's [Tree-Shaking][link-webpack-tree] optimization.
- Webpack version 3, 4 and 5 support
- Support NPM and Yarn for packaging
- Support asynchronous webpack configuration

## Recent improvements and important changes for 5.x

- Support Yarn
- Support Webpack 4 and 5
- Cleaned up configuration. You should now use a `custom.webpack` object to configure everything relevant for the plugin. The old configuration still works but will be removed in the next major release. For details see below.
- Added support for asynchronous webpack configuration

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

The configuration of the plugin is done by defining a `custom: webpack` object in your `serverless.yml` with your specific configuration. All settings are optional and will be set to reasonable defaults if missing.

See the sections below for detailed descriptions of the settings. The defaults are:

```yaml
custom:
  webpack:
    webpackConfig: 'webpack.config.js' # Name of webpack configuration file
    includeModules: false # Node modules configuration for packaging
    packager: 'npm' # Packager that will be used to package your external modules
    excludeFiles: src/**/*.test.js # Provide a glob for files to ignore
```

### Webpack configuration file

By default the plugin will look for a `webpack.config.js` in the service directory. Alternatively, you can specify a different file or configuration in `serverless.yml`.

```yaml
custom:
  webpack:
    webpackConfig: ./folder/my-webpack.config.js
```

A base Webpack configuration might look like this:

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

Alternatively the Webpack configuration can export an asynchronous object (e.g. a promise or async function) which will be awaited by the plugin and resolves to the final configuration object. This is useful if the confguration depends on asynchronous functions, for example, defining the AccountId of the current aws user inside AWS lambda@edge which does not support defining normal process environment variables.

A basic Webpack promise configuration might look like this:

```js
// Version if the local Node.js version supports async/await
// webpack.config.js

const webpack = require('webpack')
const slsw = require('serverless-webpack');

module.exports = (async () => {
  const accountId = await slsw.lib.serverless.providers.aws.getAccountId();
  return {
    entry: './handler.js',
    target: 'node',
    plugins: [
      new webpack.DefinePlugin({
        AWS_ACCOUNT_ID: `${accountId}`,
      }),
    ],
    module: {
      loaders: [ ... ]
    }
  };
})();
```

```js
// Version with promises
// webpack.config.js

const webpack = require('webpack')
const slsw = require('serverless-webpack');
const BbPromise = require('bluebird');

module.exports = BbPromise.try(() => {
  return slsw.lib.serverless.providers.aws.getAccountId()
  .then(accountId => ({
    entry: './handler.js',
    target: 'node',
    plugins: [
      new webpack.DefinePlugin({
        AWS_ACCOUNT_ID: `${accountId}`,
      }),
    ],
    module: {
      loaders: [ ... ]
    }
  }));
});
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

The current stage e.g is accessible through `slsw.lib.options.stage`

This enables you to have a fully customized dynamic configuration, that can evaluate
anything available in the Serverless framework. There are really no limits.

Samples are: The current stage and the complete service definition. You thereby
have access to anything that a Serverless plugin would have access to.

Both properties should be handled with care and should never be written to,
as that will modify the running framework and leads to unpredictable behavior!

If you have cool use cases with the full customization, we might add your solution
to the plugin examples as showcase.

#### Invocation state

`lib.webpack` contains state variables that can be used to configure the build
dynamically on a specific plugin state.

##### isLocal

`lib.webpack.isLocal` is a boolean property that is set to true, if any known
mechanism is used in the current Serverless invocation that runs code locally.

This allows to set properties in the webpack configuration differently depending
if the lambda code is run on the local machine or deployed.

A sample is to set the compile mode with Webpack 4:

```
mode: slsw.lib.webpack.isLocal ? "development" : "production"
```

### Output

Note that, if the `output` configuration is not set, it will automatically be
generated to write bundles in the `.webpack` directory. If you set your own `output`
configuration make sure to add a [`libraryTarget`][link-webpack-libtarget]
for best compatibility with external dependencies:

```js
// webpack.config.js
const path = require('path');

module.exports = {
  // ...
  output: {
    libraryTarget: 'commonjs',
    path: path.resolve(__dirname, '.webpack'),
    filename: '[name].js'
  }
  // ...
};
```

### Stats

By default, the plugin will print a quite verbose bundle information to your console. However, if
you are not satisfied with the current output info, you can overwrite it in your `webpack.config.js`

```js
// webpack.config.js

module.exports = {
  // ...
  stats: 'minimal'
  // ...
};
```

All the stats config can be found in [webpack's documentation][link-webpack-stats]

### Node modules / externals

By default, the plugin will try to bundle all dependencies. However, you don't
want to include all modules in some cases such as selectively import, excluding
builtin package (ie: `aws-sdk`) and handling webpack-incompatible modules.

In this case you might add external modules in
[Webpack's `externals` configuration][link-webpack-externals].
Those modules can be included in the Serverless bundle with the `custom: webpack: includeModules`
option in `serverless.yml`:

```js
// webpack.config.js
var nodeExternals = require('webpack-node-externals');

module.exports = {
  // we use webpack-node-externals to excludes all node deps.
  // You can manually set the externals too.
  externals: [nodeExternals()]
};
```

```yaml
# serverless.yml
custom:
  webpack:
    includeModules: true # enable auto-packing of external modules
```

All modules stated in `externals` will be excluded from bundled files. If an excluded module
is stated as `dependencies` in `package.json` and it is used by the webpack chunk, it will be
packed into the Serverless artifact under the `node_modules` directory.

By default, the plugin will use the `package.json` file in working directory, If you want to
use a different package file, set `packagePath` to your custom `package.json`:

```yaml
# serverless.yml
custom:
  webpack:
    includeModules:
      packagePath: '../package.json' # relative path to custom package.json file.
```

> Note that only relative path is supported at the moment.


`peerDependencies` of all above external dependencies will also be packed into the Serverless
artifact. By default, `node_modules` in the same directory as `package.json` (current working directory
or specified by`packagePath`) will be used.

However in some configuration (like monorepo), `node_modules` is in parent directory which is different from
where `package.json` is. Set `nodeModulesRelativeDir` to specify the relative directory where `node_modules` is.

```yaml
# serverless.yml
custom:
  webpack:
    includeModules:
      nodeModulesRelativeDir: '../../' # relative path to current working directory.
```

#### Runtime dependencies

If a runtime dependency is detected that is found in the `devDependencies` section and
so would not be packaged, the plugin will error until you explicitly exclude it (see `forceExclude` below)
or move it to the `dependencies` section.

#### AWS-SDK

An exception for the runtime dependency error is the AWS-SDK. All projects using the AWS-SDK normally
have it listed in `devDependencies` because AWS provides it already in their Lambda environment. In this case
the aws-sdk is automatically excluded and only an informational message is printed (in `--verbose` mode).

The main reason for the warning is, that silently ignoring anything contradicts the declarative nature
of Serverless' service definition. So the correct way to define the handling for the aws-sdk is, as
you would do for all other excluded modules (see `forceExclude` below).

```yaml
# serverless.yml
custom:
  webpack:
    includeModules:
      forceExclude:
        - aws-sdk
```

#### Packagers

You can select the packager that will be used to package your external modules.
The packager can be set with the packager configuration. Currently it can be 'npm'
or 'yarn' and defaults to using npm when not set.

```yaml
# serverless.yml
custom:
  webpack:
    packager: 'yarn' # Defaults to npm
    packagerOptions: {} # Optional, depending on the selected packager
```

You should select the packager, that you use to develop your projects, because only
then locked versions will be handled correctly, i.e. the plugin uses the generated
(and usually committed) package lock file that is created by your favorite packager.

Each packager might support specific options that can be set in the `packagerOptions`
configuration setting. For details see below.

##### NPM

By default, the plugin uses NPM to package the external modules. However, if you use npm,
you should use any version `<5.5 >=5.7.1` as the versions in-between have some nasty bugs.

Right now there are no `packagerOptions` that can be set with NPM.

##### Yarn

Using yarn will switch the whole packaging pipeline to use yarn, so does it use a `yarn.lock` file.

The yarn packager supports the following `packagerOptions`:

| Option             | Type | Default | Description                                         |
| ------------------ | ---- | ------- | --------------------------------------------------- |
| ignoreScripts      | bool | false   | Do not execute package.json hook scripts on install |
| noFrozenLockfile   | bool | false   | Do not require an up-to-date yarn.lock              |
| networkConcurrency | int  |         | Specify number of concurrent network requests       |

##### Common packager options

There are some settings that are common to all packagers and affect the packaging itself.

###### Custom scripts

You can specify custom scripts that are executed after the installation of the function/service packages
has been finished. These are standard packager scripts as they can be used in any `package.json`.

Warning: The use cases for them are very rare and specific and you should investigate first,
if your use case can be covered with webpack plugins first. They should never access files
outside of their current working directory which is the compiled function folder, if any.
A valid use case would be to start anything available as binary from `node_modules`.

```yaml
custom:
  webpack:
    packagerOptions:
      scripts:
        - npm rebuild grpc --target=6.1.0 --target_arch=x64 --target_platform=linux --target_libc=glibc
```

#### Forced inclusion

Sometimes it might happen that you use dynamic requires in your code, i.e. you
require modules that are only known at runtime. Webpack is not able to detect
such externals and the compiled package will miss the needed dependencies.
In such cases you can force the plugin to include certain modules by setting
them in the `forceInclude` array property. However the module must appear in
your service's production dependencies in `package.json`.

```yaml
# serverless.yml
custom:
  webpack:
    includeModules:
      forceInclude:
        - module1
        - module2
```

#### Forced exclusion

You can forcefully exclude detected external modules, e.g. if you have a module
in your dependencies that is already installed at your provider's environment.

Just add them to the `forceExclude` array property and they will not be packaged.

```yaml
# serverless.yml
custom:
  webpack:
    includeModules:
      forceExclude:
        - module1
        - module2
```

If you specify a module in both arrays, `forceInclude` and `forceExclude`, the
exclude wins and the module will not be packaged.

#### Local modules

You can use `file:` version references in your `package.json` to use a node module
from a local folder (e.g. `"mymodule": "file:../../myOtherProject/mymodule"`).
With that you can do test deployments from the local machine with different
module versions or modules before they are published officially.

#### Exclude Files with similar names

If you have a project structure that uses something like `index.js` and a
co-located `index.test.js` then you have likely seen an error like:
`WARNING: More than one matching handlers found for index. Using index.js`

This config option allows you to exclude files that match a glob from function
resolution. Just add: `excludeFiles: **/*.test.js` (with whatever glob you want
to exclude).

```yaml
# serverless.yml
custom:
  webpack:
    excludeFiles: **/*.test.js
```

This is also useful for projects that use TypeScript.

#### Exclude Files with Regular Expression

This config option allows you to filter files that match a regex pattern before
adding to the zip file. Just add: `excludeRegex: \.ts|test|\.map` (with whatever
regex you want to exclude).

```yaml
# serverless.yml
custom:
  webpack:
    excludeRegex: \.ts|test|\.map
```

#### Keep output directory after packaging

You can keep the output directory (defaults to `.webpack`) from being removed
after build.

Just add `keepOutputDirectory: true`

```yaml
# serverless.yml
custom:
  webpack:
    keepOutputDirectory: true
```

This can be useful, in case you want to upload the source maps to your Error
reporting system, or just have it available for some post processing.

#### Nodejs custom runtime

If you are using a nodejs custom runtime you can add the property `allowCustomRuntime: true`.

```yaml
exampleFunction:
  handler: path/to/your/handler.default
  runtime: provided
  allowCustomRuntime: true
```

⚠️ **Note: this will only work if your custom runtime and function are written in JavaScript.
Make sure you know what you are doing when this option is set to `true`**

#### Examples

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
---
package:
  individually: true
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

The individual packaging will automatically apply the _automatic entry resolution_ (see above) and
you will not be able to configure the entry config in webpack. An error will be thrown
if you are trying to override the entry in webpack.config.js with other unsupported values.

The individual packaging needs more time at the packaging phase, but you'll
get that paid back twice at runtime.

#### Individual packaging concurrency

```yaml
# serverless.yml
custom:
  webpack:
    concurrency: 5 # desired concurrency, defaults to the number of available cores
    serializedCompile: true # backward compatible, this translates to concurrency: 1
```

Will run each webpack build one at a time which helps reduce memory usage and in some cases impoves overall build performance.

### Support for Docker Images as Custom Runtimes
AWS Lambda and `serverless` started supporting the use of Docker images as custom runtimes in 2021. See the [serverless documentation](https://www.serverless.com/blog/container-support-for-lambda) for details on how to configure a `serverless.yml` to use these features.

**NOTE: You must provide an override for the Image `CMD` property in your function definitions.**
See [Dockerfile documentation](https://docs.docker.com/engine/reference/builder/#cmd) for more information about the native Docker `CMD` property.

In the following example `entrypoint` is inherited from the shared Docker image, while `command` is provided as an override for each function:
```yaml
# serverless.yml
functions:
  myFunction1:
    image:
      name: public.ecr.aws/lambda/nodejs:12
      command:
        - app.handler1
  myFunction2:
    image:
      name: public.ecr.aws/lambda/nodejs:12
      command:
        - app.handler2
```

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

#### Run a function with an existing compiled output (--no-build)

On CI systems it is likely that you'll run multiple integration tests with `invoke local`
sequentially. To improve this, you can do one compile and run multiple invokes on the
compiled output - it is not necessary to compile again before each and every invoke.

```bash
$ serverless webpack
$ serverless invoke local --function <function-name-1> --no-build
$ serverless invoke local --function <function-name-2> --no-build
...
```

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

### Usage with serverless run (Serverless Event Gateway)

The `serverless run` command is supported with the plugin. To test a local
service with the Serverless Emulator, you can use the `serverless run`
command as documented by Serverless. The command will compile the code before
it uploads it into the event gateway.

#### Serverless run with webpack watch mode

You can enable source watch mode with `serverless run --watch`. The plugin will
then watch for any source changes, recompile and redeploy the code to the event
gateway. So you can just keep the event gateway running and test new code immediately.

### Usage with serverless-offline

The plugin integrates very well with [serverless-offline][link-serverless-offline] to
simulate AWS Lambda and AWS API Gateway locally.

Add the plugins to your `serverless.yml` file and make sure that `serverless-webpack`
precedes `serverless-offline` as the order is important:

```yaml
plugins: ...
  - serverless-webpack
  ...
  - serverless-offline
  ...
```

Run `serverless offline` or `serverless offline start` to start the Lambda/API simulation.

In comparison to `serverless offline`, the `start` command will fire an `init` and a `end` lifecycle hook which is needed for `serverless-offline` and e.g. `serverless-dynamodb-local` to switch off resources (see below).

You can find an example setup in the [`examples`][link-examples] folder.

By default the plugin starts in watch mode when triggered through `serverless offline`, i.e.
it automatically recompiles your code if it detects a change in the used sources.
After a change it might take some seconds until the emulated endpoints are updated.

If you have your sources located on a file system that does not offer events,
e.g. a mounted volume in a Docker container, you can enable polling with the
`--webpack-use-polling=<time in ms>` option. If you omit the value, it defaults
to 3000 ms.

If you don't want the plugin to build when using `serverless-offline`, select the `--no-build` option.

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

If you use serverless offline to run your integration tests, you might want to
disable the automatic watch mode with the `--webpack-no-watch` switch.

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

### vscode debugging

To debug your functions using `serverless invoke local` or `serverless-offline`
check this [`.vscode/launch.json example`][link-examples-babel-webpack-4-vscode-launch].

## Example with Babel

In the [`examples`][link-examples] folder there is a Serverless project using this
plugin with Babel. To try it, from inside the example folder:

- `npm install` to install dependencies
- `serverless invoke local -f hello` to run the example function

## Provider Support

Plugin commands are supported by the following providers. ⁇ indicates that command has not been tested with that provider.

|                      | AWS Lambda | Apache OpenWhisk | Azure Functions | Google Cloud Functions |
| -------------------- | ---------- | ---------------- | --------------- | ---------------------- |
| webpack              | ✔︎         | ✔︎               | ⁇               | ⁇                      |
| invoke local         | ✔︎         | ✔︎               | ⁇               | ⁇                      |
| invoke local --watch | ✔︎         | ✔︎               | ⁇               | ⁇                      |

## Plugin support

The following serverless plugins are explicitly supported with `serverless-webpack`

| Plugin                            | NPM                                                               |
| --------------------------------- | ----------------------------------------------------------------- |
| serverless-offline                | [![NPM][ico-serverless-offline]][link-serverless-offline]         |
| serverless-step-functions-offline | [![NPM][ico-step-functions-offline]][link-step-functions-offline] |

## For developers

The plugin exposes a complete lifecycle model that can be hooked by other plugins to extend
the functionality of the plugin or add additional actions.

### The event lifecycles and their hookable events (H)

All events (H) can be hooked by a plugin.

```
-> webpack:validate
   -> webpack:validate:validate (H)
-> webpack:compile
   -> webpack:compile:compile (H)
   -> webpack:compile:watch:compile (H)
-> webpack:package
   -> webpack:package:packExternalModules (H)
   -> webpack:package:packageModules (H)
```

### Integration of the lifecycles into the command invocations and hooks

The following list shows all lifecycles that are invoked/started by the
plugin when running a command or invoked by a hook.

```
-> before:package:createDeploymentArtifacts
   -> webpack:validate
   -> webpack:compile
   -> webpack:package

-> before:deploy:function:packageFunction
   -> webpack:validate
   -> webpack:compile
   -> webpack:package

-> before:invoke:local:invoke
   -> webpack:validate
   -> webpack:compile

-> webpack
   -> webpack:validate
   -> webpack:compile
   -> webpack:package

-> before:offline:start
   -> webpack:validate
   -> webpack:compile

-> before:offline:start:init
   -> webpack:validate
   -> webpack:compile
```

## Thanks

Special thanks go to the initial author of serverless-webpack, [Nicola Peduzzi](https://github.com/thenikso), who allowed
me to take it over and continue working on the project. That helped to revive it and lead it to new horizons.

## Release Notes

See [CHANGELOG.md](./CHANGELOG.md)

[ico-serverless]: http://public.serverless.com/badges/v3.svg
[ico-license]: https://img.shields.io/github/license/serverless-heaven/serverless-webpack.svg
[ico-npm]: https://img.shields.io/npm/v/serverless-webpack.svg
[ico-build]: https://travis-ci.org/serverless-heaven/serverless-webpack.svg?branch=master
[ico-coverage]: https://coveralls.io/repos/github/serverless-heaven/serverless-webpack/badge.svg?branch=master
[ico-contributors]: https://img.shields.io/github/contributors/serverless-heaven/serverless-webpack.svg
[link-serverless]: https://www.serverless.com/
[link-license]: ./blob/master/LICENSE
[link-npm]: https://www.npmjs.com/package/serverless-webpack
[link-build]: https://travis-ci.org/serverless-heaven/serverless-webpack
[link-coverage]: https://coveralls.io/github/serverless-heaven/serverless-webpack?branch=master
[link-contributors]: https://github.com/serverless-heaven/serverless-webpack/graphs/contributors
[link-webpack]: https://webpack.github.io/
[link-babel]: https://babeljs.io/
[link-webpack-stats]: https://webpack.js.org/configuration/stats/
[link-webpack-loaders]: https://webpack.js.org/concepts/loaders/
[link-webpack-libtarget]: https://webpack.js.org/configuration/output/#output-librarytarget
[link-webpack-tree]: https://webpack.js.org/guides/tree-shaking/
[link-webpack-externals]: https://webpack.js.org/configuration/externals/
[link-examples]: ./examples
[link-examples-babel-webpack-4-vscode-launch]: ./examples/babel-webpack-4/.vscode/launch.json
[link-serverless-offline]: https://www.npmjs.com/package/serverless-offline
[ico-serverless-offline]: https://img.shields.io/npm/v/serverless-offline.svg
[link-serverless-dynamodb-local]: https://www.npmjs.com/package/serverless-dynamodb-local
[link-step-functions-offline]: https://www.npmjs.com/package/serverless-step-functions-offline
[ico-step-functions-offline]: https://img.shields.io/npm/v/serverless-step-functions-offline.svg
