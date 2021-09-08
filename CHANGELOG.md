# Change Log

* 5.5.4
  * Fix the way to detect external module from Webpack ([#953][] @j0k3r)

[#944]: https://github.com/serverless-heaven/serverless-webpack/pull/953

* 5.5.3
  * Fallback on using service provider runtime when using `sls deploy function` ([#944][] @mostthingsweb)

[#944]: https://github.com/serverless-heaven/serverless-webpack/pull/944

* 5.5.2
  * Register `serverless` as peer dependency ([#900][] @medikoo)
  * Do not run webpack on a single non-node function ([#879][] @j0k3r)
  * Skip container function with `uri` defined ([#877][] @j0k3r)

[#900]: https://github.com/serverless-heaven/serverless-webpack/pull/900
[#879]: https://github.com/serverless-heaven/serverless-webpack/pull/879
[#877]: https://github.com/serverless-heaven/serverless-webpack/pull/877

* 5.5.1
  * chore: use processedOptions ([#834][] @CorentinDoue)
  * Reduce memory usage by releasing webpack stats objects after compile ([#858][] @janicduplessis)
  * (fix) allow boolean or number values in slsw.lib.options ([#857][] @coyoteecd)
  * Fix packaging for non-node functions ([#876][] @FatalTouch)

[#834]: https://github.com/serverless-heaven/serverless-webpack/pull/834
[#858]: https://github.com/serverless-heaven/serverless-webpack/pull/858
[#876]: https://github.com/serverless-heaven/serverless-webpack/pull/876
[#857]: https://github.com/serverless-heaven/serverless-webpack/pull/857

* 5.5.0
  * Add ability to specify the node_modules relative dir ([#689][] @ypxing)
  * Fix the spawn E2BIG error when zipping ([#813][] @j0k3r)
  * Extends the --no-build option to serverless offline start ([#770][] @nponeccop)
  * Add Serverless Container Support ([#723][] @rogersgt)
  * Add support for Yarn network-concurrency option ([#550][] @cfroese)

[#689]: https://github.com/serverless-heaven/serverless-webpack/pull/689
[#813]: https://github.com/serverless-heaven/serverless-webpack/pull/813
[#770]: https://github.com/serverless-heaven/serverless-webpack/pull/770
[#723]: https://github.com/serverless-heaven/serverless-webpack/pull/723
[#550]: https://github.com/serverless-heaven/serverless-webpack/pull/550

* 5.4.2
  * Regression Fix: Empty lines while stats: 'errors-only' ([#773][] @Enase)
  * Add type to CLI options ([#774][] @j0k3r)
  * Add Serverless v2 compatibility ([#775][] @nponeccop)
  * Support local errors with NPM 7 workspaces ([#782][] @mikejpeters)
  * Fix `excludeRegex` option and allow dotfiles to be packaged ([#780][] @l1b3r)
  * Correctly handle packaging for function during `deploy -f` ([#794][] @pgrzesik)

[#773]: https://github.com/serverless-heaven/serverless-webpack/pull/773
[#774]: https://github.com/serverless-heaven/serverless-webpack/pull/774
[#775]: https://github.com/serverless-heaven/serverless-webpack/pull/775
[#782]: https://github.com/serverless-heaven/serverless-webpack/pull/782
[#780]: https://github.com/serverless-heaven/serverless-webpack/pull/780
[#794]: https://github.com/serverless-heaven/serverless-webpack/pull/794

* 5.4.1
  * Display the zip method used ([#735][] @j0k3r)
  * Dependabot should now updates package.json too ([#742][] @j0k3r)
  * Fix configuration check for `keepOutputDirectory` in cleanup ([#748][] @daryl-c)
  * Prevent ts-node being registered twice ([#766][] @apancutt)
  * Fix external modules with webpack 5 ([#746][] @janicduplessis)
  * Allow custom webpack config files to export as an ES6 module (interop default) ([#767][] @apancutt)

[#735]: https://github.com/serverless-heaven/serverless-webpack/pull/735
[#742]: https://github.com/serverless-heaven/serverless-webpack/pull/742
[#748]: https://github.com/serverless-heaven/serverless-webpack/pull/748
[#766]: https://github.com/serverless-heaven/serverless-webpack/pull/766
[#746]: https://github.com/serverless-heaven/serverless-webpack/pull/746
[#767]: https://github.com/serverless-heaven/serverless-webpack/pull/767

* 5.4.0
  * Skip compile & packaging if `--no-build` is set [#560](https://github.com/serverless-heaven/serverless-webpack/pull/560)
  * Serialized compile to address [#299](https://github.com/serverless-heaven/serverless-webpack/pull/299) [#517](https://github.com/serverless-heaven/serverless-webpack/pull/517)
  * Add concurrency support for more than one thread [#681](https://github.com/serverless-heaven/serverless-webpack/pull/681)
  * Option to exclude files using regular expression [#612](https://github.com/serverless-heaven/serverless-webpack/pull/612)
  * Speed up cleanup process [#462](https://github.com/serverless-heaven/serverless-webpack/pull/462)
  * Allow custom runtime if Nodejs based [#675](https://github.com/serverless-heaven/serverless-webpack/pull/675)
  * Convert packageModules to use bestzip instead of archiver [#596](https://github.com/serverless-heaven/serverless-webpack/pull/596)
  * Fix external modules version for transitive dependencies [#541](https://github.com/serverless-heaven/serverless-webpack/pull/541) (see [#507](https://github.com/serverless-heaven/serverless-webpack/pull/507))
  * Support noFrozenLockfile options [#687](https://github.com/serverless-heaven/serverless-webpack/pull/687)
  * Don't package non-node functions (fix for [#644](https://github.com/serverless-heaven/serverless-webpack/issues/644)) [#663](https://github.com/serverless-heaven/serverless-webpack/pull/663)
  * Testing with Node.js 14.x [#688](https://github.com/serverless-heaven/serverless-webpack/pull/688)
  * Replace `babel-eslint` by `@babel/eslint-parser` [#713](https://github.com/serverless-heaven/serverless-webpack/pull/713)

* 5.3.5
  * Improve runtime validation [#629](https://github.com/serverless-heaven/serverless-webpack/pull/629)
  * Move `ts-node` as optional dependency [#636](https://github.com/serverless-heaven/serverless-webpack/pull/636)
  * Upgrade deps [#637](https://github.com/serverless-heaven/serverless-webpack/pull/637)

* 5.3.4
  * Bump lodash from 4.17.15 to 4.17.19 [#597](https://github.com/serverless-heaven/serverless-webpack/pull/597)
  * Bump lodash from 4.17.15 to 4.17.19 in /examples/typescript [#598](https://github.com/serverless-heaven/serverless-webpack/pull/598)
  * Bump lodash from 4.17.4 to 4.17.19 in /examples/multiple-statically-entries [#599](https://github.com/serverless-heaven/serverless-webpack/pull/599)
  * Bump lodash from 4.17.4 to 4.17.19 in /examples/include-external-npm-packages [#600](https://github.com/serverless-heaven/serverless-webpack/pull/600)
  * Bump lodash from 4.17.4 to 4.17.19 in /examples/babel-multiple-statically-entries [#601](https://github.com/serverless-heaven/serverless-webpack/pull/601)
  * Bump lodash from 4.17.4 to 4.17.19 in /examples/babel [#603](https://github.com/serverless-heaven/serverless-webpack/pull/603)
  * Ignore more files from NPM [#609](https://github.com/serverless-heaven/serverless-webpack/pull/609)
  * Update all examples [#626](https://github.com/serverless-heaven/serverless-webpack/pull/626)

* 5.3.3
  * default webpackConfig.node should be false [#502](https://github.com/serverless-heaven/serverless-webpack/pull/502)
  * Fix yarn list --json stdOut parsing [#516](https://github.com/serverless-heaven/serverless-webpack/pull/516)
  * Updated release notes [#585](https://github.com/serverless-heaven/serverless-webpack/pull/585)
  * Updated Node versions in CI [#587](https://github.com/serverless-heaven/serverless-webpack/pull/587)
  * Remove optional peer dependencies [#542](https://github.com/serverless-heaven/serverless-webpack/pull/542)
  * Check for node runtimes first [#579](https://github.com/serverless-heaven/serverless-webpack/pull/579)
  * Bumps lodash from 4.17.15 to 4.17.19 [#602](https://github.com/serverless-heaven/serverless-webpack/pull/602)

* 5.3.2
  * Fix eslint prettier [#518](https://github.com/serverless-heaven/serverless-webpack/pull/518)
  * Add TypeScript definition [#520](https://github.com/serverless-heaven/serverless-webpack/pull/520)
  * Project dependencies updated [#524](https://github.com/serverless-heaven/serverless-webpack/pull/524)
  * fix typescript example lockfile [#526](https://github.com/serverless-heaven/serverless-webpack/pull/526)
  * Typescript example babel loader [#527](https://github.com/serverless-heaven/serverless-webpack/pull/527)
  * Bump tar from 2.2.1 to 2.2.2 in /examples/babel [#544](https://github.com/serverless-heaven/serverless-webpack/pull/544)
  * Bump acorn from 6.3.0 to 6.4.1 in /examples/typescript [#562](https://github.com/serverless-heaven/serverless-webpack/pull/562)
  * Bump eslint-utils from 1.4.0 to 1.4.3 [#567](https://github.com/serverless-heaven/serverless-webpack/pull/567)
  * Bump handlebars from 4.1.2 to 4.7.6 [#568](https://github.com/serverless-heaven/serverless-webpack/pull/568)
  * Addressed npm security vulnerabilities [#569](https://github.com/serverless-heaven/serverless-webpack/pull/569)
  * Bump https-proxy-agent from 2.2.2 to 2.2.4 [#572](https://github.com/serverless-heaven/serverless-webpack/pull/572)
  * Bump https-proxy-agent from 2.2.2 to 2.2.4 in /examples/typescript [#573](https://github.com/serverless-heaven/serverless-webpack/pull/573)
  * Bump extend from 3.0.1 to 3.0.2 in /examples/babel [#574](https://github.com/serverless-heaven/serverless-webpack/pull/574)
  * Bump stringstream from 0.0.5 to 0.0.6 in /examples/babel [#575](https://github.com/serverless-heaven/serverless-webpack/pull/575)
  * Bump tough-cookie from 2.3.2 to 2.3.4 in /examples/babel [#576](https://github.com/serverless-heaven/serverless-webpack/pull/576)
  * Bump sshpk from 1.13.1 to 1.16.1 in /examples/babel [#577](https://github.com/serverless-heaven/serverless-webpack/pull/577)
  * Bump debug from 2.6.8 to 2.6.9 in /examples/babel [#578](https://github.com/serverless-heaven/serverless-webpack/pull/578)

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
  * Removed the `webpack serve` command in favor of [`serverless-offline`](https://www.npmjs.com/package/serverless-offline) [#152][link-152]
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
