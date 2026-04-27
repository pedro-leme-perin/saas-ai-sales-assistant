#!/usr/bin/env node
/**
 * scripts/git-hooks/check-secrets.js
 *
 * S65 — pre-commit guard #2: secret pattern detection in staged additions.
 *
 * Why: Lessons S64. Test fixtures used real-looking secret prefixes (sk_test_xxx,
 * sk_live_xxx) — GitHub push protection caught them mid-CI, forcing rebase.
 * Also: never commit real secrets (sk_live, AWS, Clerk, Slack, GitHub PAT).
 *
 * Behavior: blocks commit if `git diff --cached` contains added lines (lines
 * starting with `+`, excluding metadata `+++`) matching any secret regex.
 *
 * Allowlist:
 *   - Lines containing "pre-commit-allow-secret" comment.
 *   - Synthetic prefixes: "test-fixture-", "mock-", "fake-", "example-",
 *     "placeholder-", "REDACTED", "your-", "<your".
 *   - Files under __fixtures__/, __mocks__/, __snapshots__/.
 *
 * Exit codes:
 *   0 — clean
 *   1 — secret detected (blocks commit)
 *   2 — internal error (blocks commit)
 *
 * Bypass: HUSKY=0 git commit ...
 */

'use strict';

const { execSync } = require('node:child_process');

