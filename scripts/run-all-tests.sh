#!/bin/bash

# Run all vitest suites across the monorepo. Prior implementation chained the
# 8 vitest configs with `&&`, so the first failure short-circuited the rest
# and masked redness in later suites — exactly how the staff-web RLS test and
# customer-web useLocale failures coexisted on main without anyone noticing.
#
# This script runs every suite regardless of others' results, captures each
# exit code, prints a per-suite summary, and exits non-zero if ANY suite
# failed. Pass --coverage to forward to all invocations.

set -u  # error on undefined; do NOT set -e because we explicitly track failures

COVERAGE_FLAG=""
if [ "${1:-}" = "--coverage" ]; then
  COVERAGE_FLAG="--coverage"
fi

# (label, vitest args) — order matches the prior `pnpm test` chain.
SUITES=(
  "root|--config vitest.config.ts"
  "queries|--config packages/queries/vitest.config.ts"
  "ui-web|--config packages/ui-web/vitest.config.ts"
  "i18n|--config packages/i18n/vitest.config.ts"
  "mobile|--config apps/mobile/vitest.config.ts"
  "customer-web|--config apps/customer-web/vitest.config.ts"
  "staff-web|--config apps/staff-web/vitest.config.ts"
)

declare -a RESULTS=()
FAILED=0

for entry in "${SUITES[@]}"; do
  label="${entry%%|*}"
  args="${entry#*|}"

  echo
  echo "════════════════════════════════════════════════════════════════"
  echo "  vitest [$label] $args $COVERAGE_FLAG"
  echo "════════════════════════════════════════════════════════════════"

  if pnpm exec vitest run $args $COVERAGE_FLAG; then
    RESULTS+=("PASS  $label")
  else
    RESULTS+=("FAIL  $label")
    FAILED=$((FAILED + 1))
  fi
done

echo
echo "════════════════════════════════════════════════════════════════"
echo "  Test summary"
echo "════════════════════════════════════════════════════════════════"
for line in "${RESULTS[@]}"; do
  echo "  $line"
done
echo
if [ "$FAILED" -gt 0 ]; then
  echo "  $FAILED suite(s) failed."
  exit 1
fi
echo "  All suites passed."
