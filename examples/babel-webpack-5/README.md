This is the default babel webpack-4 example to look at, because only dynamic
entry point resolution lets you use Serverless completely.
Individual packaging with a per-function dependency optimization is only
available with that approach.

You can also try to invoke a function locally:
```
serverless invoke local --function=first --path=./event.json
```

Also it has a [.vscode/launch.json](.vscode/launch.json) file for debugging the
functions using `vscode`.