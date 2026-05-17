#!/bin/bash
set -e

echo "🧪 Testing publish.sh script (dry-run mode)"
echo "============================================"
echo ""

# Save current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"
echo ""

# Simulate version increment
echo "📦 Simulating version increment..."
npm version patch --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ New version would be: $NEW_VERSION"
echo ""

# Restore original version (rollback for test)
echo "🔄 Rolling back version change (test mode)..."
npm version "$CURRENT_VERSION" --no-git-tag-version --allow-same-version
echo "✅ Version restored to: $(node -p "require('./package.json').version")"
echo ""

# Check if build works
echo "🔨 Testing build..."
npm run build
echo "✅ Build successful"
echo ""

# Check if tests pass
echo "🧪 Testing tests..."
npm test
echo "✅ Tests passed"
echo ""

echo "============================================"
echo "✅ All checks passed!"
echo ""
echo "The publish script should work correctly."
echo "It will increment version from $CURRENT_VERSION to $NEW_VERSION"
echo ""
echo "To actually publish, run: bash publish.sh"
