#!/bin/bash

# Create an owner account for a new tenant
# Usage: ./scripts/create-owner-user.sh <email> <password> <full_name> [restaurant_name]
#
# Example (local):
#   ./scripts/create-owner-user.sh owner@restaurant.com MyPass123 "John Smith" "Pizza Palace"
#
# Example (production):
#   SUPABASE_URL=https://xyz.supabase.co SERVICE_ROLE_KEY=eyJ... \
#     ./scripts/create-owner-user.sh owner@restaurant.com MyPass123 "John Smith" "Pizza Palace"
#
# Environment variables:
#   SUPABASE_URL      - Supabase API URL (default: http://127.0.0.1:54321)
#   SERVICE_ROLE_KEY  - Supabase service role key (default: local dev key)

set -e

# --- Args ---
EMAIL="${1:?Usage: $0 <email> <password> <full_name> [restaurant_name]}"
PASSWORD="${2:?Usage: $0 <email> <password> <full_name> [restaurant_name]}"
FULL_NAME="${3:?Usage: $0 <email> <password> <full_name> [restaurant_name]}"
RESTAURANT_NAME="${4:-${FULL_NAME} Restaurant}"

# --- Config ---
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

echo "Creating owner account..."
echo "  Email:      $EMAIL"
echo "  Name:       $FULL_NAME"
echo "  Restaurant: $RESTAURANT_NAME"
echo "  Supabase:   $SUPABASE_URL"
echo ""

# --- Step 1: Create tenant ---
echo "[1/4] Creating tenant..."
SLUG=$(echo "$RESTAURANT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
SLUG="${SLUG}-$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8)"

TENANT_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/tenants" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"name\": \"${RESTAURANT_NAME}\",
    \"slug\": \"${SLUG}\"
  }")

TENANT_ID=$(echo "$TENANT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  echo "  ERROR: Failed to create tenant"
  echo "  Response: $TENANT_RESPONSE"
  exit 1
fi

echo "  Tenant ID: $TENANT_ID"

# --- Step 2: Create auth user ---
echo "[2/4] Creating auth user..."
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"email_confirm\": true,
    \"user_metadata\": {\"full_name\": \"${FULL_NAME}\"}
  }")

USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  if echo "$RESPONSE" | grep -q "already been registered"; then
    echo "  User already exists, fetching..."
    RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/auth/v1/admin/users" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "apikey: ${SERVICE_ROLE_KEY}")
    USER_ID=$(echo "$RESPONSE" | grep -o "\"id\":\"[^\"]*\",\"aud\":\"authenticated\",\"role\":\"authenticated\",\"email\":\"${EMAIL}\"" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  fi

  if [ -z "$USER_ID" ]; then
    echo "  ERROR: Failed to create or find user"
    echo "  Response: $RESPONSE"
    exit 1
  fi
fi

echo "  Auth user ID: $USER_ID"

# --- Step 3: Create staff record with owner role ---
echo "[3/4] Creating staff record (role: owner)..."
STAFF_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/staff" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "{
    \"auth_user_id\": \"${USER_ID}\",
    \"email\": \"${EMAIL}\",
    \"full_name\": \"${FULL_NAME}\",
    \"role\": \"owner\",
    \"tenant_id\": \"${TENANT_ID}\"
  }")

if [ "$STAFF_RESPONSE" -ge 200 ] && [ "$STAFF_RESPONSE" -lt 300 ]; then
  echo "  Staff record created/updated"
else
  echo "  ERROR: Failed to create staff record (HTTP $STAFF_RESPONSE)"
  curl -s -X POST "${SUPABASE_URL}/rest/v1/staff" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "{
      \"auth_user_id\": \"${USER_ID}\",
      \"email\": \"${EMAIL}\",
      \"full_name\": \"${FULL_NAME}\",
      \"role\": \"owner\",
      \"tenant_id\": \"${TENANT_ID}\"
    }"
  exit 1
fi

# --- Step 4: Create cafe_settings for tenant ---
echo "[4/4] Setting restaurant name..."
SETTINGS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "${SUPABASE_URL}/rest/v1/cafe_settings" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"restaurant_name\": \"${RESTAURANT_NAME}\", \"tenant_id\": \"${TENANT_ID}\"}")

if [ "$SETTINGS_RESPONSE" -ge 200 ] && [ "$SETTINGS_RESPONSE" -lt 300 ]; then
  echo "  Restaurant name set"
else
  echo "  WARNING: Failed to set restaurant name (HTTP $SETTINGS_RESPONSE)"
  echo "  The owner can set this manually in Cafe Settings"
fi

echo ""
echo "Owner account created successfully!"
echo "  Email:      $EMAIL"
echo "  Password:   $PASSWORD"
echo "  Tenant ID:  $TENANT_ID"
echo ""
echo "Next steps for the owner:"
echo "  1. Log in to the staff dashboard"
echo "  2. Go to Cafe Settings to configure the restaurant"
echo "  3. Go to Staff to create admin/waiter/kitchen accounts"
echo "  4. Go to Menu to add categories and items"
echo "  5. Go to Tables to set up the floor plan"
