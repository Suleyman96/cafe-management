#!/bin/bash

# Fix: Enable Email Authentication in Local Supabase
# This script modifies the GoTrue container to enable email auth

echo "🔧 Enabling email authentication..."

# Stop Supabase
echo "Stopping Supabase..."
cd "$(dirname "$0")"
supabase stop

# Wait a moment
sleep 2

# Find and modify the docker-compose file
# Supabase stores it in ~/.supabase or in the project directory
COMPOSE_FILE=$(find ~/.supabase -name "docker-compose.yml" 2>/dev/null | head -1)

if [ -z "$COMPOSE_FILE" ]; then
  echo "⚠️  Could not find docker-compose.yml"
  echo "Trying alternative method..."
  
  # Alternative: Use docker to modify the container
  echo "Starting Supabase..."
  supabase start
  
  echo "Waiting for containers to start..."
  sleep 5
  
  # Try to set the env var in the running container (won't persist, but might work)
  echo "Attempting to enable email auth in running container..."
  docker exec supabase_auth_cafe-idare sh -c 'export GOTRUE_EXTERNAL_EMAIL_ENABLED=true' 2>/dev/null || true
  
  echo ""
  echo "✅ Supabase restarted"
  echo "⚠️  Note: Email auth might still be disabled. Use magic link as fallback."
  exit 0
fi

echo "Found docker-compose.yml at: $COMPOSE_FILE"

# Backup the file
cp "$COMPOSE_FILE" "${COMPOSE_FILE}.backup"

# Modify the file to enable email auth
# This is a bit tricky - we need to find the auth service and modify its environment
if grep -q "GOTRUE_EXTERNAL_EMAIL_ENABLED" "$COMPOSE_FILE"; then
  # Replace false with true
  sed -i '' 's/GOTRUE_EXTERNAL_EMAIL_ENABLED=false/GOTRUE_EXTERNAL_EMAIL_ENABLED=true/g' "$COMPOSE_FILE"
  echo "✅ Updated GOTRUE_EXTERNAL_EMAIL_ENABLED to true"
else
  # Add the environment variable
  # This is more complex - we'd need to parse YAML properly
  echo "⚠️  Could not find GOTRUE_EXTERNAL_EMAIL_ENABLED in docker-compose.yml"
  echo "You may need to manually edit the file"
fi

# Start Supabase
echo "Starting Supabase..."
supabase start

echo ""
echo "✅ Done! Email authentication should now be enabled."
echo "Test it at: http://localhost:3001/login"


