#!/usr/bin/env bash
set -euo pipefail

# Minimal sanity guard: toast icon symbols must be imported.

FILE="App.tsx"

if rg -n "GlobalToast" "$FILE" >/dev/null; then
  if rg -n "CheckCircleIcon" "$FILE" >/dev/null; then
    if ! rg -n "import\\s*\\{[^}]*\\bCheckCircleIcon\\b[^}]*\\}\\s*from\\s*['\\\"]\\./components/icons['\\\"]" "$FILE" >/dev/null; then
      echo "guard-toast-icons: FAILED"
      echo "App.tsx references CheckCircleIcon in GlobalToast but does not import it from ./components/icons"
      echo "Fix: import { CheckCircleIcon } from './components/icons' or remove the reference."
      exit 1
    fi
  fi
fi

echo "guard-toast-icons: OK"

