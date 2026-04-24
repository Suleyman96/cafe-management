# Phase 7c Prompt: CSP, Trigger Optimization, CI & Image Finishing (SCALE-17 + SCALE-20 + SCALE-23 + SCALE-24)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement 4 items from Phase 7 of `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. Two are new, two are finishing partially-done work. Total effort: ~2 days.

---

## SCALE-17: Remove CSP `unsafe-inline` for scripts

### Problem & current state
Both `apps/staff-web/next.config.js` and `apps/customer-web/next.config.js` have identical CSP at line 49:
```javascript
`script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`
```

Verified: zero `dangerouslySetInnerHTML`, zero inline `<script>` tags, zero `next/script` imports across both apps. The `'unsafe-inline'` is unnecessary.

### Implementation

Change line 49 in both files from:
```javascript
`script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
```
to:
```javascript
`script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
```

Keep `style-src 'self' 'unsafe-inline'` — Tailwind CSS requires it.

Files to change:
- `apps/staff-web/next.config.js` line 49
- `apps/customer-web/next.config.js` line 49

### Verification
- `pnpm build` succeeds for both apps
- Open both apps in production mode (`NODE_ENV=production pnpm start`) — no blank pages
- Browser console shows no CSP violation errors during normal navigation
- Login and order flows work normally

---

## SCALE-20: Narrow order_items triggers to relevant columns

### Problem & current state
`recalculate_on_item_update` (baseline.sql line 2166) fires on ANY `order_items` column update:
```sql
CREATE OR REPLACE TRIGGER "recalculate_on_item_update" AFTER UPDATE ON "public"."order_items"
FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_order_total"();
```

This calls `calculate_order_total()` on every item status change (pending→preparing→ready→served), but status changes don't affect totals. Only `quantity` and `item_price` changes do. At 50 orders × 3 items × 4 status transitions = **600 wasted recalculations/day/cafe**.

Similarly, `update_table_on_order` (baseline.sql line 2210) fires on every `orders` UPDATE:
```sql
CREATE OR REPLACE TRIGGER "update_table_on_order" AFTER INSERT OR UPDATE ON "public"."orders"
FOR EACH ROW EXECUTE FUNCTION "public"."update_table_status_on_order"();
```

Table status only depends on `status` and `table_id`, but this fires on every column (notes, discount, assigned_waiter, etc.).

### Implementation

Create migration `supabase/migrations/YYYYMMDD_optimize_order_triggers.sql`:

```sql
-- Narrow recalculate_on_item_update to only fire when price/quantity changes.
-- Status changes (the most frequent update) no longer trigger recalculation.
DROP TRIGGER IF EXISTS recalculate_on_item_update ON public.order_items;

CREATE TRIGGER recalculate_on_item_update
  AFTER UPDATE OF quantity, item_price ON public.order_items
  FOR EACH ROW
  WHEN (
    OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.item_price IS DISTINCT FROM NEW.item_price
  )
  EXECUTE FUNCTION public.recalculate_order_total();

-- Narrow update_table_on_order to only fire when order status or table assignment changes.
DROP TRIGGER IF EXISTS update_table_on_order ON public.orders;

CREATE TRIGGER update_table_on_order
  AFTER INSERT OR UPDATE OF status, table_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_table_status_on_order();
```

Do NOT touch these triggers (from Phase 2, carefully designed):
- `trg_sync_order_status_from_items`
- `cascade_order_status_trigger`

### Verification
- Update an item status (pending→preparing) → `calculate_order_total` should NOT fire
- Update an item quantity → total IS recalculated correctly
- Update order notes → `update_table_status_on_order` should NOT fire
- Create a new order → table status updates correctly
- Change order status → table status updates correctly
- Run `pnpm test`

---

## SCALE-23: Finish CI coverage (partially done)

