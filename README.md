# Serverless Webpack

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

A Serverless v1.0 plugin to build your lambda functions with [Webpack](https://webpack.github.io).

## Install

```
npm install serverless-webpack
```

Add the plugin to your `serverless.yml` file:

```yaml
plugins:
  - serverless-webpack
```

By default the plugin will look for a `webpack.config.js` in the service directory.
In alternative you can specify a different file or configuration in the `serverless.yml` with:

```yaml
custom:
  webpack: ./folder/my-webpack.config.js
```

Note that, if the `output` configuration is not set, it will automatically be
generated to write bundles in the `.webpack` directory.

## Usage
### Automatic bundling

The normal Serverless deploy procedure will automatically bundle with Webpack:

- Create the Serverless project with `serverless create -t aws-node`
- Install Serverless Webpack as above
- Deploy with `serverless deploy`

### Run a function locally

To run your bundled functions locally you can:

```
serverless webpack invoke --function <function-name>
```

Options are:

- `--function` or `-f` (required) is the name of the function to run
- `--path` or `-p` (optional) is a JSON file path used as the function input event

### Run a function locally on source changes

Or to run a function every time the source files change use `watch`:

```
serverless webpack watch --function <function-name> --path event.json
```

Options are:

- `--function` or `-f` (required) is the name of the function to run
- `--path` or `-p` (optional) is a JSON file path used as the function input event

### Bundle with webpack

To just bundle and see the output result use:

```
serverless webpack --out dist
```

Options are:

- `--out` or `-o` (optional) The output directory. Defaults to `.webpack`.

## Example with Babel

In the `example` folder there is a Serverless project using this plugin with Babel.
To try it, from inside the example folder:

- `npm install` to install dependencies
- `serverless webpack run -f hello` to run the example function
