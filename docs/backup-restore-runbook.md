# Backup & Restore Runbook (DIY disaster recovery)

**Posture:** Gustri's prod Supabase project stays on the **Free** plan (no
managed backups, **no PITR**). The backup is the DIY, encrypted, offsite nightly
job in `.github/workflows/nightly-backup.yml`. Revisit Supabase **Pro** ($25/mo,
daily managed backups) — and only then reconsider PITR ($100/mo) — **at first
revenue**. Until then, **this runbook is the recovery plan.**

| Target | Value | Notes |
|---|---|---|
| **RPO** (max data loss) | **≤ 24 h** | Nightly dump at 02:30 UTC. A failure between runs can lose up to a day. |
| **RTO** (time to recover) | **≤ 4 h** target | Fresh project provision + decrypt + restore + storage sync. |

> ⚠️ **GO/NO-GO GATE:** The data-retention cron (`data-retention.yml` +
> `RETENTION_ENDPOINT_URL` / `RETENTION_CRON_SECRET`) **MUST stay DISABLED
> (secrets unset)** until a restore from these backups has been successfully
> tested and logged (see "Tested restore log" below). Retention permanently
> deletes financial/PII rows; never enable irreversible deletion before you
> have proven you can recover.

---

## 0. What the nightly job produces

Two encrypted blobs per night in the Cloudflare R2 bucket (`$R2_BUCKET`):

- `db/gustri-db-<YYYY-MM-DD>.tar.gz.age` — `roles.sql`, `schema.sql`, `data.sql`
  from `supabase db dump`.
- `storage/gustri-storage-<YYYY-MM-DD>.tar.gz.age` — the `menu-images`,
  `qr-codes`, and `branding` Storage buckets.

Both are encrypted with **`age`** to a recipient **public** key
(`AGE_BACKUP_PUBLIC_KEY`). **CI only ever holds the public key** — it can
encrypt but cannot decrypt. The matching **age private key is held OFFLINE by
the operator** and is the single most important secret in this whole system:
**lose it and the backups are unrecoverable.** Store it in a password manager /
hardware token, not in the repo and not in CI.

### Prerequisites to restore