### Problem & current state
App-level vitest configs already have coverage thresholds:
- `apps/staff-web/vitest.config.ts` lines 17-22: statements 60, branches 50, functions 60, lines 60
- `apps/customer-web/vitest.config.ts`: same thresholds

But CI (`.github/workflows/ci.yml` line 134) still runs `pnpm test` (no coverage). The root `vitest.config.ts` has `coverage.provider: 'v8'` but no thresholds.

No bundle analyzer is configured.

### Implementation

**Step 1** — Change CI test command. In `.github/workflows/ci.yml`, find the test step (line 133-134):
```yaml
      - name: Run tests
        run: pnpm test
```

Change to:
```yaml
      - name: Run tests with coverage
        run: pnpm test:coverage
```

Verify that `pnpm test:coverage` exists in root `package.json` and runs `vitest run --coverage`. It should already exist (check first).

**Step 2** — Add thresholds to root `vitest.config.ts` for packages (currently has none):

```typescript
export default defineConfig({
  test: {
    globals: true,
    exclude: [
      '**/e2e/**',
      '**/node_modules/**',
      '**/rls/**',
      'apps/staff-web/**',
      'apps/mobile/**',
      'apps/customer-web/**',
    ],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 55,
        lines: 60,
      },
    },
  },
});
```

**Step 3** — Add bundle analyzer. Install in both web apps:

```bash
pnpm add -D @next/bundle-analyzer --filter=@gustri/staff-web --filter=@gustri/customer-web
```

Update both `next.config.js` files. Wrap the config conditionally:

```javascript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// At the bottom, wrap the export:
module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), { ... });
```

Add a script to root `package.json`:
```json
"analyze": "ANALYZE=true turbo build --filter=@gustri/staff-web --filter=@gustri/customer-web"
```

This is opt-in — only runs when `ANALYZE=true`. Not in CI by default (generates HTML reports that need manual review).

### Verification
- `pnpm test:coverage` runs and enforces thresholds
- Temporarily lower a coverage threshold → test fails
- `ANALYZE=true pnpm build --filter=@gustri/staff-web` → generates bundle analysis HTML
- CI runs coverage when pushed
- Run `pnpm check`

---

## SCALE-24: Finish image optimization (partially done)

### Problem & current state
Customer-web already uses Next.js `<Image>` with responsive sizing (done). Staff-web's `image-upload.tsx` uploads raw files without compression — a 4MB DSLR photo gets served as-is.

### Implementation

**Step 1** — Install browser-image-compression in staff-web:

```bash
pnpm add browser-image-compression --filter=@gustri/staff-web
```

**Step 2** — Update `apps/staff-web/src/components/settings/image-upload.tsx`. In the `handleFile` function (line 41), add compression before upload:

```typescript
import imageCompression from 'browser-image-compression';

const handleFile = useCallback(
  async (file: File) => {
    // Existing validation (lines 43-54) stays the same
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Image must be smaller than ${maxSizeMB}MB`);
      return;
    }

    setIsUploading(true);

    try {
      // Compress and convert to WebP before upload
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      // Generate filename with .webp extension
      const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;

      // Upload compressed file
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filename, compressed, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/webp',
        });

      // ... rest of error handling unchanged
```

**Key changes:**
- Import `imageCompression` at the top
- Compress to 0.5MB max, 1200px max dimension, WebP format
- Change filename extension to `.webp`
- Add `contentType: 'image/webp'` to the upload

**Step 3** — Keep the existing validation (file type + size checks) as a first-pass filter. The compression handles the rest.

### Verification
- Upload a 3MB JPEG → stored as ~400KB WebP in Supabase Storage
- Upload a small PNG (< 100KB) → still compressed but stays small
- Image displays correctly after upload (check the public URL)
- `pnpm type-check && pnpm check`

---

## General rules
- Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before done.
- Migration filenames: `YYYYMMDD000001_description.sql`. Check latest date prefix.
- Run `pnpm test && pnpm type-check && pnpm check` at the end.
