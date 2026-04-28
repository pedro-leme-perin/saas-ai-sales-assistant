// eslint.config.mjs (flat config, ESLint v9+)
// Migrated from .eslintrc.json in S69 because ESLint v9 dropped legacy
// config format by default. eslint-config-next v15+ still ships as
// legacy; we wrap it via FlatCompat from @eslint/eslintrc.

import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    // Project-specific overrides go here.
    // Example (commented): tighten rules-of-hooks if needed
    // rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
];

export default eslintConfig;
