#!/bin/bash

# Create admin users for local development.
#
# Provisions two staff accounts seeded by supabase/seed.sql:
#   admin@test.com  / test1234   (tenant 1 — default fixture)
#   admin2@test.com / test1234   (tenant 2 — cross-tenant isolation fixture
#                                 used by apps/mobile/maestro/tenant-switch.yaml)

set -e

SUPABASE_URL="http://127.0.0.1:54321"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# create_user EMAIL FULL_NAME → echoes the auth user UUID on stdout.
create_user() {
  local email="$1"
  local full_name="$2"

  # All status output goes to stderr — only the final UUID may go to stdout
  # because the caller does `ADMIN_ID=$(create_user ...)` and captures stdout.
  echo "Creating user ($email / test1234)..." >&2

  local response
  response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${email}\",
      \"password\": \"test1234\",
      \"email_confirm\": true,
      \"user_metadata\": {\"full_name\": \"${full_name}\"}
    }")

  local user_id
  user_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$user_id" ]; then
    if echo "$response" | grep -q "already been registered"; then
      echo "User already exists. Fetching existing user..." >&2
      response=$(curl -s -X GET "${SUPABASE_URL}/auth/v1/admin/users?email=${email}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "apikey: ${ANON_KEY}")
      user_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    else
      echo "Error creating user $email:" >&2
      echo "$response" >&2
      exit 1
    fi
  fi

  echo "  User ID: $user_id" >&2
  echo "$user_id"
}

# link_staff EMAIL USER_ID — updates staff.auth_user_id for the seeded row.
link_staff() {
  local email="$1"
  local user_id="$2"
  echo "Linking auth user to staff record ($email)..."
  docker exec supabase_db_cafe-idare psql -U postgres -c \
    "UPDATE staff SET auth_user_id = '$user_id' WHERE email = '$email';"
}

ADMIN_ID=$(create_user "admin@test.com" "Admin User")
link_staff "admin@test.com" "$ADMIN_ID"

ADMIN2_ID=$(create_user "admin2@test.com" "Admin Two")
link_staff "admin2@test.com" "$ADMIN2_ID"

echo ""
echo "Admin users created successfully!"
echo "  admin@test.com  / test1234  (tenant 1)"
echo "  admin2@test.com / test1234  (tenant 2)"
