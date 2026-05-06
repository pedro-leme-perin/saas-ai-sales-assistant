// eslint.config.mjs (flat config, ESLint v9+)
//
// Migrated from .eslintrc.js in S78 F/D7 to align backend with frontend (S69).
// ESLint v9 dropped legacy `.eslintrc.*` resolution by default; flat config is
// the new contract. We wrap the legacy config via FlatCompat (@eslint/eslintrc)
// to preserve identical lint behaviour with zero rule semantics drift.

import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'eslint.config.mjs'],
  },
  ...compat.config({
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: 'tsconfig.json',
      tsconfigRootDir: __dirname,
      sourceType: 'module',
    },
    plugins: ['@typescript-eslint/eslint-plugin'],
    extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
    env: {
      node: true,
      jest: true,
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'prettier/prettier': ['error', { singleQuote: true, trailingComma: 'all' }],
    },
  }),
];
