#!/bin/bash

# Auto-commit and push script for warehouse removal app
# Usage: ./scripts/auto-commit.sh "Your commit message"

set -e

# Check if commit message is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 \"Your commit message\""
    echo "Example: $0 \"feat: Add new feature\""
    exit 1
fi

COMMIT_MSG="$1"

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

echo "🔄 Auto-committing changes..."

# Check if there are any changes
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ No changes to commit"
    exit 0
fi

# Add all changes
echo "📁 Adding files..."
git add .

# Commit with message
echo "💾 Committing changes..."
git commit -m "$COMMIT_MSG"

# Push to origin
echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Successfully committed and pushed changes!"
echo "📝 Commit: $COMMIT_MSG"
