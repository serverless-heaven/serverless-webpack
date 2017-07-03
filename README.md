# Serverless Webpack

[![Serverless][ico-serverless]][link-serverless]
[![CircleCI][ico-circleci]][link-circleci]
[![NPM][ico-npm]][link-npm]
[![Contributors][ico-contributors]][link-contributors]

A Serverless v1.x plugin to build your lambda functions with [Webpack][link-webpack].

This plugin is for you if you want to use the latest Javascript version with [Babel][link-babel];
use custom [resource loaders][link-webpack-loaders];
try your lambda functions locally and much more!

> **BREAKING CHANGE IN v2**: `webpack` must now be installed alongside `serverless-webpack` as a peer dependency. This allows more control over which version of Webpack to run.

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

modules.export = {
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

You can find an example setups in the [`examples`][link-examples] folder.

## Usage

### Automatic bundling

The normal Serverless deploy procedure will automatically bundle with Webpack:

- Create the Serverless project with `serverless create -t aws-nodejs`
- Install Serverless Webpack as above
- Deploy with `serverless deploy`

### Use with serverless-offline

- Put the serverless-webpack plugin before the serverless-offline plugin in your configuration file.
```yaml
plugins:
  - serverless-webpack
  - serverless-offline
```

- Let serverless-offline know where the bundles are built
```
> serverless offline start --location .webpack 
```


### Simulate API Gateway locally

To start a local server that will act like the API Gateway use the following command.
Your code will be reloaded upon change so that every request to your local server
will serve the latest code.

```bash
$ serverless webpack serve
```

Options are:

- `--port` or `-p` (optional) The local server port. Defaults to `8000`

The `serve` command will automatically look for the local `serverless.yml` and serve
all the `http` events. For example this configuration will generate a GET endpoint:

```yaml
functions:
  hello:
    handler: handler.hello
    events:
      - http:
          method: get
          path: hello
```

### Run a function locally

To run your bundled functions locally you can:

```bash
$ serverless webpack invoke --function <function-name>
```

Options are:

- `--function` or `-f` (required) is the name of the function to run
- `--path` or `-p` (optional) is a JSON file path used as the function input event

### Run a function locally on source changes

Or to run a function every time the source files change use `watch`:

```bash
$ serverless webpack watch --function <function-name> --path event.json
```

Options are:

- `--function` or `-f` (required) is the name of the function to run
- `--path` or `-p` (optional) is a JSON file path used as the function input event

### Using with serverless-offline and serverless-webpack plugin

 Run `serverless offline start`. In comparison with `serverless offline`, the `start` command will fire an `init` and a `end` lifecycle hook which is needed for serverless-offline and serverless-dynamodb-local to switch off both resources. 
 
 Add plugins to your `serverless.yml` file:
 ```yaml
 plugins:
   - serverless-webpack
   - serverless-dynamodb-local
   - serverless-offline #serverless-offline needs to be last in the list
 ```

### Bundle with webpack

To just bundle and see the output result use:

```bash
$ serverless webpack --out dist
```

Options are:

- `--out` or `-o` (optional) The output directory. Defaults to `.webpack`.

## Example with Babel

In the [`examples`][link-examples] folder there is a Serverless project using this
plugin with Babel. To try it, from inside the example folder:

- `npm install` to install dependencies
- `serverless webpack run -f hello` to run the example function

[ico-serverless]: http://public.serverless.com/badges/v3.svg
[ico-circleci]: https://img.shields.io/circleci/project/github/elastic-coders/serverless-webpack.svg
[ico-npm]: https://img.shields.io/npm/v/serverless-webpack.svg
[ico-contributors]: https://img.shields.io/github/contributors/elastic-coders/serverless-webpack.svg

[link-serverless]: http://www.serverless.com/
[link-circleci]: https://circleci.com/gh/elastic-coders/serverless-webpack/
[link-npm]: https://www.npmjs.com/package/serverless-webpack
[link-contributors]: https://github.com/elastic-coders/serverless-webpack/graphs/contributors

[link-webpack]: https://webpack.github.io/
[link-babel]: https://babeljs.io/
[link-webpack-loaders]: https://webpack.github.io/docs/loaders.html
[link-webpack-libtarget]: https://webpack.github.io/docs/configuration.html#output-librarytarget
[link-webpack-externals]: https://webpack.github.io/docs/configuration.html#externals
[link-examples]: ./examples