// Secret patterns. Each entry: { name, regex, severity }
// severity ERROR -> blocks. WARNING -> reports but allows.
const SECRET_PATTERNS = [
  // Stripe (highest severity — real $$ exposure)
  { name: 'Stripe live secret key', regex: /\bsk_live_[A-Za-z0-9]{20,}/, severity: 'ERROR' },
  { name: 'Stripe test secret key', regex: /\bsk_test_[A-Za-z0-9]{20,}/, severity: 'ERROR' },
  { name: 'Stripe restricted key', regex: /\brk_(live|test)_[A-Za-z0-9]{20,}/, severity: 'ERROR' },
  { name: 'Stripe public live key', regex: /\bpk_live_[A-Za-z0-9]{20,}/, severity: 'ERROR' },
  { name: 'Stripe webhook secret', regex: /\bwhsec_[A-Za-z0-9]{20,}/, severity: 'ERROR' },
  // Clerk
  { name: 'Clerk secret', regex: /\bclerk_(live|test)_[A-Za-z0-9]{20,}/, severity: 'ERROR' },
  { name: 'Clerk publishable', regex: /\bpk_(live|test)_(?!Y2x)[A-Za-z0-9]{30,}/, severity: 'WARNING' },
  // OpenAI / Anthropic / Deepgram
  { name: 'OpenAI API key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/, severity: 'ERROR' },
  { name: 'Anthropic API key', regex: /\bsk-ant-[a-z0-9-]{20,}/, severity: 'ERROR' },
  // AWS
  { name: 'AWS access key ID', regex: /\bAKIA[0-9A-Z]{16}\b/, severity: 'ERROR' },
  { name: 'AWS secret', regex: /aws_secret_access_key\s*=\s*["']?[A-Za-z0-9/+=]{40}["']?/i, severity: 'ERROR' },
  // GitHub / npm
  { name: 'GitHub PAT', regex: /\bghp_[A-Za-z0-9]{36}\b/, severity: 'ERROR' },
  { name: 'GitHub Actions token', regex: /\bghs_[A-Za-z0-9]{36}\b/, severity: 'ERROR' },
  { name: 'npm token', regex: /\bnpm_[A-Za-z0-9]{36}\b/, severity: 'ERROR' },
  // Slack
  { name: 'Slack bot token', regex: /\bxoxb-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{20,}/, severity: 'ERROR' },
  { name: 'Slack user token', regex: /\bxoxp-[0-9]{10,}-[0-9]{10,}-[0-9]{10,}-[a-f0-9]{32}/, severity: 'ERROR' },
  // Twilio
  { name: 'Twilio account SID', regex: /\bAC[a-f0-9]{32}\b/, severity: 'WARNING' },
  // Generic high-entropy hex (32+ chars after a "=" or ":")
  { name: 'Likely hex secret (32+)', regex: /(?:secret|token|password|api_?key)["'\s:=]+["']?[a-f0-9]{32,}["']?/i, severity: 'WARNING' },
];

const ALLOWLIST_PREFIXES = [
  'test-fixture-',
  'mock-',
  'fake-',
  'example-',
  'placeholder-',
  'REDACTED',
  'your-',
  '<your',
  'xxx',
  'XXXX',
];

const ALLOWLIST_PATH_GLOBS = [
  /__fixtures__\//,
  /__mocks__\//,
  /__snapshots__\//,
  /\.test-fixture\./,
];

function isAllowlistedLine(line) {
  if (line.includes('pre-commit-allow-secret')) return true;
  for (const p of ALLOWLIST_PREFIXES) {
    if (line.includes(p)) return true;
  }
  return false;
}

function isAllowlistedPath(p) {
  return ALLOWLIST_PATH_GLOBS.some((rx) => rx.test(p));
}

function getStagedDiff() {
  // -U0: no context lines (only +/- lines, less noise)
  return execSync('git diff --cached --no-color -U0', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

function parseDiff(diff) {
  // Returns array of { file, lineNo, line }
  const out = [];
  const lines = diff.split(/\r?\n/);
  let currentFile = null;
  let currentLineNo = 0;

  for (const raw of lines) {
    if (raw.startsWith('+++ b/')) {
      currentFile = raw.slice('+++ b/'.length);
      continue;
    }
    if (raw.startsWith('--- ')) continue;
    if (raw.startsWith('@@ ')) {
      // @@ -a,b +c,d @@
      const m = /\+(\d+)/.exec(raw);
      if (m) currentLineNo = parseInt(m[1], 10) - 1;
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      currentLineNo += 1;
      out.push({ file: currentFile, lineNo: currentLineNo, line: raw.slice(1) });
    } else if (!raw.startsWith('-')) {
      currentLineNo += 1;
    }
  }
  return out;
}

function main() {
  let diff;
  try {
    diff = getStagedDiff();
  } catch (err) {
    console.error('[check-secrets] failed to read staged diff:', err.message);
    process.exit(2);
  }

  if (!diff.trim()) {
    return;
  }

  const additions = parseDiff(diff);
  const violations = [];

  for (const { file, lineNo, line } of additions) {
    if (!file) continue;
    if (isAllowlistedPath(file)) continue;
    if (isAllowlistedLine(line)) continue;

    for (const pat of SECRET_PATTERNS) {
      const match = pat.regex.exec(line);
      if (match) {
        violations.push({
          file,
          lineNo,
          name: pat.name,
          severity: pat.severity,
          snippet: match[0].slice(0, 60) + (match[0].length > 60 ? '...' : ''),
        });
      }
    }
  }

  const errors = violations.filter((v) => v.severity === 'ERROR');
  const warnings = violations.filter((v) => v.severity === 'WARNING');

  if (warnings.length > 0) {
    console.warn('');
    console.warn('[check-secrets] WARNING: possible secret-like patterns:');
    for (const v of warnings) {
      console.warn(`  - ${v.file}:${v.lineNo}  ${v.name}`);
      console.warn(`      ${v.snippet}`);
    }
  }

  if (errors.length > 0) {
    console.error('');
    console.error('[check-secrets] BLOCKED: secret pattern(s) detected in staged additions:');
    console.error('');
    for (const v of errors) {
      console.error(`  - ${v.file}:${v.lineNo}  ${v.name}`);
      console.error(`      ${v.snippet}`);
    }
    console.error('');
    console.error('If this is a synthetic test value, prefix with one of:');
    console.error(`  ${ALLOWLIST_PREFIXES.slice(0, 6).join(', ')}`);
    console.error('Or place under __fixtures__/, __mocks__/, __snapshots__/.');
    console.error('Or append on the same line: // pre-commit-allow-secret');
    console.error('');
    console.error('If this IS a real secret: rotate it NOW (do not commit), then');
    console.error('move the value to environment variables.');
    console.error('');
    console.error('Bypass (NOT RECOMMENDED): HUSKY=0 git commit ...');
    console.error('');
    process.exit(1);
  }
}

main();
