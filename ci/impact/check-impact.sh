#!/bin/bash
# ci/impact/check-impact.sh
# Quick impact check — used by pre-commit and pre-push hooks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$ROOT_DIR"

node ci/impact/analyze-impact.js
exit $?
