#!/usr/bin/env node
/**
 * Compat gate — asserts each app's resolved `react` (and `react-dom` where
 * applicable) carries the expected major. Web apps target React 18; mobile
 * targets React 19. A future minor of `react-i18next` (or any shared
 * peer-dep) shipping React 19-only code into a web app would silently break
 * runtime — the test catches the case by reading the version pnpm actually
 * surfaces in the app's own `node_modules`.
 *
 * Run: `node scripts/check-react-version-compat.mjs`
 * Exits 1 on violation; prints offending app + react versions found.
 *
 * Wire as `pnpm check:react-compat` and gate in CI.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APPS = [
  { dir: 'apps/staff-web', expectedMajor: 18, requireReactDom: true },
  { dir: 'apps/customer-web', expectedMajor: 18, requireReactDom: true },
  { dir: 'apps/marketing', expectedMajor: 18, requireReactDom: true },
  { dir: 'apps/mobile', expectedMajor: 19, requireReactDom: false },
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
  console.error('expected to run from a pnpm workspace root');
  process.exit(2);
}

function resolvedMajor(packagePath) {
  if (!existsSync(packagePath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    const major = Number(String(pkg.version ?? '').split('.')[0]);
    return Number.isFinite(major) ? major : null;
  } catch {
    return null;
  }
}

let violations = 0;

for (const { dir, expectedMajor, requireReactDom } of APPS) {
  const appRoot = path.join(repoRoot, dir);
  const reactPkg = path.join(appRoot, 'node_modules', 'react', 'package.json');
  const reactMajor = resolvedMajor(reactPkg);
  if (reactMajor === null) {
    console.error(`[skip] ${dir}: react not installed (run pnpm install)`);
    continue;
  }
  if (reactMajor !== expectedMajor) {
    console.error(`[FAIL] ${dir}: expected react@${expectedMajor}.x, found ${reactMajor}.x`);
    violations += 1;
    continue;
  }
  if (requireReactDom) {
    const reactDomPkg = path.join(appRoot, 'node_modules', 'react-dom', 'package.json');
    const domMajor = resolvedMajor(reactDomPkg);
    if (domMajor === null) {
      console.error(`[FAIL] ${dir}: react-dom not installed`);
      violations += 1;
      continue;
    }
    if (domMajor !== expectedMajor) {
      console.error(`[FAIL] ${dir}: expected react-dom@${expectedMajor}.x, found ${domMajor}.x`);
      violations += 1;
      continue;
    }
  }
  console.log(`[ok] ${dir}: react ${reactMajor}.x`);
}

if (violations > 0) {
  console.error(`\n${violations} app(s) failed react-major compat check`);
  process.exit(1);
}
