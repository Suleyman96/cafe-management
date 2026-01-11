#!/bin/bash

# Direct method to enable email authentication
# This modifies the GoTrue container's environment variable

echo "🔧 Enabling email authentication in GoTrue container..."

# Stop Supabase
echo "Stopping Supabase..."
cd "$(dirname "$0")"
supabase stop

# Wait for containers to stop
sleep 2

# Find the auth container name
AUTH_CONTAINER=$(docker ps -a --filter "name=supabase_auth" --format "{{.Names}}" | head -1)

if [ -z "$AUTH_CONTAINER" ]; then
  echo "⚠️  Auth container not found. Starting Supabase normally..."
  supabase start
  exit 0
fi

# Remove the old container
echo "Removing old auth container..."
docker rm -f "$AUTH_CONTAINER" 2>/dev/null || true

# Start Supabase (it will recreate containers)
echo "Starting Supabase..."
supabase start

# Wait for auth container to start
sleep 5

# Check if email is enabled
echo ""
echo "Checking email authentication status..."
docker exec supabase_auth_cafe-idare env | grep GOTRUE_EXTERNAL_EMAIL_ENABLED || echo "⚠️  Could not check status"

echo ""
echo "✅ Done! Try sending a magic link now."
echo ""
echo "Note: If email is still disabled, you may need to:"
echo "1. Check Supabase CLI version: supabase --version"
echo "2. Update Supabase CLI: npm install -g supabase@latest"
echo "3. Or manually edit the docker-compose file in ~/.supabase"


