# L7 — Move NumberInput DOM types out of `@gustri/ui`

## Context

[packages/ui/src/number-input.tsx](../../../packages/ui/src/number-input.tsx) lines 39 and 111 reference `HTMLInputElement` and `document.activeElement` inside a package that is supposed to be cross-platform. Mobile imports of `@gustri/ui` will fail to parse this file if RN ever sees it.

## Steps

1. Pick one:
   - **(a) Preferred**: move `number-input.tsx` to a new `packages/ui-web/` package consumed by `apps/staff-web` and `apps/customer-web` only. `@gustri/ui` keeps cross-platform components.
   - **(b) Inline split**: keep file in `@gustri/ui` but split into `number-input.web.tsx` + `number-input.native.tsx` (RN throws or returns a stub). Configure Metro/Webpack to resolve the right one per platform.
2. Add a Biome `noRestrictedImports` rule under `packages/ui/biome.json` banning DOM-only types (`HTMLElement`, `Document`) and direct `document`/`window` references in `packages/ui/src/` files (excluding `web-only/` if option (b) is taken).
3. Update consumers to import from the new location if option (a).

## Acceptance

- [ ] No DOM types in `@gustri/ui` cross-platform files.
- [ ] Biome rule blocks future violations.
- [ ] Mobile `pnpm type-check` continues to pass.
