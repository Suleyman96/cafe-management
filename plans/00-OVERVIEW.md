# Gustri Architecture Fix Plan — Overview

> Generated: 2026-04-20
> Author: Senior Architecture Review
> Branch: rafactoring/global-refactoring

## Summary

| Priority | Issues | Estimated Effort | Timeline |
|----------|--------|-----------------|----------|
| [CRITICAL](01-CRITICAL-fixes.md) | 2 issues | 1-2 days | Immediate |
| [HIGH](02-HIGH-fixes.md) | 6 issues | 3-5 days | This sprint |
| [MEDIUM](03-MEDIUM-fixes.md) | 10 issues | 5-8 days | Next 1-2 sprints |
| [LOW](04-LOW-fixes.md) | 7 issues | 1-2 days | When convenient |
| [ADDITIONAL](05-ADDITIONAL-findings.md) | 9 findings | Varies | Long-term |

## Recommended Execution Order

### Phase 1 — Stop the Bleeding (Day 1)
1. **CRIT-1:** Fix CI heredoc indentation (15 min)
2. **CRIT-2:** Add customer-web middleware (30 min)
3. **HIGH-4:** Remove hardcoded real email from test SQL (5 min)

### Phase 2 — CI Reliability (Day 2)
4. **HIGH-1:** Add `@gustri/queries` to CI build filters (15 min)
5. **HIGH-2:** Add marketing to CI type-check (5 min)
6. **HIGH-5:** Add mobile app CI coverage (30 min)
7. **HIGH-3:** Implement CI caching to eliminate redundant installs (1 hour)

### Phase 3 — Quick Config Wins (Day 3)
8. **MED-5:** Add exports field to packages/core (5 min)
9. **MED-9:** Enable turbo type-check caching (5 min)
10. **MED-10:** Align Supabase peer dep version (5 min)
11. **MED-1:** Align React types in shared packages (15 min)
12. **LOW-4/5/6:** Fix version drifts (tailwind-merge, zod, next.js) (10 min)

### Phase 4 — Security & Observability (Day 4-5)
13. **MED-3:** Add Sentry env vars to CI (15 min)
14. **MED-4:** Add pnpm audit to CI (30 min)
15. **MED-2:** Add health check endpoints (30 min)
16. **LOW-3:** Align marketing security headers (15 min)

### Phase 5 — Code Quality (Week 2)
17. **HIGH-6:** Replace 62+ `any` types with proper types (2-3 hours)
18. **MED-8:** Configure React Query staleTime (1 hour)
19. **LOW-1:** Remove console.log from production code (30 min)
20. **LOW-2:** Add storage listener cleanup (15 min)

### Phase 6 — Refactoring (Week 2-3)
21. **MED-7:** Split large components (3-4 hours)
22. **ADD-2:** Extract shared order filtering hook (part of MED-7)
23. **ADD-7:** Fix realtime subscription race condition (30 min)

### Phase 7 — Long-term (Ongoing)
24. **ADD-1:** Document migration rollback procedures
25. **ADD-3:** Verify/add error boundaries to customer-web
26. **ADD-5:** Implement optimistic updates for key mutations
27. **ADD-9:** Consider structured logging

## Key Principles

1. **Fix CI first** — All other fixes are meaningless if CI doesn't catch regressions
2. **Security before features** — Middleware, headers, and auth must be solid
3. **One PR per fix** — Atomic changes are easier to review and rollback
4. **Test every change** — Run `pnpm test && pnpm build && pnpm type-check` after each fix
5. **Don't over-refactor** — Component splitting should maintain identical behavior

## Files Most Frequently Changed

These files appear across multiple fix plans — coordinate changes:

| File | Appears In |
|------|-----------|
| `.github/workflows/ci.yml` | CRIT-1, HIGH-1, HIGH-2, HIGH-3, HIGH-5, MED-3, MED-4 |
| `turbo.json` | MED-9 |
| `packages/core/package.json` | MED-5 |
| `packages/database/package.json` | MED-10, LOW-5 |
| `packages/ui/package.json` | MED-1, LOW-4 |
| `packages/queries/package.json` | MED-1 |
| `apps/marketing/next.config.js` | LOW-3 |

**Recommendation:** Batch all `ci.yml` changes into a single PR to avoid
merge conflicts and CI churn.
