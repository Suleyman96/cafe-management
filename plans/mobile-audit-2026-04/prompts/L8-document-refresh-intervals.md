# L8 — Document `REFRESH_INTERVALS` platform contract

## Context

[packages/core/src/constants.ts](../../../packages/core/src/constants.ts) lines 65–71 exports polling intervals consumed by both web and mobile. No documentation indicates platform assumptions.

## Steps

1. Add a JSDoc on `REFRESH_INTERVALS`:
   ```ts
   /**
    * Polling intervals for query fallbacks. Platforms may halve these
    * values when backgrounded. Do not raise without checking battery
    * impact on mobile (radio wakes per poll).
    */
   ```
2. Document each member individually (`ORDERS`, `TABLES`, `FALLBACK`, `DEGRADED_FALLBACK` from H1).

## Acceptance

- [ ] JSDoc present and shows up in IDE tooltips.
