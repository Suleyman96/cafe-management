#!/usr/bin/env bash
#
# Patch on top of repair-prod-migrations.sh.
#
# The original script assumed everything before 20260503000001 was applied to prod.
# Empirically, four early-period migrations DID NOT run on prod (their tables are
# missing), and got incorrectly marked applied. Mark them reverted so `db push`
# re-runs them.
#
# Verified missing tables in prod (vpduwxmcaeqjglzmfcxo):
#   - public.financial_audit_log    (from 20260419000002_add_financial_audit_log.sql)
#   - public.feature_flags          (from 20260425000001_*)
#   - public.app_versions           (from 20260427000001_*)
#   - public.staff_push_tokens      (from 20260429000001_*)
#
# Also revert the three later migrations that already ran in the previous push
# attempt so we don't see "already exists" errors when push retries — they're
# idempotent enough to re-run, but cleaner to skip:
#   20260503000001, 20260503000002, 20260503000003
# (Decision: leave these as 'applied' since they actually did succeed; only
# revert truly-not-applied migrations.)

set -euo pipefail
cd "$(dirname -- "${BASH_SOURCE[0]}")/.."

echo "[1/2] Reverting tracker entries for migrations that didn't actually run…"
supabase migration repair --status reverted \
  20260419000002 \
  20260425000001 \
  20260427000001 \
  20260429000001

echo
echo "[2/2] Re-running supabase db push…"
echo "  (review the diff first; press Enter to continue or Ctrl-C to abort)"
read -r _
supabase db push

echo
echo "Done. Verify with:"
echo "  supabase migration list"
