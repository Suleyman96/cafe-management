#!/bin/bash

# Supabase Type Generation Script
# This script generates TypeScript types from your Supabase database

echo "🔄 Generating Supabase types..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Installing..."
    npm install -g supabase
fi

# You'll need to set these environment variables or pass them as arguments
SUPABASE_PROJECT_ID=${SUPABASE_PROJECT_ID:-"your-project-id"}
SUPABASE_DB_URL=${SUPABASE_DB_URL:-"postgresql://postgres:postgres@localhost:54322/postgres"}

# Generate types
echo "📝 Generating types from database..."

# Option 1: Generate from remote project (requires login)
# supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > ./packages/database/src/types/generated.ts

# Option 2: Generate from local database URL
npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > ./packages/database/src/types/generated.ts

# Add eslint disable comment to generated file
echo "/* eslint-disable */" | cat - ./packages/database/src/types/generated.ts > temp && mv temp ./packages/database/src/types/generated.ts

echo "✅ Types generated successfully!"
echo "📍 Output: packages/database/src/types/generated.ts"

# Update the database package to use generated types
echo "🔧 Updating database package to use generated types..."

cat > ./packages/database/src/types/database.ts << 'EOF'
/**
 * Database Types
 * Re-exports the generated types from Supabase
 */

export * from './generated';

// You can add custom type extensions here
EOF

echo "✅ Database package updated!"
echo ""
echo "Next steps:"
echo "1. Set SUPABASE_PROJECT_ID or SUPABASE_DB_URL environment variable"
echo "2. Run this script: ./scripts/generate-types.sh"
echo "3. Rebuild packages: pnpm --filter '@cafe-idare/*' build"