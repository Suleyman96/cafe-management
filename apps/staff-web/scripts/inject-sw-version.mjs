#!/usr/bin/env node
// Replace the `__BUILD_SHA__` literal in the service worker with the
// current commit SHA so each deploy gets its own cache namespace
// (Blocker 7). Next serves `public/sw.js` verbatim with no fingerprinting,
// so the SW filename is fixed at /sw.js across deploys — the cache name
// inside the file is what differentiates them.
//
// Only runs on CI (VERCEL=1 or CI=true). Local `pnpm build` is a no-op
// to keep the working tree clean. The SW's `RAW_BUILD_SHA === '__BUILD_SHA__'`
// fallback covers the local case so dev still works.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_PATH = join(__dirname, '..', 'public', 'sw.js');
const PLACEHOLDER = '__BUILD_SHA__';

const isCi = process.env.VERCEL === '1' || process.env.CI === 'true';
// Accept the SHA env var native to whichever CI is running this build:
// VERCEL_GIT_COMMIT_SHA on Vercel, GITHUB_SHA on GitHub Actions, or an
// explicitly-set GIT_COMMIT_SHA from a workflow that wants to override
// (e.g. tagging a manual deploy with a non-HEAD ref).
const sha =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;

if (!isCi) {
  console.log('[inject-sw-version] Local build — leaving sw.js placeholder intact.');
  process.exit(0);
}

if (!sha) {
  // CI but no SHA — most likely a misconfiguration. Surface loudly so the
  // ops team notices rather than silently shipping a deploy that can't
  // be invalidated.
  console.error(
    '[inject-sw-version] CI build but no commit SHA available ' +
      '(checked VERCEL_GIT_COMMIT_SHA, GIT_COMMIT_SHA, GITHUB_SHA). ' +
      'Cache cannot be scoped to this deploy — failing build.',
  );
  process.exit(1);
}

const original = await readFile(SW_PATH, 'utf8');
if (!original.includes(PLACEHOLDER)) {
  console.log(
    `[inject-sw-version] ${SW_PATH} has no ${PLACEHOLDER} token — already patched. Skipping.`,
  );
  process.exit(0);
}

await writeFile(SW_PATH, original.replaceAll(PLACEHOLDER, sha), 'utf8');
console.log(`[inject-sw-version] Patched ${SW_PATH} with ${sha}.`);
