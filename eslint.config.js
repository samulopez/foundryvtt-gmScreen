import path from 'node:path';

import eslintPluginYml from 'eslint-plugin-yml';
import prettierPlugin from 'eslint-plugin-prettier';
import { rules as prettierConfigRules } from 'eslint-config-prettier';
import { configs, plugins } from 'eslint-config-airbnb-extended';
import json from '@eslint/json';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';

const gitignorePath = path.resolve('.', '.gitignore');

const jsConfig = [
  // ESLint Recommended Rules
  {
    name: 'js/config',
    files: ['**/*.js', '**/*.mjs'],
    ...js.configs.recommended,
  },
  // Stylistic Plugin
  plugins.stylistic,
  // Import X Plugin
  plugins.importX,
  // Airbnb Base Recommended Config
  ...configs.base.recommended,
];

const nodeConfig = [
  // Node Plugin
  plugins.node,
  // Airbnb Node Recommended Config
  ...configs.node.recommended,
];

const typescriptConfig = [
  // TypeScript ESLint Plugin
  plugins.typescriptEslint,
  // Airbnb Base TypeScript Config
  ...configs.base.typescript,
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.jsx', '**/*.ts', '**/*.cts', '**/*.mts', '**/*.tsx', '**/*.d.ts'],
    rules: {
      'import-x/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: {
            order: 'desc',
            caseInsensitive: true,
          },
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          pathGroupsExcludedImportTypes: ['builtin', 'type'],
        },
      ],
      'import-x/prefer-default-export': 'off',
      'no-underscore-dangle': 'off',
      'class-methods-use-this': 'off',
    },
  },
];

const jsonConfig = [
  {
    name: 'json/config',
    files: ['**/*.json'],
    ignores: ['**/package-lock.json'],
    language: 'json/json',
    ...json.configs.recommended,
  },
];

const prettierConfig = [
  // Prettier Plugin
  {
    name: 'prettier/plugin/config',
    plugins: {
      prettier: prettierPlugin,
    },
  },
  // Prettier Config
  {
    name: 'prettier/config',
    rules: {
      ...prettierConfigRules,
      'prettier/prettier': 'error',
    },
  },
];

export default [
  // Ignore .gitignore files/folder in eslint
  includeIgnoreFile(gitignorePath),
  // Javascript Config
  ...jsConfig,
  // Node Config
  ...nodeConfig,
  // TypeScript Config
  ...typescriptConfig,
  // JSON Config
  ...jsonConfig,
  // YAML Config
  ...eslintPluginYml.configs['flat/recommended'],
  // Prettier Config
  ...prettierConfig,
];
