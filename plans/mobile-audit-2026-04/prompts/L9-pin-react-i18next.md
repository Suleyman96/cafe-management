# L9 — Pin `react-i18next` major

## Context

[packages/i18n/package.json](../../../packages/i18n/package.json) line 26 has `react-i18next: ^15.4.1`. Web uses React 18, mobile uses React 19. A future minor of `react-i18next` could ship React 19-only code and break web.

## Steps

1. Tighten the version constraint: `~15.4.0` (or current). Note that `~` allows patch upgrades only.
2. Run `pnpm install` to verify.
3. Add a CI smoke test (script under `scripts/check-react-version-compat.ts`) that resolves the dependency tree under both apps and asserts only one React major is in flight per app.

## Acceptance

- [ ] Pinned version constraint.
- [ ] CI compat check added; `pnpm check`, `pnpm type-check`, `pnpm test` pass.
