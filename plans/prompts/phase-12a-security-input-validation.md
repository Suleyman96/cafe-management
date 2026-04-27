# Phase 12A: Security — Input Validation & Zod Schemas for Unvalidated Routes

## Goal

Two staff API routes (`/api/staff` and `/api/staff/reset-password`) use manual `if (!field)` checks instead of Zod validation. The customer delivery phone field has no format validation client-side or server-side. Fix by adding proper Zod schemas and client-side validation.

## Important

- Read each file before editing
- Run `pnpm type-check && pnpm test` after changes
- Do NOT change business logic — only add validation
- Match the existing `validateBody` pattern used by all `/api/v1/` routes

---

## Step 1: Add Zod Schema for Staff Creation Route

**File:** `apps/staff-web/src/app/api/staff/route.ts`

Read the POST handler. Find the manual validation (~lines 30-38):
```typescript
if (!email || !password || !full_name || !role) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
}
```

Read `apps/staff-web/src/lib/api/validate.ts` to understand the `validateBody` helper pattern.

### Create the schema

Add a Zod schema at the top of the file (or in a shared schemas file if the project uses one for API route schemas):

```typescript
import { z } from 'zod';

const CreateStaffSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  full_name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['waiter', 'admin', 'kitchen', 'owner']),
  phone: z.string().regex(/^[+\d\s\-()]{7,20}$/, 'Invalid phone format').optional().nullable(),
});
```

Check `packages/database/src/enums/index.ts` for the exact `USER_ROLE` enum values to use in `z.enum()`.

### Replace manual validation

Replace the manual `if (!email || !password || !full_name || !role)` block with:

```typescript
const parseResult = CreateStaffSchema.safeParse(body);
if (!parseResult.success) {
  return NextResponse.json(
    { error: 'Validation failed', details: parseResult.error.issues },
    { status: 400 },
  );
}
const { email, password, full_name, role, phone } = parseResult.data;
```

Or use the `validateBody` helper if it exists:
```typescript
const { email, password, full_name, role, phone } = await validateBody(request, CreateStaffSchema);
```

Read the `validateBody` function to see if it returns parsed data or throws.

---

## Step 2: Add Zod Schema for Password Reset Route

**File:** `apps/staff-web/src/app/api/staff/reset-password/route.ts`

Read the handler. Find manual validation (~lines 29-31):
```typescript
if (!staffId || !newPassword) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
}
```

Add a schema:

```typescript
const ResetPasswordSchema = z.object({
  staffId: z.string().uuid('Invalid staff ID format'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(128),
});
```

Replace manual check with schema validation, same pattern as Step 1.

---

## Step 3: Add Phone Validation to Delivery Page (Client-Side)

**File:** `apps/customer-web/src/app/delivery/page.tsx`

Find the phone validation (~lines 51-54):
```typescript
if (!phone.trim()) {
  setError(t('deliveryLanding.errorPhone'));
  return;
}
```

Add format validation after the empty check:

```typescript
if (!phone.trim()) {
  setError(t('deliveryLanding.errorPhone'));
  return;
}

const phoneRegex = /^[+\d\s\-()]{7,20}$/;
if (!phoneRegex.test(phone.trim())) {
  setError(t('deliveryLanding.errorPhoneFormat'));
  return;
}
```

Check if the `deliveryLanding.errorPhoneFormat` translation key exists. If not, add it to the i18n files or use a generic message. Read the i18n structure to find where delivery landing keys are defined.

Also add `maxLength={20}` to the phone `<input>` element to match the DB column constraint (`character varying(20)`):

```tsx
<input
  type="tel"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
  maxLength={20}
  ...
/>
```

---

## Step 4: Add Phone Validation to Server Schema

**File:** `apps/staff-web/src/app/api/v1/customer/orders/route.ts`

Find the order creation schema. Look for `delivery_phone`:
```typescript
delivery_phone: z.string().optional().nullable(),
```

Tighten the validation:
```typescript
delivery_phone: z.string().regex(/^[+\d\s\-()]{7,20}$/).optional().nullable(),
```

This ensures even direct API calls can't store invalid phone formats.

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

Test manually:
- Try creating a staff member with invalid email, short password, invalid role — should get 400
- Try password reset with non-UUID staffId — should get 400
- Try delivery with phone "aaa" — should get client-side error
- Try delivery with phone "+1 555-1234" — should succeed

## Commit

Commit with message: `security: add Zod validation to staff routes, add phone format validation for delivery`
