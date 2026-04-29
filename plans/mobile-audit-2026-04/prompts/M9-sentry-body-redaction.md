# M9 — Sentry breadcrumb body redaction

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [App.tsx](../../../apps/mobile/App.tsx) lines 54–79 strips `Authorization` headers and token query params, but request *bodies* are sent to Sentry as-is. A failed order-creation breadcrumb leaks `customer_name`, `customer_phone`, `delivery_address`, free-text notes. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M9.

## Implementation steps

1. **PII redact list**
   - New file `apps/mobile/src/lib/sentry-redaction.ts` exporting `PII_FIELDS = ['customer_name', 'customer_phone', 'phone', 'email', 'delivery_address', 'address', 'notes', 'note']` and a function `redactPii(value: unknown): unknown` that recursively walks objects/arrays and replaces matched keys with `'[redacted]'`.

2. **Apply in `beforeSend` and `beforeBreadcrumb`**
   - In `App.tsx` Sentry init, walk `event.breadcrumbs[*].data?.body` (parse JSON if it's a string). Replace with `redactPii(...)`. Same for top-level `event.request.data`.

3. **Tests**
   - Vitest: build a fake event with PII in a breadcrumb body → after `beforeSend`, no PII present.
   - Vitest: nested objects and arrays handled.

## Acceptance criteria

- [ ] Sentry events scrubbed of listed PII fields.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Server-side Sentry scrubbing.