- The **age private key file** (e.g. `~/.config/gustri/backup-age.key`).
- `age`, `awscli` (v2), `supabase` CLI, and `psql` installed locally.
- R2 read credentials (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` /
  `R2_ENDPOINT` / `R2_BUCKET`) to fetch the blobs.
- For a real restore: a **fresh** Supabase project (or scratch Postgres) — never
  restore onto the live prod DB.

---

## 1. Fetch + decrypt + untar

```bash
export AWS_ACCESS_KEY_ID=…      # R2 access key
export AWS_SECRET_ACCESS_KEY=…  # R2 secret
export R2_ENDPOINT=…            # https://<account>.r2.cloudflarestorage.com
export R2_BUCKET=…
export AWS_DEFAULT_REGION=auto
DATE=2026-10-10                 # the night you want to restore

# DB blob
aws s3 cp "s3://$R2_BUCKET/db/gustri-db-$DATE.tar.gz.age" . --endpoint-url "$R2_ENDPOINT"
age -d -i ~/.config/gustri/backup-age.key \
  -o "gustri-db-$DATE.tar.gz" "gustri-db-$DATE.tar.gz.age"
mkdir -p restore-db && tar -xzf "gustri-db-$DATE.tar.gz" -C restore-db
ls restore-db   # roles.sql  schema.sql  data.sql

# Storage blob
aws s3 cp "s3://$R2_BUCKET/storage/gustri-storage-$DATE.tar.gz.age" . --endpoint-url "$R2_ENDPOINT"
age -d -i ~/.config/gustri/backup-age.key \
  -o "gustri-storage-$DATE.tar.gz" "gustri-storage-$DATE.tar.gz.age"
mkdir -p restore-storage && tar -xzf "gustri-storage-$DATE.tar.gz" -C restore-storage
ls restore-storage   # menu-images/  qr-codes/  branding/
```

---

## 2. Full DB restore (to a fresh Supabase project / scratch Postgres)

Restore order is **roles → schema → data** (matches the dump order).

```bash
# DB_URL points at the FRESH target DB (not prod).
export DB_URL="postgresql://postgres:<password>@<host>:5432/postgres"

psql "$DB_URL" -v ON_ERROR_STOP=1 -f restore-db/roles.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f restore-db/schema.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f restore-db/data.sql
```

> 🔑 **PII decryption:** the target DB **must** have the GUC
> `app.pii_encryption_key` set to the **same value** as prod, or encrypted PII
> (customer phones in `delivery_customers`, order customer fields) will not
> decrypt and staff-web throws on boot (`instrumentation.ts`):
>
> ```sql
> ALTER DATABASE postgres SET app.pii_encryption_key = '<same-strong-random-as-prod>';
> ```
>
> Set it **before** reading decrypted views. Keep this key in the same offline
> store as the age private key.

---

## 3. Storage restore

Sync the decrypted objects back into the target project's Storage buckets via
its S3 endpoint:

```bash
export AWS_ACCESS_KEY_ID=…      # target Supabase S3 access key
export AWS_SECRET_ACCESS_KEY=…  # target Supabase S3 secret
export S3_ENDPOINT=…            # target Supabase S3 endpoint

for bucket in menu-images qr-codes branding; do
  aws s3 sync "restore-storage/$bucket" "s3://$bucket" --endpoint-url "$S3_ENDPOINT"
done
```

(The buckets must exist on the target — they are declared in
`supabase/config.toml` and created by applying migrations/config, or create
them in the dashboard first.)

---

## 4. Per-tenant recovery (restore ONE tenant without clobbering the rest)

1. Restore the **full** dump to a **scratch** DB (sections 1–2 above).
2. Extract the one tenant's rows by `tenant_id` and re-insert into prod. The
   authoritative per-tenant table set is the GDPR export route
   (`apps/staff-web/src/app/api/v1/admin/export/route.ts`, `TENANT_TABLES`):

   ```
   cafe_settings, categories, menu_items, menu_item_options,
   menu_item_option_values, tables, staff, staff_schedules,
   staff_kitchen_filters, orders, order_items, order_payments, refunds,
   waiter_calls, customer_feedback, table_transfers, stock_items,
   stock_movements, expense_categories, expenses, waste_logs, tasks,
   task_categories, financial_audit_log
   ```

   plus:
   - **`tenants`** — the tenant profile row, keyed by `id` (NOT `tenant_id`).
   - **`orders`** — the route reads it through the **`orders_decrypted`** view
     for export; the underlying `orders` table is what you restore.
   - **`delivery_customers`** — holds an encrypted phone; its decrypted view
     (`delivery_customers_decrypted`) is role-gated, so decrypt requires
     `app.pii_encryption_key` + a user context, not the service role.

   > Tenant isolation hangs entirely on the `WHERE tenant_id = '<uuid>'` filter —
   > every table above carries `tenant_id`. Apply it to **every** extract query.
   > Excluded from recovery as live secrets, not business data: `qr_tokens`,
   > `staff_push_tokens`, and `staff.pin_hash`.

   ```bash
   T='00000000-0000-0000-0000-000000000001'  # the tenant to recover
   # Example: dump one tenant's orders from the scratch DB as data-only INSERTs.
   pg_dump "$SCRATCH_DB_URL" --data-only --table=public.orders \
     --on-conflict-do-nothing \
     | grep -v '^$' > tenant-orders.sql   # then filter / load deliberately
   # Preferred: per-table `\copy (SELECT * FROM <t> WHERE tenant_id='$T') TO …`
   # then `\copy <t> FROM …` into prod, honoring FK order (tenants → staff/
   # tables/categories → menu_items → orders → order_items/payments/refunds/…).
   ```

   Respect FK order on re-insert: `tenants` first, then catalog
   (`categories`, `menu_items`, `tables`, `staff`), then `orders`, then order
   children (`order_items`, `order_payments`, `refunds`, `table_transfers`,
   `financial_audit_log`).

---

## 5. Tested restore log (fill in during the drill — this is the go/no-go gate)

Run a **real** restore against a throwaway project and record it here. The
operator owns this; it cannot be run from CI.

```
Date of drill:            __________
Backup blob used:         db/gustri-db-__________.tar.gz.age
Operator:                 __________
Target project ref:       __________  (throwaway)

[ ] age -d decrypted the DB blob (private key works)
[ ] roles.sql / schema.sql / data.sql applied with ON_ERROR_STOP=1, no errors
[ ] app.pii_encryption_key set on target; decrypted views return real PII
[ ] Storage blob decrypted + synced; a known menu-image URL resolves
[ ] staff-web boots against the restored DB (no instrumentation.ts throw)
[ ] Spot-check row counts vs. prod (orders, order_payments, financial_audit_log)
[ ] Per-tenant extract produced one tenant's data, correctly scoped

Wall-clock time to usable restore: ________   (target ≤ 4h / RTO)
Result:  PASS / FAIL
Notes:   __________________________________________________

>> Only after a PASS here may the data-retention cron be enabled. <<
```

---

## 6. New GitHub Actions / environment secrets the operator must set

Set these in the **`production`** environment (same place as the existing
`SUPABASE_*` secrets):

| Secret | Purpose |
|---|---|
| `AGE_BACKUP_PUBLIC_KEY` | age **public** recipient key CI encrypts to (keep the **private** key OFFLINE). |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key (write to the backup bucket). |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret. |
| `R2_BUCKET` | R2 bucket name for backups. |
| `R2_ENDPOINT` | R2 S3 endpoint `https://<account>.r2.cloudflarestorage.com`. |
| `SUPABASE_S3_ACCESS_KEY` | Supabase Storage S3 access key (read buckets). |
| `SUPABASE_S3_SECRET` | Supabase Storage S3 secret. |
| `SUPABASE_S3_ENDPOINT` | Supabase Storage S3 endpoint. |
| `SUPABASE_S3_REGION` _(optional)_ | Supabase Storage S3 region for SigV4 signing. Supabase (unlike R2) rejects `region=auto`, so it must match the **project region** — find it in the Supabase dashboard under Project Settings → General (or the Storage → S3 connection panel), e.g. `us-east-1`, `eu-central-1`, `ap-southeast-1`. **Defaults to `us-east-1`** if unset; set it if your project is in a different region or the storage sync fails with a region/signature error. (R2 stays on `auto` — it does not use this.) |

> **Until these secrets are set, the nightly jobs skip quietly.** A `guard` job
> checks whether the backup-specific secrets are present. If they are **entirely
> unset**, the DB / Storage jobs are **skipped** with a warning — no failure, no
> tracking issue — so an un-onboarded repo doesn't open a failure issue every
> night. Once **any** backup secret is set, that job runs, enforces that **all**
> its required secrets are present, and opens a tracking issue on any real
> failure (a **partial** config is treated as a real failure and alerts loudly).
> `SUPABASE_S3_REGION` is optional and does **not** count toward "configured".

To generate the age keypair (operator, offline):

```bash
age-keygen -o backup-age.key          # prints the public key to stderr
# Put the printed "Public key: age1…" value in AGE_BACKUP_PUBLIC_KEY.
# Store backup-age.key (the PRIVATE key) OFFLINE — never in the repo or CI.
```

---

## 7. Related go-live doc updates (apply on the go-live branch)

> These edits belong in `docs/prod-config-runbook.md` and
> `docs/go-live-checklist.md`, which live on the in-flight `feat/payment-ui-ux`
> (go-live) branch and are **not present on this branch's base** — so they
> cannot be edited in this backup PR without forking those docs and causing a
> merge conflict. Apply them when that branch merges (or fold into it).

**`docs/prod-config-runbook.md` §7 (Backups)** — replace the two bullets with:

> - Backups are DIY-hardened on Supabase **Free**: the nightly GitHub Action
>   (`nightly-backup.yml`) dumps the DB **and** Storage buckets, `age`-encrypts
>   them (public key in CI; private key offline), and ships them offsite to
>   **Cloudflare R2**. No plaintext leaves CI. Confirm both jobs are green.
> - **RPO ≤ 24h, RTO target ≤ 4h.** Restore procedure:
>   [`docs/backup-restore-runbook.md`](./backup-restore-runbook.md).
> - A **tested restore** (drill logged in the runbook) is the go/no-go gate
>   before onboarding; the retention cron stays disabled until it passes.
> - **Skip PITR; DIY-hardened on Free; revisit Supabase Pro at first revenue.**
> - New secrets to set (see runbook §6): `AGE_BACKUP_PUBLIC_KEY`, `R2_ACCESS_KEY_ID`,
>   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `SUPABASE_S3_ACCESS_KEY`,
>   `SUPABASE_S3_SECRET`, `SUPABASE_S3_ENDPOINT` (+ optional `SUPABASE_S3_REGION`,
>   defaults to `us-east-1`). Until they are set, the nightly jobs skip quietly.

**`docs/go-live-checklist.md` §A** (Supabase prod project bullet) — the backup
clause should read:

> Interim backup safety net: ✅ **encrypted + offsite** nightly GitHub Action
> (DB + Storage → age → Cloudflare R2; RPO ≤ 24h, RTO ≤ 4h; see
> `docs/backup-restore-runbook.md`). **Skip PITR; DIY-hardened on Free; revisit
> Supabase Pro at first revenue.**

**`docs/go-live-checklist.md` §C** — **resolve the PITR contradiction.** §A says
"skip PITR" but §C said "🟠 Confirm PITR enabled (§A)". Replace the §C line with:

> - [ ] 🟠 Backups: DIY-hardened on Free (encrypted + R2 + Storage) — **skip
>   PITR; revisit Supabase Pro at first revenue** (§A). Confirm `nightly-backup.yml`
>   is green **and a restore has been tested** (`docs/backup-restore-runbook.md`)
>   before onboarding. Set the new backup secrets (§D / runbook §6).
