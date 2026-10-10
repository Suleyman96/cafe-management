# Backup & Restore Runbook (DIY disaster recovery)

**Posture:** Gustri's prod Supabase project stays on the **Free** plan (no
managed backups, **no PITR**). The backup is the DIY, encrypted, offsite nightly
job in `.github/workflows/nightly-backup.yml`. Revisit Supabase **Pro** ($25/mo,
daily managed backups) — and only then reconsider PITR ($100/mo) — **at first
revenue**. Until then, **this runbook is the recovery plan.**

| Target | Value | Notes |
|---|---|---|
| **RPO** (max data loss) | **≤ 24 h** | Nightly dump at 02:30 UTC. A failure between runs can lose up to a day. |
| **RTO** (time to recover) | **≤ 4 h** target — **UNVALIDATED** | Fresh project provision + decrypt + restore + storage sync. The 4 h is an *estimate*: it is not proven until a drill records actual wall-clock (§5). Treat RTO as unknown until then. |

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
(`AGE_BACKUP_PUBLIC_KEY`) and, if an escrow recipient is configured
(`AGE_BACKUP_ESCROW_PUBLIC_KEY`), to a **second** public key as well. **CI only
ever holds public keys** — it can encrypt but cannot decrypt. The matching **age
private key is held OFFLINE by the operator** and is the single most important
secret in this whole system: **lose it and the backups are unrecoverable.** Store
it in a password manager / hardware token, not in the repo and not in CI.

> 🔑 **Key separation (HIGH-4).** Store the **age private key** and the
> **`app.pii_encryption_key`** (the GUC that decrypts PII, see §2) in **separate**
> locations — e.g. two different password-manager vaults / custodians. They are
> defense-in-depth for *different* threats: the age key protects the blob at
> rest; the PII key protects PII inside a decrypted dump. Co-locating them means
> one compromised vault yields both a backup and the ability to read its PII —
> exactly the correlation this split prevents. (An earlier draft said to keep
> them in the *same* store; that was wrong — keep them apart.)

### Escrow recipient (optional, recommended)

Set `AGE_BACKUP_ESCROW_PUBLIC_KEY` to a second age public key whose private key
is held by a **different** custodian (e.g. a co-founder, or a sealed offline
copy). Every nightly blob is then encrypted to **both** recipients, so losing
the operator's private key is survivable. It is **optional** — the backup is
"configured" without it — but strongly recommended once there is real data.

### Age key rotation

`age` recipients are baked into each blob at encryption time, so **rotating the
key does not re-key existing blobs** — old blobs still require the **old**
private key to decrypt. To rotate:

1. Generate a new keypair offline (`age-keygen -o backup-age-new.key`).
2. Update `AGE_BACKUP_PUBLIC_KEY` (and/or the escrow key) to the new public key.
   New nightly blobs are encrypted to the new recipient from the next run.
3. **Keep the old private key** for as long as any blob encrypted to it is still
   within retention (R2 lifecycle + the 30-day Actions artifact mirror), or
   proactively **re-encrypt** the blobs you want to keep: decrypt with the old
   key and re-encrypt to the new recipient. Only after every old-key blob has
   aged out may the old private key be destroyed.

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

