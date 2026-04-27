#!/usr/bin/env node
/**
 * scripts/git-hooks/check-windows-garbage.js
 *
 * S65 — pre-commit guard #1: Windows/macOS/Linux junk filename detection.
 *
 * Why: Lessons S62/S63. Examples observed in repo history:
 *   - "Novo(a) Documento de Texto.txt" (0-byte) tracked silently for ~2 months.
 *   - "out1.txt", "test-output.txt" left as untracked artifacts.
 *
 * Behavior: blocks commit if any staged file (added/modified/copied) matches
 * a junk filename pattern OR is a 0-byte file (likely accidental).
 *
 * Exit codes:
 *   0 — clean
 *   1 — junk detected (blocks commit)
 *   2 — internal error (blocks commit; investigate)
 *
 * Bypass: HUSKY=0 git commit ...   (use sparingly).
 */

'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const JUNK_PATTERNS = [
  // Windows pt-BR "Novo Documento de Texto.txt", "Novo(a) Documento de Texto.txt"
  /^Novo[\s(].+\.(txt|docx|doc|xlsx|pptx)$/i,
  /^Novo Documento.*\.(txt|docx)$/i,
  /^Novo\(a\)\s.+/i,
  // Windows en "New Text Document", "New File"
  /^New (Text )?Document(\s\(\d+\))?\.(txt|docx)$/i,
  /^New File(\s\(\d+\))?$/i,
  /^New (Microsoft )?(Word|Excel|PowerPoint)\s.+/i,
  // macOS "Untitled.rtf", "Untitled (1).pages"
  /^Untitled(\s\(\d+\))?(\.\w+)?$/,
  // OS metadata
  /(^|\/)\.DS_Store$/,
  /(^|\/)Thumbs\.db$/i,
  /(^|\/)desktop\.ini$/i,
  /(^|\/)ehthumbs\.db$/i,
  // Editor swap files (vim, emacs)
  /(^|\/)\.[^/]+\.swp$/,
  /(^|\/)\.[^/]+\.swo$/,
  /~\$.+/, // MS Office lock files (~$Document.docx)
  // Common throwaway names
  /(^|\/)(out|out\d+|test-output|tmp|temp|scratch|untitled)\.(txt|log|tmp)$/i,
];

function getStagedFiles() {
  // diff-filter=ACMR: Added, Copied, Modified, Renamed (skip Deleted)
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf8',
  });
  return out.split(/\r?\n/).filter(Boolean);
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

function main() {
  let staged;
  try {
    staged = getStagedFiles();
  } catch (err) {
    console.error('[check-windows-garbage] failed to read staged files:', err.message);
    process.exit(2);
  }

  if (staged.length === 0) {
    return;
  }

  const violations = [];

  for (const f of staged) {
    const base = path.basename(f);

    // Pattern match
    for (const pat of JUNK_PATTERNS) {
      if (pat.test(f) || pat.test(base)) {
        violations.push({ file: f, reason: `matches junk pattern ${pat}` });
        break;
      }
    }

    // 0-byte detection (only for new/modified files that exist on disk)
    const size = fileSize(f);
    if (size === 0) {
      // allow .gitkeep / .keep / empty placeholder by convention
      if (!/\.gitkeep$|\.keep$/.test(base)) {
        violations.push({ file: f, reason: '0-byte file (likely accidental)' });
      }
    }
  }

  if (violations.length > 0) {
    console.error('');
    console.error('[check-windows-garbage] BLOCKED: junk file(s) staged for commit:');
    console.error('');
    for (const v of violations) {
      console.error(`  - ${v.file}`);
      console.error(`      ${v.reason}`);
    }
    console.error('');
    console.error('Fix: git restore --staged <file> && rm <file>');
    console.error('Bypass (NOT RECOMMENDED): HUSKY=0 git commit ...');
    console.error('');
    process.exit(1);
  }
}

main();
