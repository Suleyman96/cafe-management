#!/bin/bash

# Create admin user for local development
# Email: admin@test.com
# Password: test1234

set -e

SUPABASE_URL="http://127.0.0.1:54321"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

echo "Creating admin user (admin@test.com / test1234)..."

# Create user via Supabase Admin API
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "test1234",
    "email_confirm": true,
    "user_metadata": {"full_name": "Admin User"}
  }')

# Extract user ID from response
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  # Check if user already exists
  if echo "$RESPONSE" | grep -q "already been registered"; then
    echo "User already exists. Fetching existing user..."

    # Get existing user
    RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/auth/v1/admin/users?email=admin@test.com" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "apikey: ${ANON_KEY}")

    USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  else
    echo "Error creating user:"
    echo "$RESPONSE"
    exit 1
  fi
fi

echo "User ID: $USER_ID"

# Update staff table to link auth user
echo "Linking auth user to staff record..."
docker exec supabase_db_cafe-idare psql -U postgres -c \
  "UPDATE staff SET auth_user_id = '$USER_ID' WHERE email = 'admin@test.com';"

echo ""
echo "Admin user created successfully!"
echo "  Email: admin@test.com"
echo "  Password: test1234"
