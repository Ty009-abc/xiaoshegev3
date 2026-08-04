#!/bin/bash
# scripts/install-git-hooks.sh
# Install git hooks from .git-hooks/ directory

set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GIT_DIR="$ROOT_DIR/.git"

if [ ! -d "$GIT_DIR" ]; then
  echo "Error: not a git repository"
  exit 1
fi

HOOKS_DIR="$GIT_DIR/hooks"
SOURCE_DIR="$ROOT_DIR/.git-hooks"

echo "Installing git hooks..."

for hook in pre-commit pre-push; do
  if [ -f "$SOURCE_DIR/$hook" ]; then
    cp "$SOURCE_DIR/$hook" "$HOOKS_DIR/$hook"
    chmod +x "$HOOKS_DIR/$hook"
    echo "  ✓ $hook installed"
  else
    echo "  ✗ $hook source not found"
  fi
done

echo "Git hooks installed successfully."
