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
* Support of `serverless run` and `serverless run --watch`
* Integrates with [`serverless-offline`][link-serverless-offline] to simulate local API Gateway endpoints
* When enabled in your service configuration, functions are packaged and compiled
individually, resulting in smaller Lambda packages that contain only the code and
dependencies needed to run the function. This allows the plugin to fully utilize
WebPack's [Tree-Shaking][link-webpack-tree] optimization.
* Webpack version 3, 4 and 5 support
* Support NPM and Yarn for packaging
* Support asynchronous webpack configuration

## Recent improvements and important changes for 5.x

* Support Yarn
* Support Webpack 4 and 5
* Cleaned up configuration. You should now use a `custom.webpack` object to configure everything relevant for the plugin. The old configuration still works but will be removed in the next major release. For details see below.
* Added support for asynchronous webpack configuration

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
    webpackConfig: 'webpack.config.js'   # Name of webpack configuration file
    includeModules: false   # Node modules configuration for packaging
    packager: 'npm'   # Packager that will be used to package your external modules
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
    filename: '[name].js',
  },
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
}
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
    packager: 'yarn'      # Defaults to npm
    packagerOptions: {}   # Optional, depending on the selected packager
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

| Option        | Type | Default | Description |
|---------------|------|---------|-------------|
| ignoreScripts | bool | true    | Do not execute package.json hook scripts on install |

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

This config option allows you to exlcude files that match a glob from function
resolution. Just add: `excludeFiles: **/*.test.js` (with whatever glob you want
to exclude).

```yaml
# serverless.yml
custom:
  webpack:
    excludeFiles: **/*.test.js
```

This is also useful for projects that use TypeScript.

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

The individual packaging will automatically apply the _automatic entry resolution_ (see above) and
you will not be able to configure the entry config in webpack. An error will be thrown
if you are trying to override the entry in webpack.config.js with other unsupported values.

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

#### Run a function with an existing compiled output (--no-build)

On CI systems it is likely that you'll run multiple integration tests with `invoke local`
sequentially. To improve this, you can do one compile and run multiple invokes on the
compiled output -  it is not necessary to compile again before each and every invoke.

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

By default the plugin starts in watch mode when triggered through `serverless offline`, i.e.
it automatically recompiles your code if it detects a change in the used sources.
After a change it might take some seconds until the emulated endpoints are updated.

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

If you use serverless offline to run your integration tests, you might want to
disable the automatic watch mode with the `--webpack-no-watch` switch.

### Bundle with webpack

To just bundle and see the output result use:

```bash
$ serverless webpack --out dist
```

Options are:

- `--out` or `-o` (optional) The output directory. Defaults to `.webpack`.

You may find this option useful in CI environments where you want to build the package once but deploy the same artifact to many environments. To use existing output, specify the `--no-build` flag.

```bash
$ serverless deploy --no-build --out dist
```

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

|                       | AWS Lambda | Apache OpenWhisk | Azure Functions | Google Cloud Functions |
|-----------------------|------------|------------------|-----------------|------------------------|
| webpack               |      ✔︎     |         ✔︎        |        ⁇        |            ⁇           |
| invoke local          |      ✔︎     |         ✔︎        |        ⁇        |            ⁇           |
| invoke local --watch  |      ✔︎     |         ✔︎        |        ⁇        |            ⁇           |

## Plugin support

The following serverless plugins are explicitly supported with `serverless-webpack`

| Plugin                            | NPM |
|-----------------------------------|-----|
| serverless-offline | [![NPM][ico-serverless-offline]][link-serverless-offline] |
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

