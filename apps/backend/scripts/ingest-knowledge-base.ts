#!/usr/bin/env tsx
/**
 * ingest-knowledge-base.ts — CLI for bulk-ingesting documents into the RAG knowledge base.
 *
 * Usage:
 *   pnpm tsx apps/backend/scripts/ingest-knowledge-base.ts \
 *     --company-id <uuid> \
 *     --source DOCUMENT \
 *     --source-ref "product-catalog-2026.txt" \
 *     --file ./data/product-catalog-2026.txt \
 *     [--chunk-size 800] \
 *     [--overlap 100] \
 *     [--replace] \
 *     [--dry-run]
 *
 *   # Or pipe stdin:
 *   cat ./faq.txt | pnpm tsx apps/backend/scripts/ingest-knowledge-base.ts \
 *     --company-id <uuid> --source MANUAL --source-ref "faq-may-2026"
 *
 * Options:
 *   --company-id <uuid>   (required) Target company UUID
 *   --source <type>       (required) DOCUMENT | URL | MANUAL | CALL | WHATSAPP
 *   --source-ref <string> (required) Human-readable identifier for the source
 *   --file <path>         Path to text file. Reads stdin if omitted.
 *   --chunk-size <n>      Characters per chunk (default: 800, max: 1600)
 *   --overlap <n>         Overlap between consecutive chunks (default: 100)
 *   --replace             Soft-delete existing chunks for this sourceRef before ingesting
 *   --dry-run             Parse and chunk the text, but do not embed or persist
 *   --batch-size <n>      Chunks per OpenAI embed batch call (default: 50, max: 100)
 *   --api-url <url>       Backend API base URL (default: from BACKEND_API_URL env or http://localhost:3001)
 *   --api-key <key>       Backend API key (sk_live_… from api-keys module). Required unless --dry-run.
 *
 * Environment variables:
 *   BACKEND_API_URL        Override --api-url
 *   INGEST_API_KEY         Override --api-key
 *   DATABASE_URL           If set, uses direct DB + OpenAI (bypasses HTTP API)
 *
 * Exit codes:
 *   0  — success (all chunks created or skipped)
 *   1  — configuration / argument error
 *   2  — partial failure (some chunks errored)
 *   3  — total failure (all chunks errored or connection failed)
 *
 * References:
 *   Designing ML Systems — chunking strategy for embedding-based retrieval
 *   DDIA Cap. 3 — index-aware chunk sizing (~400 tokens = ~1600 chars for text-embedding-3-small)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';

// =============================================
// Types
// =============================================

type KnowledgeChunkSource = 'DOCUMENT' | 'URL' | 'MANUAL' | 'CALL' | 'WHATSAPP';

interface CliArgs {
  companyId: string;
  source: KnowledgeChunkSource;
  sourceRef: string;
  file?: string;
  chunkSize: number;
  overlap: number;
  replace: boolean;
  dryRun: boolean;
  batchSize: number;
  apiUrl: string;
  apiKey?: string;
}

interface IngestResult {
  created: number;
  skipped: number;
  errors: number;
  chunkIds: string[];
}

interface ChunkPayload {
  source: KnowledgeChunkSource;
  sourceRef: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  isActive: boolean;
}

// =============================================
// Argument parsing
// =============================================

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const has = (flag: string): boolean => args.includes(flag);

  const companyId = get('--company-id');
  const sourceRaw = get('--source');
  const sourceRef = get('--source-ref');

  if (!companyId) {
    bail('--company-id is required');
  }

  const validSources: KnowledgeChunkSource[] = [
    'DOCUMENT',
    'URL',
    'MANUAL',
    'CALL',
    'WHATSAPP',
  ];

  if (!sourceRaw || !validSources.includes(sourceRaw as KnowledgeChunkSource)) {
    bail(`--source is required and must be one of: ${validSources.join(' | ')}`);
  }

  if (!sourceRef) {
    bail('--source-ref is required');
  }

  const chunkSizeRaw = parseInt(get('--chunk-size') ?? '800', 10);
  const chunkSize = Number.isNaN(chunkSizeRaw)
    ? 800
    : Math.min(Math.max(100, chunkSizeRaw), 1600);

  const overlapRaw = parseInt(get('--overlap') ?? '100', 10);
  const overlap = Number.isNaN(overlapRaw)
    ? 100
    : Math.min(Math.max(0, overlapRaw), Math.floor(chunkSize / 2));

  const batchSizeRaw = parseInt(get('--batch-size') ?? '50', 10);
  const batchSize = Number.isNaN(batchSizeRaw)
    ? 50
    : Math.min(Math.max(1, batchSizeRaw), 100);

  const apiUrl =
    get('--api-url') ??
    process.env['BACKEND_API_URL'] ??
    'http://localhost:3001';

  const apiKey = get('--api-key') ?? process.env['INGEST_API_KEY'];

  return {
    companyId: companyId!,
    source: sourceRaw as KnowledgeChunkSource,
    sourceRef: sourceRef!,
    file: get('--file'),
    chunkSize,
    overlap,
    replace: has('--replace'),
    dryRun: has('--dry-run'),
    batchSize,
    apiUrl: apiUrl.replace(/\/$/, ''),
    apiKey,
  };
}

function bail(msg: string): never {
  console.error(`[ERROR] ${msg}`);
  process.exit(1);
}

// =============================================
// Text chunking
// =============================================

/**
 * Split text into overlapping chunks.
 *
 * Strategy: sentence-boundary aware sliding window.
 *   1. Split text into sentences (period / newline boundaries).
 *   2. Pack sentences into chunks until chunkSize is reached.
 *   3. Overlap: carry the last `overlap` chars into the next chunk.
 *
 * This preserves sentence integrity better than pure character slicing,
 * which avoids splitting mid-word and improves embedding quality.
 * (Designing ML Systems — chunking strategy for dense retrieval)
 */
