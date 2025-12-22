#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

RG_BASE=(rg -n --hidden --no-heading --color=never
  --glob '!dist/**'
  --glob '!.vercel/**'
  --glob '!node_modules/**'
  --glob '!.git/**'
)

fail() {
  echo ""
  echo "guard-temp-ids: FAILED"
  echo "IDs going to DB must be UUID; use dbIdOrUndefined(id) or omit id."
  echo ""
  exit 1
}

echo "guard-temp-ids: scanning for forbidden Supabase id patterns..."

# 1) Direct quoted literals (high signal)
if "${RG_BASE[@]}" "id:\\s*['\\\"](?:tab-|sec-)" "$ROOT"; then
  echo ""
  echo "Found forbidden quoted temp id literal (tab-/sec-) in an id field:"
  "${RG_BASE[@]}" "id:\\s*['\\\"](?:tab-|sec-)" "$ROOT" || true
  fail
fi

# 2) Matrices/reports insert payloads: if 'id:' is present, it must use dbIdOrUndefined(...)
for table in matrices reports; do
  files=$("${RG_BASE[@]}" -l "supabase\\.from\\(\\s*['\\\"]${table}['\\\"]\\s*\\)\\.insert\\(" "$ROOT" || true)
  if [[ -z "${files}" ]]; then
    continue
  fi
  while IFS= read -r f; do
    # If the file contains an insert into this table and also contains an object-literal id field,
    # require that the file uses dbIdOrUndefined( ... ) somewhere on an id: line.
    if "${RG_BASE[@]}" "supabase\\.from\\(\\s*['\\\"]${table}['\\\"]\\s*\\)\\.insert\\(" "$f" >/dev/null; then
      if "${RG_BASE[@]}" "\\bid\\s*:" "$f" >/dev/null; then
        if ! "${RG_BASE[@]}" "\\bid\\s*:\\s*dbIdOrUndefined\\(" "$f" >/dev/null; then
          echo ""
          echo "Found ${table} insert with 'id:' but without dbIdOrUndefined(...): ${f}"
          echo "Relevant lines:"
          "${RG_BASE[@]}" "supabase\\.from\\(\\s*['\\\"]${table}['\\\"]\\s*\\)\\.insert\\(|\\bid\\s*:" "$f" || true
          fail
        fi
      fi
    fi
  done <<< "${files}"
done

# 3) Variable-shaped temp IDs inside insert payloads (heuristic, table-scoped)
for table in matrices reports; do
  files=$("${RG_BASE[@]}" -l "supabase\\.from\\(\\s*['\\\"]${table}['\\\"]\\s*\\)\\.insert\\(" "$ROOT" || true)
  if [[ -z "${files}" ]]; then
    continue
  fi
  while IFS= read -r f; do
    if "${RG_BASE[@]}" "\\bid\\s*:\\s*(tab|tabId|section|sectionId|sec|tempId)\\b" "$f"; then
      echo ""
      echo "Found suspicious id variable in ${table} insert payload (${f}):"
      "${RG_BASE[@]}" "\\bid\\s*:\\s*(tab|tabId|section|sectionId|sec|tempId)\\b" "$f" || true
      echo ""
      echo "Use: id: dbIdOrUndefined(tempId) (or omit id)."
      fail
    fi
  done <<< "${files}"
done

echo "guard-temp-ids: OK"

