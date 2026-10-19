-- ============================================================================
-- OURS Migration: Explicit Daily Moment Slot & Unique Constraint
-- File: supabase/migrations/20261019_moments_slot_unique.sql
--
-- Purpose:
-- 1. Adds nullable `slot SMALLINT NULL` column to `public.moments` to
--    unambiguously identify the 3 daily moments (slot = 1, 2, 3) while keeping
--    legacy rows and date moments (`slot IS NULL`) untouched.
-- 2. Adds a CHECK constraint restricting `slot` to NULL or 1, 2, 3.
-- 3. Creates a full unique index on `(pair_id, moment_date, slot)` compatible
--    with PostgREST `onConflict: 'pair_id,moment_date,slot'`.
--    In PostgreSQL, standard unique indexes treat NULL values as distinct, so
--    existing historical rows with `slot IS NULL` do not conflict.
--
-- Safety:
-- - Does NOT execute DELETE or mass UPDATE on existing records.
-- - Does NOT modify RLS policies.
-- ============================================================================

BEGIN;

-- 1. Add nullable slot column for daily moments (1, 2, 3)
ALTER TABLE public.moments
  ADD COLUMN IF NOT EXISTS slot SMALLINT NULL;

-- 2. Enforce valid slot values: NULL (legacy / date moments) or 1, 2, 3
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'moments_slot_check'
      AND conrelid = 'public.moments'::regclass
  ) THEN
    ALTER TABLE public.moments
      ADD CONSTRAINT moments_slot_check
      CHECK (slot IS NULL OR slot IN (1, 2, 3));
  END IF;
END
$$;

-- 3. Create full unique index on (pair_id, moment_date, slot)
-- Compatible with PostgREST upsert(..., { onConflict: 'pair_id,moment_date,slot' })
CREATE UNIQUE INDEX IF NOT EXISTS idx_moments_pair_date_slot_unique
  ON public.moments (pair_id, moment_date, slot);

COMMIT;