# ⚠️ Load DATA with triggers/rules DISABLED — see "Why" below. Wrap the data
# load so the schema's BEFORE/AFTER triggers and validation do not re-fire on
# historical rows. `session_replication_role = 'replica'` makes the session skip
# user triggers AND FK/constraint triggers for the duration of the load.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET session_replication_role = 'replica';
\i restore-db/data.sql
RESET session_replication_role;
COMMIT;
SQL
```

> **Why disable triggers for the data load (HIGH-1).** The dumped rows are
> *history* — orders that were closed, paid, refunded, transferred. The schema's
> write-path guards are written for *live* mutations, not reloads, and will
> **abort the restore** if they re-fire. Concretely:
> - `payment_on_terminal_order` / `validate_payment_amount` reject inserting a
>   payment against an already-closed order — but that is exactly what the dump
>   contains (a closed order *and* its payment rows).
> - `guard_close_order_unpaid`, refund-amount validation, the order
>   state-machine trigger, and `recalculate_order_total` all assume a forward,
>   one-row-at-a-time transition and can reject or mutate bulk-loaded rows.
> - FK ordering: `replica` mode also defers FK trigger firing, so child rows
>   whose parent appears later in the dump don't trip a transient FK error.
>
> `session_replication_role = 'replica'` is the standard pg_restore-equivalent
> for a SQL data load (it is what `pg_restore --disable-triggers` does). It
> requires the session role to be a **superuser / replication role** — on a
> fresh scratch Postgres or a brand-new Supabase project you connect as
> `postgres`, which qualifies. **Live Supabase prod does NOT grant this**, which
> is the crux of the per-tenant procedure in §4.
>
> **Post-load re-validation.** Because the guards were bypassed, re-assert
> integrity *after* the load so you don't certify a silently-corrupt restore:
>
> ```bash
> # 1. FK integrity: re-validate every constraint the load deferred.
> psql "$DB_URL" -v ON_ERROR_STOP=1 -c "SET session_replication_role='origin';"
> # 2. Spot-check the money invariants the triggers normally enforce, e.g.
> #    every order's paid/refunded totals reconcile and no payment exceeds total:
> psql "$DB_URL" -At <<'SQL'
> SELECT o.id, o.total,
>        COALESCE(SUM(p.amount),0) AS paid,
>        COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.order_id=o.id),0) AS refunded
> FROM orders o LEFT JOIN order_payments p ON p.order_id=o.id
> GROUP BY o.id, o.total
> HAVING COALESCE(SUM(p.amount),0) - COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.order_id=o.id),0) > o.total + 0.01;
> SQL
> # (expect zero rows). Record row-count spot-checks vs prod in the §5 drill log.
> ```

> 🔑 **PII decryption:** the target DB **must** have the GUC
> `app.pii_encryption_key` set to the **same value** as prod, or encrypted PII
> (customer phones in `delivery_customers`, order customer fields) will not
> decrypt and staff-web throws on boot (`instrumentation.ts`):
>
> ```sql
> ALTER DATABASE postgres SET app.pii_encryption_key = '<same-strong-random-as-prod>';
> ```
>
> Set it **before** reading decrypted views. Store this key in a **separate**
> offline location from the age private key (see "Key separation" in §0) — two
> vaults, not one.

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

> **The core constraint (HIGH-2):** you **cannot** `\copy` historical rows
> straight into **live prod**. Two hard blockers:
> 1. **Triggers.** The same write-path guards described in §2
>    (`payment_on_terminal_order`, `validate_payment_amount`,
>    `guard_close_order_unpaid`, the order state-machine, refund validation,
>    `recalculate_order_total`) will reject or mutate the reloaded history — and
>    on live prod you **cannot** `SET session_replication_role = 'replica'` to
>    disable them: Supabase does **not** grant the connecting role superuser /
>    replication rights. (Setting it silently no-ops or errors.)
> 2. **No superuser.** Anything that needs `ALTER TABLE … DISABLE TRIGGER` or a
>    replication-role session is unavailable on managed prod.
>
> So per-tenant recovery is done in a **scratch project where you ARE superuser**,
> then re-imported into prod through a **trigger-safe path** (plain inserts that
> the live guards accept, or a maintenance window — see step 4).

1. **Restore the full dump to a SCRATCH project** (sections 1–2 above, triggers
   disabled via `session_replication_role='replica'`). You are `postgres` there,
   so the bulk history loads cleanly. **Never** run these steps against prod.
2. Extract the one tenant's rows by `tenant_id` **in the scratch DB**. The
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
   # Extract the tenant's rows FROM THE SCRATCH DB (per table, tenant-scoped).
   for t in categories menu_items tables staff orders order_items \
            order_payments refunds table_transfers financial_audit_log; do
     psql "$SCRATCH_DB_URL" -c \
       "\copy (SELECT * FROM public.$t WHERE tenant_id='$T') TO 'tenant-$t.csv' CSV HEADER"
   done
   ```

3. **Re-import into prod through a trigger-safe path.** You cannot disable
   triggers on live prod, so choose one of:

   - **Preferred — maintenance window + Supabase support.** For a large/complex
     tenant, schedule a window and ask Supabase support to run the load with
     replication-role disabled (or restore the scratch DB *as* the new prod if
     the whole project is being recovered). This is the only way to bulk-load
     history that the live guards would otherwise reject.
   - **Small tenant / recent data — insert via the app's own write paths or the
     service role**, honoring FK order and letting the triggers run. This only
     works when the rows don't violate the live guards (e.g. re-creating an
     open order and paying it forward), so it suits *recent* data, not deep
     closed/refunded history.

   Respect FK order on re-insert either way: `tenants` first, then catalog
   (`categories`, `menu_items`, `tables`, `staff`), then `orders`, then order
   children (`order_items`, `order_payments`, `refunds`, `table_transfers`,
   `financial_audit_log`).

   > Do **not** attempt a plain `\copy … FROM` of closed/paid/refunded history
   > directly into prod and expect it to "just work" — the write-path triggers
   > will reject it, and prod gives you no way to switch them off. Recover in the
   > scratch project; promote to prod only through one of the two paths above.

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
| `AGE_BACKUP_ESCROW_PUBLIC_KEY` _(optional)_ | Second age **public** recipient (HIGH-4). If set, every blob is encrypted to this key too, held by a **different** custodian — survivable loss of the operator key. Optional; does **not** count toward "configured". |
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
# For escrow, repeat on a SECOND custodian's machine and put that public key in
# AGE_BACKUP_ESCROW_PUBLIC_KEY (its private key stays with that custodian).
```

---

## 6b. R2 bucket hardening (operator — Cloudflare console) (MED-1)

The encrypted blobs are only as durable as the bucket they live in. Harden the
R2 bucket in the Cloudflare dashboard (this is console config, not CI):

- **Object Lock (WORM) / versioning.** Enable **Object Lock** on the backup
  bucket (compliance or governance mode) so a blob, once written, **cannot be
  overwritten or deleted** for the retention period — this defeats ransomware
  and a compromised CI key re-uploading garbage over good backups. If Object
  Lock is not used, at minimum enable **versioning** so an overwrite/delete
  leaves the prior version recoverable.
- **Lifecycle policy.** Add a lifecycle rule to expire blobs after your
  retention window (e.g. 30–90 days of nightlies) so storage doesn't grow
  unbounded — set the Object-Lock retention **≤** the lifecycle age so locked
  objects can eventually age out. Keep this window ≥ the age-key rotation
  overlap (§0) so you never lifecycle-delete a blob you still hold only an old
  key for.
- **Write-only, scoped token for CI.** The R2 token in CI
  (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`) should be scoped to **this
  bucket only** and to **put-object** (write) — **not** list/get/delete. CI only
  ever needs to *upload*; a leaked CI token must not be able to read back or
  delete existing backups. Use a **separate, read-enabled** token for restores,
  kept with the operator (not in CI). Object Lock still protects against a
  token that is mis-scoped with delete.

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