function chunkText(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  // Normalize whitespace: collapse multiple blank lines, trim
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (normalized.length === 0) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = start + chunkSize;

    if (end >= normalized.length) {
      // Final chunk
      chunks.push(normalized.slice(start).trim());
      break;
    }

    // Try to break at a sentence boundary (. ! ? \n) within the last 20% of the chunk
    const searchFrom = start + Math.floor(chunkSize * 0.8);
    const sentenceEnd = findSentenceBoundary(normalized, searchFrom, end);

    if (sentenceEnd > start) {
      end = sentenceEnd;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Advance with overlap
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

/**
 * Find the last sentence boundary in text[from..to].
 * Returns the index after the boundary character, or `to` if none found.
 */
function findSentenceBoundary(text: string, from: number, to: number): number {
  const boundary = /[.!?\n]/g;
  boundary.lastIndex = from;

  let lastBoundary = -1;
  let match: RegExpExecArray | null;

  while ((match = boundary.exec(text)) !== null) {
    if (match.index > to) break;
    lastBoundary = match.index + 1;
  }

  return lastBoundary > from ? lastBoundary : to;
}

// =============================================
// HTTP API client
// =============================================

async function apiFetch<T>(
  apiUrl: string,
  apiKey: string,
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const url = `${apiUrl}/api/${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'x-api-key': apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)');
    throw new Error(`API ${method} ${url} → ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// =============================================
// Main
// =============================================

async function main(): Promise<void> {
  const args = parseArgs();

  // Validate API key (required unless dry-run)
  if (!args.dryRun && !args.apiKey) {
    bail(
      '--api-key or INGEST_API_KEY env var is required (unless --dry-run). ' +
        'Create an API key via POST /api/api-keys with scope knowledge_base:write.',
    );
  }

  // Read input text
  let rawText: string;

  if (args.file) {
    const filePath = resolve(process.cwd(), args.file);
    try {
      rawText = readFileSync(filePath, 'utf8');
      console.log(`[INFO] Reading from file: ${filePath} (${rawText.length} chars)`);
    } catch (err: unknown) {
      bail(`Cannot read file ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (!process.stdin.isTTY) {
    // Read from stdin (piped input)
    const rl = createInterface({ input: process.stdin });
    const lines: string[] = [];
    for await (const line of rl) {
      lines.push(line);
    }
    rawText = lines.join('\n');
    console.log(`[INFO] Reading from stdin (${rawText.length} chars)`);
  } else {
    bail('No input provided. Use --file or pipe text via stdin.');
  }

  if (!rawText || rawText.trim().length === 0) {
    bail('Input text is empty — nothing to ingest.');
  }

  // Chunk the text
  const textChunks = chunkText(rawText, args.chunkSize, args.overlap);
  console.log(
    `[INFO] Chunked into ${textChunks.length} chunks ` +
      `(chunkSize=${args.chunkSize}, overlap=${args.overlap})`,
  );

  if (args.dryRun) {
    console.log('[DRY-RUN] Chunks that would be ingested:');
    textChunks.forEach((chunk, i) => {
      const preview = chunk.slice(0, 80).replace(/\n/g, '↵');
      console.log(`  [${i}] ${preview}… (${chunk.length} chars)`);
    });
    console.log(`[DRY-RUN] Total: ${textChunks.length} chunks. No data written.`);
    process.exit(0);
  }

  const apiKey = args.apiKey!;

  // Optionally replace existing chunks for this sourceRef
  if (args.replace) {
    console.log(
      `[INFO] --replace: removing existing chunks for sourceRef="${args.sourceRef}"...`,
    );
    try {
      const result = await apiFetch<{ deleted: number }>(
        args.apiUrl,
        apiKey,
        `knowledge-base/source/${encodeURIComponent(args.sourceRef)}`,
        'DELETE',
      );
      console.log(`[INFO] Removed ${result.deleted} existing chunks.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[WARN] Failed to remove existing chunks: ${msg}. Continuing with ingest.`);
    }
  }

  // Build chunk payloads
  const payloads: ChunkPayload[] = textChunks.map((content, i) => ({
    source: args.source,
    sourceRef: args.sourceRef,
    chunkIndex: i,
    content,
    metadata: {
      chunkSize: args.chunkSize,
      overlap: args.overlap,
      totalChunks: textChunks.length,
      ingestedAt: new Date().toISOString(),
    },
    isActive: true,
  }));

  // Send in batches of batchSize
  const totals: IngestResult = { created: 0, skipped: 0, errors: 0, chunkIds: [] };

  for (let i = 0; i < payloads.length; i += args.batchSize) {
    const batch = payloads.slice(i, i + args.batchSize);
    const batchNum = Math.floor(i / args.batchSize) + 1;
    const totalBatches = Math.ceil(payloads.length / args.batchSize);

    process.stdout.write(
      `[INFO] Ingesting batch ${batchNum}/${totalBatches} (${batch.length} chunks)... `,
    );

    try {
      const result = await apiFetch<IngestResult>(
        args.apiUrl,
        apiKey,
        'knowledge-base/chunks/batch',
        'POST',
        { chunks: batch },
      );

      totals.created += result.created;
      totals.skipped += result.skipped;
      totals.errors += result.errors;
      totals.chunkIds.push(...(result.chunkIds ?? []));

      console.log(
        `done (created=${result.created} skipped=${result.skipped} errors=${result.errors})`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED`);
      console.error(`[ERROR] Batch ${batchNum} failed: ${msg}`);
      totals.errors += batch.length;
    }
  }

  // Summary
  console.log('\n[SUMMARY]');
  console.log(`  Company:  ${args.companyId}`);
  console.log(`  Source:   ${args.source} / ${args.sourceRef}`);
  console.log(`  Created:  ${totals.created}`);
  console.log(`  Skipped:  ${totals.skipped} (duplicates)`);
  console.log(`  Errors:   ${totals.errors}`);
  console.log(`  Total:    ${textChunks.length}`);

  if (totals.errors === 0) {
    process.exit(0);
  } else if (totals.errors === textChunks.length) {
    console.error('[ERROR] All chunks failed to ingest.');
    process.exit(3);
  } else {
    console.warn('[WARN] Some chunks failed to ingest (partial success).');
    process.exit(2);
  }
}

main().catch((err: unknown) => {
  console.error('[FATAL]', err instanceof Error ? err.message : String(err));
  process.exit(3);
});
