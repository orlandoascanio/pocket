#!/bin/zsh
# Runs the database tests against the linked project. Everything is rolled back.
set -euo pipefail
cd "${0:A:h}/../.."
out=$(supabase db query --linked -f supabase/tests/pocket_test.sql 2>&1)
if print -r -- "$out" | grep -q '"all tests passed"'; then
  echo "✓ all tests passed"
else
  print -r -- "$out" | grep -v "new version\|recommend" >&2
  exit 1
fi
