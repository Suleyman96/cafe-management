#!/usr/bin/env node
// P9 — bundle-size guardrail for customer-web.
//
// Why customer-web specifically: it's the cold-load surface on a 3G phone
// after a QR scan. Every 50kB of incidental import costs ~half a second
// of first paint on a low-end Android. The audit's worry case is one
// stray `framer-motion` doubling JS payload silently.
//
// What this gates:
//   1. Per-route first-load JS bytes from the live `next build` output
//      vs. a baseline checked into the repo at `.bundle-baseline.json`.
//      Fails if any route regresses by more than `PER_ROUTE_REGRESS_KB`.
//   2. A hard ceiling: no route's first-load may exceed `HARD_CEILING_KB`.
//
// Update flow: when an intentional bundle increase ships, re-run with
// `--update-baseline` (or pass `UPDATE_BASELINE=1`) and commit the new
// baseline in the same PR. CI gates on the unchanged baseline so the
// reviewer sees the diff.

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const NEXT_DIR = join(APP_DIR, '.next');
const BASELINE_PATH = join(APP_DIR, '.bundle-baseline.json');

// Tunable thresholds. Numbers in kilobytes (1024 bytes).
const PER_ROUTE_REGRESS_KB = 10;
const HARD_CEILING_KB = 200;

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update-baseline') || process.env.UPDATE_BASELINE === '1';

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function fileSizeBytes(relPath) {
  const abs = join(NEXT_DIR, relPath);
  if (!existsSync(abs)) return 0;
  return statSync(abs).size;
}

function bytesForChunks(chunks) {
  return chunks.reduce((sum, chunk) => sum + fileSizeBytes(chunk), 0);
}

// Next 14: `.next/app-build-manifest.json` lists per-route chunk files
// for the App Router. Each page's `files` is the list of static JS
// chunks the browser loads for that route's first paint. Summing the
// raw bytes is the closest signal we get to "first-load JS" without
// running the analyzer.
function loadManifest() {
  const path = join(NEXT_DIR, 'app-build-manifest.json');
  if (!existsSync(path)) {
    console.error(`❌ ${path} not found. Run \`pnpm --filter @gustri/customer-web build\` first.`);
    process.exit(1);
  }
  return readJSON(path);
}

function computeRouteSizes() {
  const manifest = loadManifest();
  const pages = manifest.pages ?? {};
  const result = {};
  for (const [route, chunks] of Object.entries(pages)) {
    // Skip Next internals (the `/_app`-style entries) — they're shared
    // chunks, not user-visible routes.
    if (!route.startsWith('/')) continue;
    result[route] = bytesForChunks(chunks);
  }
  return result;
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1);
}

function main() {
  const current = computeRouteSizes();

  if (updateBaseline) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`✅ Baseline updated → ${BASELINE_PATH}`);
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`ℹ️  No baseline found — wrote initial baseline at ${BASELINE_PATH}. Commit it.`);
    return;
  }

  const baseline = readJSON(BASELINE_PATH);
  // Empty baseline is the bootstrap signal — the file was committed as
  // `{}` to claim the path; the first run after that captures real
  // numbers and exits without gating. CI gates on subsequent runs.
  if (Object.keys(baseline).length === 0) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    console.log(
      `ℹ️  Baseline was empty — wrote initial measurements at ${BASELINE_PATH}. Commit it.`,
    );
    return;
  }
  const failures = [];

  for (const [route, bytes] of Object.entries(current)) {
    const baseBytes = baseline[route] ?? 0;
    const regressionKb = (bytes - baseBytes) / 1024;
    if (regressionKb > PER_ROUTE_REGRESS_KB) {
      failures.push(
        `regression on ${route}: ${kb(baseBytes)} kB → ${kb(bytes)} kB (+${regressionKb.toFixed(1)} kB, cap +${PER_ROUTE_REGRESS_KB} kB)`,
      );
    }
    if (bytes / 1024 > HARD_CEILING_KB) {
      failures.push(`hard ceiling exceeded on ${route}: ${kb(bytes)} kB > ${HARD_CEILING_KB} kB`);
    }
  }

  console.log('Route first-load sizes (raw, gzip-equivalent ~30-40%):');
  for (const [route, bytes] of Object.entries(current)) {
    const baseBytes = baseline[route] ?? 0;
    const delta = bytes - baseBytes;
    const deltaStr = delta === 0 ? '±0' : delta > 0 ? `+${kb(delta)}` : `${kb(delta)}`;
    console.log(`  ${route.padEnd(40)} ${kb(bytes).padStart(8)} kB (${deltaStr} kB)`);
  }

  if (failures.length > 0) {
    console.error('\n❌ Bundle-size guardrail failed:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      `\nIf the increase is intentional, run \`pnpm --filter @gustri/customer-web bundle-baseline\` and commit the updated ${BASELINE_PATH}.`,
    );
    process.exit(1);
  }

  console.log('\n✅ Bundle-size guardrail passed.');
}

main();
