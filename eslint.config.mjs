import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import pluginPromise from 'eslint-plugin-promise';
import lodashPlugin from 'eslint-plugin-lodash';
import importPlugin from 'eslint-plugin-import';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  importPlugin.flatConfigs.recommended,
  pluginPromise.configs['flat/recommended'],
  eslintPluginPrettier,
  {
    ignores: ['**/examples/']
  },
  ...fixupConfigRules(compat.extends('plugin:lodash/recommended')),
  {
    plugins: {
      lodash: fixupPluginRules(lodashPlugin)
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parser: babelParser,
      ecmaVersion: 6,
      sourceType: 'module',
      parserOptions: {
        requireConfigFile: false
      }
    },
    rules: {
      'linebreak-style': ['error', 'unix'],
      semi: ['error', 'always'],
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true
        }
      ],
      'no-mixed-spaces-and-tabs': 'error',
      'space-before-blocks': 'error',
      'arrow-spacing': 'error',
      'key-spacing': [
        'error',
        {
          afterColon: true,
          mode: 'minimum'
        }
      ],
      'brace-style': ['error', '1tbs'],
      'comma-spacing': [
        'error',
        {
          before: false,
          after: true
        }
      ],
      'comma-style': [
        'error',
        'last',
        {
          exceptions: {
            VariableDeclaration: true
          }
        }
      ],
      'computed-property-spacing': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      'promise/no-nesting': 'off',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-named-as-default': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true
        }
      ],
      'lodash/import-scope': 'off',
      'lodash/preferred-alias': 'off',
      'lodash/prop-shorthand': 'off',
      'lodash/prefer-lodash-method': [
        'error',
        {
          ignoreObjects: ['BbPromise', 'path']
        }
      ],
      'max-len': [
        'error',
        {
          code: 120,
          ignoreStrings: true,
          ignoreComments: true,
          ignoreTemplateLiterals: true
        }
      ],
      'prettier/prettier': [
        'error',
        {
          printWidth: 120,
          arrowParens: 'avoid',
          bracketSpacing: true,
          semi: true,
          singleQuote: true,
          trailingComma: 'none'
        }
      ]
    }
  }
];
