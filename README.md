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

The normal Serverless deploy procedure will automatically bundle with Webpack:

- Create the Serverless project with `serverless create -t aws-node`
- Install Serverless Webpack as above
- Deploy with `serverless deploy`

To run your bundled functions locally you can:

```
serverless webpack run --function <function-name>
```

Or to run a function every time the source files change use `watch`:

```
serverless webpack watch --function <function-name> --path event.json
```

For both commands the options are:

- `--function` or `-f` (required) is the name of the function to run
- `--path` or `-p` (optional) is a JSON file path used as the function input event

Lastly use `serverless webpack --out dist` to compile files in the `dist` directory.

