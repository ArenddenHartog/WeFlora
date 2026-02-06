-- Vault status enum + CHECK constraint (schema drift fix)
--
-- Canonical status taxonomy:
-- draft, pending, needs_review, in_review, accepted, blocked
--
-- This prevents invalid status values from entering the DB.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vault_status') THEN
    CREATE TYPE vault_status AS ENUM (
      'draft',
      'pending',
      'needs_review',
      'in_review',
      'accepted',
      'blocked'
    );
  END IF;
END $$;

-- Add status column to vault_objects if not exists
-- Uses text for backward compat, CHECK constraint enforces valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_objects' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.vault_objects
      ADD COLUMN status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

-- Add CHECK constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'vault_objects_status_check'
  ) THEN
    ALTER TABLE public.vault_objects
      ADD CONSTRAINT vault_objects_status_check
      CHECK (status IN ('draft', 'pending', 'needs_review', 'in_review', 'accepted', 'blocked'));
  END IF;
END $$;

COMMENT ON COLUMN public.vault_objects.status IS
  'Canonical status from the WeFlora status taxonomy. Values: draft, pending, needs_review, in_review, accepted, blocked.';
