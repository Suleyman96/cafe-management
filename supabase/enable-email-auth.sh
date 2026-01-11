#!/bin/bash

# Script to enable email authentication in local Supabase
# This modifies the GoTrue service configuration

echo "Attempting to enable email authentication..."

# Get the service role key
SERVICE_KEY="sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
BASE_URL="http://127.0.0.1:54321"

# Method 1: Try to update via GoTrue admin API
echo "Method 1: Trying GoTrue admin API..."
curl -X PUT "${BASE_URL}/auth/v1/admin/settings" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "EXTERNAL_EMAIL_ENABLED": true,
    "external": {
      "email": true
    }
  }' 2>&1

echo ""
echo ""

# Method 2: Check current settings
echo "Method 2: Checking current auth settings..."
curl -X GET "${BASE_URL}/auth/v1/settings" \
  -H "apikey: ${SERVICE_KEY}" 2>&1 | python3 -m json.tool 2>/dev/null || curl -X GET "${BASE_URL}/auth/v1/settings" \
  -H "apikey: ${SERVICE_KEY}" 2>&1

echo ""
echo ""

# Method 3: Try direct GoTrue configuration
echo "Method 3: Note - For local Supabase, email auth should be enabled by default."
echo "If it's disabled, you may need to:"
echo "1. Check Supabase Studio > Authentication > Providers"
echo "2. Or restart Supabase: supabase stop && supabase start"
echo "3. Or check if there's a .env file in the supabase directory"


