-- PCIV v1.1 DB invariants migration
-- Adds constraints to ensure value_kind correctness and commit state consistency

DO $$ 
BEGIN
  -- 1) pciv_inputs: value_kind correctness checks
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pciv_inputs_value_columns_match_kind_check'
  ) THEN
    ALTER TABLE public.pciv_inputs
    ADD CONSTRAINT pciv_inputs_value_columns_match_kind_check
    CHECK (
      (value_kind = 'string' AND value_string IS NOT NULL AND value_number IS NULL AND value_boolean IS NULL AND value_enum IS NULL AND value_json IS NULL)
      OR
      (value_kind = 'number' AND value_number IS NOT NULL AND value_string IS NULL AND value_boolean IS NULL AND value_enum IS NULL AND value_json IS NULL)
      OR
      (value_kind = 'boolean' AND value_boolean IS NOT NULL AND value_string IS NULL AND value_number IS NULL AND value_enum IS NULL AND value_json IS NULL)
      OR
      (value_kind = 'enum' AND value_enum IS NOT NULL AND value_string IS NULL AND value_number IS NULL AND value_boolean IS NULL AND value_json IS NULL)
      OR
      (value_kind = 'json' AND value_json IS NOT NULL AND value_string IS NULL AND value_number IS NULL AND value_boolean IS NULL AND value_enum IS NULL)
    ) NOT VALID;
    
    -- Validate constraint against existing data
    ALTER TABLE public.pciv_inputs VALIDATE CONSTRAINT pciv_inputs_value_columns_match_kind_check;
  END IF;

  -- 2) pciv_constraints: value_kind correctness checks
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pciv_constraints_value_columns_match_kind_check'
  ) THEN
    ALTER TABLE public.pciv_constraints
    ADD CONSTRAINT pciv_constraints_value_columns_match_kind_check
    CHECK (
      (value_kind = 'string' AND value_string IS NOT NULL AND value_number IS NULL AND value_boolean IS NULL AND value_enum IS NULL AND value_json IS NULL)
      OR
      (value_kind = 'number' AND value_number IS NOT NULL AND value_string IS NULL AND value_boolean IS NULL AND value_enum IS NULL AND value_json IS NULL)
      OR
      (value_kind = 'boolean' AND value_boolean IS NOT NULL AND value_string IS NULL AND value_number IS NULL AND value_enum IS NULL AND value_json IS NULL)
      OR
      (value_kind = 'enum' AND value_enum IS NOT NULL AND value_string IS NULL AND value_number IS NULL AND value_boolean IS NULL AND value_json IS NULL)
      OR
      (value_kind = 'json' AND value_json IS NOT NULL AND value_string IS NULL AND value_number IS NULL AND value_boolean IS NULL AND value_enum IS NULL)
    ) NOT VALID;
    
    -- Validate constraint against existing data
    ALTER TABLE public.pciv_constraints VALIDATE CONSTRAINT pciv_constraints_value_columns_match_kind_check;
  END IF;

  -- 3) pciv_runs: committed_at matches status
  -- First, fix any existing data that violates the constraint
  UPDATE public.pciv_runs
  SET committed_at = updated_at
  WHERE status IN ('committed', 'partial_committed') AND committed_at IS NULL;
  
  UPDATE public.pciv_runs
  SET committed_at = NULL
  WHERE status = 'draft' AND committed_at IS NOT NULL;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pciv_runs_committed_at_matches_status_check'
  ) THEN
    ALTER TABLE public.pciv_runs
    ADD CONSTRAINT pciv_runs_committed_at_matches_status_check
    CHECK (
      (status IN ('committed', 'partial_committed') AND committed_at IS NOT NULL)
      OR
      (status = 'draft' AND committed_at IS NULL)
    ) NOT VALID;
    
    -- Validate constraint against existing data
    ALTER TABLE public.pciv_runs VALIDATE CONSTRAINT pciv_runs_committed_at_matches_status_check;
  END IF;

EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, do nothing
    NULL;
END $$;

-- Ensure pciv_introspect function includes constraint metadata
-- The function should already return constraints from pg_catalog
-- Verify access grants
DO $$
BEGIN
  -- Grant execute on pciv_introspect to anon and authenticated roles
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pciv_introspect') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.pciv_introspect() TO anon, authenticated';
  END IF;
END $$;
