# Phase 11A: Error Handling — Fix `handleSupabaseError` Missing Code Mappings

## Goal

`handleSupabaseError` in `@gustri/core` only maps 7 error codes. Three common Supabase/Postgres error codes fall through to a generic `AppError` with a cryptic raw message. Fix by adding the missing mappings.

## Important

- Read the file before editing
- Run `pnpm type-check && pnpm test` after changes
- This is a foundation change — all apps benefit immediately

---

## Step 1: Add Missing Error Code Mappings

**File:** `packages/core/src/errors.ts`

Read the full `handleSupabaseError` function (~lines 74-112). Currently mapped:
- `PGRST301` → `AuthenticationError`
- `23505` → `ConflictError`
- `23503` → `ValidationError`
- `status 404` → `NotFoundError`
- `status 401` → `AuthenticationError`
- `status 403` → `AuthorizationError`
- `NETWORK_ERROR` / offline → `NetworkError`

Add these three missing mappings **after the `23503` check and before the `status === 404` check**:

```typescript
// PostgREST: .single() returned 0 or multiple rows
if (err.code === 'PGRST116') {
  return new NotFoundError(err.details || 'Resource');
}

// PostgreSQL: RLS or insufficient privilege
if (err.code === '42501') {
  return new AuthorizationError(err.message || 'Insufficient privileges');
}

// PostgreSQL: CHECK constraint violation (e.g., invalid enum value, amount validation)
if (err.code === '23514') {
  return new ValidationError(err.message || 'Value violates constraint');
}
```

Read the existing `NotFoundError`, `AuthorizationError`, and `ValidationError` constructor signatures to ensure the arguments match. Some may accept a single `string` message, others may accept a resource name.

Check the `NotFoundError` constructor — it likely expects a resource name like `'Resource'` and formats it as `"Resource not found"`. For `PGRST116`, use `err.details` if available (PostgREST includes the table/view name), otherwise fall back to `'Resource'`.

**Why these matter:**
- `PGRST116`: Every `.single()` call in the api-client (e.g., `findById`, `create`) that finds no row currently throws a generic `AppError` with the raw PostgREST message instead of `NotFoundError`. This means catch blocks checking `instanceof NotFoundError` miss these errors.
- `42501`: RLS policy denials return this code. Without mapping, they appear as generic errors instead of authorization failures.
- `23514`: CHECK constraint violations (e.g., invalid enum value reaching DB, payment amount validation triggers) appear as generic errors instead of validation errors.

---

## Step 2: Verify Error Classes Accept the Arguments

Read the error class definitions in the same file. Verify:

- `NotFoundError` constructor — does it accept a string? What does it do with it?
- `AuthorizationError` constructor — does it accept a message string?
- `ValidationError` constructor — does it accept a message string?

Adjust the constructor calls to match the existing signatures.

---

## Final Verification

```bash
pnpm type-check
pnpm test
```

If there are existing tests for `handleSupabaseError` (check `packages/core/src/__tests__/`), add test cases for the three new codes:

```typescript
test('maps PGRST116 to NotFoundError', () => {
  const result = handleSupabaseError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
  expect(result).toBeInstanceOf(NotFoundError);
});

test('maps 42501 to AuthorizationError', () => {
  const result = handleSupabaseError({ code: '42501', message: 'permission denied for table orders' });
  expect(result).toBeInstanceOf(AuthorizationError);
});

test('maps 23514 to ValidationError', () => {
  const result = handleSupabaseError({ code: '23514', message: 'new row violates check constraint' });
  expect(result).toBeInstanceOf(ValidationError);
});
```

## Commit

Commit with message: `fix: add PGRST116, 42501, 23514 error code mappings to handleSupabaseError`
