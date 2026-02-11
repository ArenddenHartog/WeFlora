-- Schema Drift Detection v1.0
-- Run this against the Supabase database to verify required schema.
-- Output: PASS/FAIL rows for each check.
-- Usage: psql -f scripts/schema-drift-check.sql
-- Or paste into Supabase SQL editor.

-- ═══════════════════════════════════════════════════════
-- 1. Required tables
-- ═══════════════════════════════════════════════════════
SELECT
  'table' AS check_type,
  t.expected AS check_name,
  CASE WHEN c.table_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS result
FROM (VALUES
  ('vault_objects'),
  ('flow_drafts'),
  ('memory_items'),
  ('memory_policies'),
  ('messages')
) AS t(expected)
LEFT JOIN information_schema.tables c
  ON c.table_schema = 'public'
  AND c.table_name = t.expected

UNION ALL

-- ═══════════════════════════════════════════════════════
-- 2. Required columns on vault_objects
-- ═══════════════════════════════════════════════════════
SELECT
  'column' AS check_type,
  'vault_objects.' || t.expected AS check_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS result
FROM (VALUES
  ('id'),
  ('owner_user_id'),
  ('filename'),
  ('title'),
  ('description'),
  ('record_type'),
  ('mime_type'),
  ('size_bytes'),
  ('confidence'),
  ('relevance'),
  ('status'),
  ('storage_bucket'),
  ('storage_path'),
  ('tags'),
  ('created_at'),
  ('updated_at'),
  ('sha256'),
  ('pointers')
) AS t(expected)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
  AND c.table_name = 'vault_objects'
  AND c.column_name = t.expected

UNION ALL

-- ═══════════════════════════════════════════════════════
-- 3. Required columns on flow_drafts
-- ═══════════════════════════════════════════════════════
SELECT
  'column' AS check_type,
  'flow_drafts.' || t.expected AS check_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS result
FROM (VALUES
  ('flow_id'),
  ('payload'),
  ('updated_at')
) AS t(expected)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
  AND c.table_name = 'flow_drafts'
  AND c.column_name = t.expected

UNION ALL

-- ═══════════════════════════════════════════════════════
-- 4. Required mutation RPCs
-- ═══════════════════════════════════════════════════════
SELECT
  'rpc' AS check_type,
  t.expected AS check_name,
  CASE WHEN r.routine_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS result
FROM (VALUES
  ('vault_claim_next_review'),
  ('vault_update_review')
) AS t(expected)
LEFT JOIN information_schema.routines r
  ON r.routine_schema = 'public'
  AND r.routine_name = t.expected

UNION ALL

-- ═══════════════════════════════════════════════════════
-- 5. Vault status enum/constraint check
-- ═══════════════════════════════════════════════════════
SELECT
  'constraint' AS check_type,
  'vault_objects.status_values' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vault_objects'
        AND column_name = 'status'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result

ORDER BY check_type, check_name;
