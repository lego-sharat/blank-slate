#!/bin/bash

# Install git hooks from .githooks directory to .git/hooks

echo "Installing git hooks..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

# Check if .git directory exists
if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Copy all hooks from .githooks to .git/hooks
for hook in "$SCRIPT_DIR"/*; do
  # Skip this install script
  if [ "$(basename "$hook")" = "install.sh" ] || [ "$(basename "$hook")" = "README.md" ]; then
    continue
  fi

  hook_name="$(basename "$hook")"
  cp "$hook" "$HOOKS_DIR/$hook_name"
  chmod +x "$HOOKS_DIR/$hook_name"
  echo "✅ Installed $hook_name"
done

echo ""
echo "✅ Git hooks installed successfully!"
echo "Hooks will now run automatically on git operations."