Special thanks go to the initial author of serverless-webpack, Nicola Peduzzi (https://github.com/thenikso), who allowed
me to take it over and continue working on the project. That helped to revive it and lead it to new horizons.

## Release Notes

* 5.3.1
  * Fixed bug that prevented to use handlers using import [#505][link-505]
  * Do not print empty lines in webpack stats [#499][link-499]
  * Added git hooks to improved code quality and developer experience [#496][link-496]

* 5.3.0
  * Restore compatibility with TypeScript [#449][link-449] [#465][link-465]
  * Allow glob for excludeFiles [#471][link-471]
  * Support Webpack 5 [#472][link-472]
  * Use colored output depending on tty [#480][link-480]
  * Allow to keep webpack folder [#453][link-453] [#467][link-467]
  * Add ability to exclude files from handler lookup [#433][link-433]
  * Documentation fixes [#429][link-429]

* 5.2.0
  * Show info message in verbose mode if aws-sdk has been excluded automatically [#393][link-393]
  * Added support for asynchronous webpack configuration [#412][link-412]
  * Better error message if handlers are not found [#418][link-418]

* 5.1.5
  * Re-publish of 5.1.4 without yarn.lock

* 5.1.4
  * Fix support for Yarn resolutions definitions [#379][link-379]
  * Better debugging for "Unable to import module ..." errors: Detect runtime dependencies that are only declared as devDependencies [#384][link-384]
  * Documentation updates [#382][link-382]

* 5.1.3
  * Fixed issue with Yarn and file references as dependencies [#370][link-370]

* 5.1.2
  * Fixed issue that leads to `Unexpected end of JSON` in projects with lots of dependencies [#309][link-309][#373][link-373]
  * Update webpack-4 example with VSCode debugging configuration [#365][link-365]

* 5.1.1
  * Fixed local invoke watch mode not executing changed files [#349][link-349]
  * Added Webpack 4 example [#355][link-355]
  * Documentation updates [#354][link-354]

* 5.1.0
  * Support Yarn [#286][link-286]
  * Allow local invoke to use existing compiled output [#341][link-341] [#275][link-275]
  * Support custom packager scripts [#343][link-343] [#342][link-342]

* 5.0.0
  * Support Webpack 4 [#331][link-331] [#328][link-328]
  * BREAKING: Drop support for Webpack 2
  * Allow to check for local invocation in the webpack configuration [#232][link-232]
  * New centralized configuration with fallback to the old one [#336][link-336]
  * Improved unit tests and actual coverage calculation [#337][link-337]

* 4.4.0
  * Support serverless-step-functions-offline [#313][link-313]
  * Fixed webpack documentation links [#326][link-326]
  * Abstracted packager interface [#329][link-329]

* 4.3.0
  * Add new `webpack:compile:watch:compile` event [#315][link-315]
  * Added note to README about using yarn [#316][link-316]
  * Made babel dynamic example the default babel example [#253][link-253]
  * Documentation fixes [#317][link-317] [#321][link-321]

* 4.2.0
  * Support local file references in package.json [#263][link-263]
  * Updated used tools (dev dependencies)

* 4.1.0
  * Prohibit manual entry configuration with individual packaging [#272][link-272]
  * Fixed bug with stats in webpack config for individual packaging [#278][link-278]
  * Fixed bug with startup order in combination with serverless-offline [#279][link-279]
  * Default target to "node" if not set [#276][link-276]
  * Support `serverless run` including watch mode [#269][link-269]

* 4.0.0
  * BREAKING: Expose lifecycle events for plugin authors [#254][link-254]
  * Fixed deprecated hook warning [#126][link-126]
  * Support forceExclude option for external modules [#247][link-247]
  * Support stats output configuration in webpack config [#260][link-260]
  * Google: Only integrate package.json but not node modules into artifact [#264][link-264]
  * Documentation fixes and updates [#265][link-265]
  * Updated examples [#250][link-250]

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

[link-126]: https://github.com/serverless-heaven/serverless-webpack/issues/126
[link-247]: https://github.com/serverless-heaven/serverless-webpack/issues/247
[link-250]: https://github.com/serverless-heaven/serverless-webpack/issues/250
[link-254]: https://github.com/serverless-heaven/serverless-webpack/pull/254
[link-260]: https://github.com/serverless-heaven/serverless-webpack/issues/260
[link-264]: https://github.com/serverless-heaven/serverless-webpack/pull/264
[link-265]: https://github.com/serverless-heaven/serverless-webpack/pull/265

[link-272]: https://github.com/serverless-heaven/serverless-webpack/issues/272
[link-278]: https://github.com/serverless-heaven/serverless-webpack/pull/278
[link-279]: https://github.com/serverless-heaven/serverless-webpack/issues/279
[link-276]: https://github.com/serverless-heaven/serverless-webpack/issues/276
[link-269]: https://github.com/serverless-heaven/serverless-webpack/issues/269

[link-263]: https://github.com/serverless-heaven/serverless-webpack/issues/263

[link-286]: https://github.com/serverless-heaven/serverless-webpack/issues/286

[link-315]: https://github.com/serverless-heaven/serverless-webpack/issues/315
[link-316]: https://github.com/serverless-heaven/serverless-webpack/issues/316
[link-253]: https://github.com/serverless-heaven/serverless-webpack/issues/253
[link-317]: https://github.com/serverless-heaven/serverless-webpack/pull/317
[link-321]: https://github.com/serverless-heaven/serverless-webpack/pull/321

[link-313]: https://github.com/serverless-heaven/serverless-webpack/pull/313
[link-326]: https://github.com/serverless-heaven/serverless-webpack/pull/326
[link-329]: https://github.com/serverless-heaven/serverless-webpack/issues/329

[link-232]: https://github.com/serverless-heaven/serverless-webpack/issues/232
[link-331]: https://github.com/serverless-heaven/serverless-webpack/issues/331
[link-328]: https://github.com/serverless-heaven/serverless-webpack/pull/328
[link-336]: https://github.com/serverless-heaven/serverless-webpack/pull/336
[link-337]: https://github.com/serverless-heaven/serverless-webpack/pull/337

[link-275]: https://github.com/serverless-heaven/serverless-webpack/issues/275
[link-286]: https://github.com/serverless-heaven/serverless-webpack/issues/286
[link-341]: https://github.com/serverless-heaven/serverless-webpack/issues/341
[link-342]: https://github.com/serverless-heaven/serverless-webpack/issues/342
[link-343]: https://github.com/serverless-heaven/serverless-webpack/issues/343

[link-349]: https://github.com/serverless-heaven/serverless-webpack/issues/349
[link-354]: https://github.com/serverless-heaven/serverless-webpack/pull/354
[link-355]: https://github.com/serverless-heaven/serverless-webpack/pull/355

[link-309]: https://github.com/serverless-heaven/serverless-webpack/issues/309
[link-365]: https://github.com/serverless-heaven/serverless-webpack/pull/365
[link-373]: https://github.com/serverless-heaven/serverless-webpack/pull/373

[link-370]: https://github.com/serverless-heaven/serverless-webpack/issues/370

[link-379]: https://github.com/serverless-heaven/serverless-webpack/issues/379
[link-382]: https://github.com/serverless-heaven/serverless-webpack/pull/382
[link-384]: https://github.com/serverless-heaven/serverless-webpack/pull/384

[link-393]: https://github.com/serverless-heaven/serverless-webpack/issues/393
[link-412]: https://github.com/serverless-heaven/serverless-webpack/issues/412
[link-418]: https://github.com/serverless-heaven/serverless-webpack/issues/418

[link-453]: https://github.com/serverless-heaven/serverless-webpack/issues/453
[link-467]: https://github.com/serverless-heaven/serverless-webpack/issues/467
[link-449]: https://github.com/serverless-heaven/serverless-webpack/issues/449
[link-465]: https://github.com/serverless-heaven/serverless-webpack/issues/465
[link-480]: https://github.com/serverless-heaven/serverless-webpack/issues/480
[link-429]: https://github.com/serverless-heaven/serverless-webpack/pull/429
[link-433]: https://github.com/serverless-heaven/serverless-webpack/issues/433
[link-471]: https://github.com/serverless-heaven/serverless-webpack/issues/471
[link-472]: https://github.com/serverless-heaven/serverless-webpack/pull/472

[link-505]: https://github.com/serverless-heaven/serverless-webpack/issues/505
[link-499]: https://github.com/serverless-heaven/serverless-webpack/issues/499
[link-496]: https://github.com/serverless-heaven/serverless-webpack/pull/496
