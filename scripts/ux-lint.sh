#!/usr/bin/env bash
set -euo pipefail

# UX lint guardrails (Phase 2)
# - blocks NEW purple utility usage in components/
# - blocks NEW "Ask FloraGPT" strings outside allowlisted surfaces
#
# Base ref can be overridden:
#   UX_LINT_BASE=origin/main bash scripts/ux-lint.sh

node "scripts/ux-lint.mjs"

