-- PCIV v1.3.1: Allow "unset" input/constraint values while maintaining strong invariants
-- 
-- This migration allows inputs/constraints to have value_kind set with all value_* columns NULL,
-- representing an "unset" state. When any value is present, exactly one matching column must be populated.

BEGIN;

-- ============================================================================
-- DROP EXISTING CONSTRAINTS (idempotent)
-- ============================================================================

ALTER TABLE pciv_inputs 
  DROP CONSTRAINT IF EXISTS pciv_inputs_value_columns_match_kind_check;

ALTER TABLE pciv_constraints 
  DROP CONSTRAINT IF EXISTS pciv_constraints_value_columns_match_kind_check;

ALTER TABLE pciv_runs 
  DROP CONSTRAINT IF EXISTS pciv_runs_committed_at_matches_status_check;

-- ============================================================================
-- PCIV_INPUTS: value_kind consistency check
-- ============================================================================
-- Logic:
-- 1. If ALL value_* columns are NULL → VALID (unset state)
-- 2. If ANY value_* column is NOT NULL → exactly ONE must match value_kind
-- 3. No other combinations allowed

ALTER TABLE pciv_inputs
  ADD CONSTRAINT pciv_inputs_value_columns_match_kind_check
  CHECK (
    -- Case 1: All value columns are NULL (unset) - VALID
    (
      value_string IS NULL AND 
      value_number IS NULL AND 
      value_boolean IS NULL AND 
      value_enum IS NULL AND 
      value_json IS NULL
    )
    OR
    -- Case 2: Exactly one value column matches value_kind - VALID
    (
      CASE value_kind
        WHEN 'string' THEN 
          value_string IS NOT NULL AND 
          value_number IS NULL AND 
          value_boolean IS NULL AND 
          value_enum IS NULL AND 
          value_json IS NULL
        WHEN 'number' THEN 
          value_number IS NOT NULL AND 
          value_string IS NULL AND 
          value_boolean IS NULL AND 
          value_enum IS NULL AND 
          value_json IS NULL
        WHEN 'boolean' THEN 
          value_boolean IS NOT NULL AND 
          value_string IS NULL AND 
          value_number IS NULL AND 
          value_enum IS NULL AND 
          value_json IS NULL
        WHEN 'enum' THEN 
          value_enum IS NOT NULL AND 
          value_string IS NULL AND 
          value_number IS NULL AND 
          value_boolean IS NULL AND 
          value_json IS NULL
        WHEN 'json' THEN 
          value_json IS NOT NULL AND 
          value_string IS NULL AND 
          value_number IS NULL AND 
          value_boolean IS NULL AND 
          value_enum IS NULL
        ELSE FALSE
      END
    )
  ) NOT VALID;

-- ============================================================================
-- PCIV_CONSTRAINTS: value_kind consistency check
-- ============================================================================
-- Same logic as inputs: allow unset OR exactly one matching value

ALTER TABLE pciv_constraints
  ADD CONSTRAINT pciv_constraints_value_columns_match_kind_check
  CHECK (
    -- Case 1: All value columns are NULL (unset) - VALID
    (
      value_string IS NULL AND 
      value_number IS NULL AND 
      value_boolean IS NULL AND 
      value_enum IS NULL AND 
      value_json IS NULL
    )
    OR
    -- Case 2: Exactly one value column matches value_kind - VALID
    (
      CASE value_kind
        WHEN 'string' THEN 
          value_string IS NOT NULL AND 
          value_number IS NULL AND 
          value_boolean IS NULL AND 
          value_enum IS NULL AND 
          value_json IS NULL
        WHEN 'number' THEN 
          value_number IS NOT NULL AND 
          value_string IS NULL AND 
          value_boolean IS NULL AND 
          value_enum IS NULL AND 
          value_json IS NULL
        WHEN 'boolean' THEN 
          value_boolean IS NOT NULL AND 
          value_string IS NULL AND 
          value_number IS NULL AND 
          value_enum IS NULL AND 
          value_json IS NULL
        WHEN 'enum' THEN 
          value_enum IS NOT NULL AND 
          value_string IS NULL AND 
          value_number IS NULL AND 
          value_boolean IS NULL AND 
          value_json IS NULL
        WHEN 'json' THEN 
          value_json IS NOT NULL AND 
          value_string IS NULL AND 
          value_number IS NULL AND 
          value_boolean IS NULL AND 
          value_enum IS NULL
        ELSE FALSE
      END
    )
  ) NOT VALID;

-- ============================================================================
-- PCIV_RUNS: committed_at matches status
-- ============================================================================
-- draft → committed_at IS NULL
-- committed/partial_committed → committed_at IS NOT NULL

ALTER TABLE pciv_runs
  ADD CONSTRAINT pciv_runs_committed_at_matches_status_check
  CHECK (
    (status = 'draft' AND committed_at IS NULL)
    OR
    (status IN ('committed', 'partial_committed') AND committed_at IS NOT NULL)
  ) NOT VALID;

-- ============================================================================
-- VALIDATE CONSTRAINTS (safe background validation)
-- ============================================================================

ALTER TABLE pciv_inputs
  VALIDATE CONSTRAINT pciv_inputs_value_columns_match_kind_check;

ALTER TABLE pciv_constraints
  VALIDATE CONSTRAINT pciv_constraints_value_columns_match_kind_check;

ALTER TABLE pciv_runs
  VALIDATE CONSTRAINT pciv_runs_committed_at_matches_status_check;

COMMIT;
