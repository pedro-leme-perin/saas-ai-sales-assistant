/**
 * commitlint.config.js — Conventional Commits enforcement (S66-D)
 *
 * Reference: https://www.conventionalcommits.org/en/v1.0.0/
 * Plugin: @commitlint/config-conventional
 *
 * Allowed types:
 *   feat     — new user-facing functionality
 *   fix      — bug fix
 *   chore    — meta/tooling/release without user impact
 *   docs     — documentation only
 *   refactor — code change neither fixes a bug nor adds a feature
 *   test     — adds/edits tests, no production change
 *   style    — formatting/whitespace, no semantic change
 *   perf     — performance improvement
 *   build    — build system or external dependencies (npm, pnpm, dockerfile)
 *   ci       — CI configuration (.github/workflows, husky, etc.)
 *   revert   — revert a previous commit
 *
 * Bypass (emergencies only): HUSKY=0 git commit ...
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Increase from 72 (default) to 100 — our project uses descriptive subjects
    // like "feat(s66-c): coverage ratchet defensivo 65/55/62/65 -> 68/58/65/68"
    'header-max-length': [2, 'always', 100],

    // Subject must use sentence-case, lower-case, or numeric-start. Default
    // forbids upper-case opener — kept (catches typos like "FIX:").
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],

    // Subject not allowed to be empty
    'subject-empty': [2, 'never'],

    // Subject must NOT end with a period
    'subject-full-stop': [2, 'never', '.'],

    // Type must be one of the allowed list (above)
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'docs',
        'refactor',
        'test',
        'style',
        'perf',
        'build',
        'ci',
        'revert',
      ],
    ],

    // Scope: optional but case-locked when present (our convention: kebab-case
    // module names like "s66-c", "auth", "billing").
    'scope-case': [2, 'always', 'lower-case'],

    // Body & footer leading blank lines (recommended convention)
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],

    // Body line length — relaxed from default 100 to 200 because our commit
    // messages document detailed coverage tables, file lists, etc.
    'body-max-line-length': [1, 'always', 200],
  },
};
