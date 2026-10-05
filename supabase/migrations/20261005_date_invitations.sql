-- ==============================================================================
-- Migration: Create date_invitations table with strict Pair Isolation RLS
-- Date: 2026-10-05
-- Description: Persistent, production-ready storage for couple date invitations.
-- ==============================================================================

-- 1. Create table date_invitations (minimal schema preserving existing data structure)
CREATE TABLE IF NOT EXISTS public.date_invitations (
  id TEXT PRIMARY KEY DEFAULT ('inv-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
  pair_id UUID NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL DEFAULT 'Ты',
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL DEFAULT 'Партнёр',
  idea JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  read_by_recipient BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast lookup by pair
CREATE INDEX IF NOT EXISTS idx_date_invitations_pair_id ON public.date_invitations(pair_id);
CREATE INDEX IF NOT EXISTS idx_date_invitations_created_at ON public.date_invitations(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.date_invitations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Strict Pair Isolation
-- Only users that belong to the pair via pair_members can access, insert, update or delete invitations.

-- SELECT: Users can only view date invitations belonging to their active pair
DROP POLICY IF EXISTS "Users can view date invitations of their pair" ON public.date_invitations;
CREATE POLICY "Users can view date invitations of their pair"
  ON public.date_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pair_members pm
      WHERE pm.pair_id = date_invitations.pair_id
        AND pm.user_id = auth.uid()
    )
  );

-- INSERT: Users can only create date invitations for their active pair
DROP POLICY IF EXISTS "Users can insert date invitations for their pair" ON public.date_invitations;
CREATE POLICY "Users can insert date invitations for their pair"
  ON public.date_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pair_members pm
      WHERE pm.pair_id = date_invitations.pair_id
        AND pm.user_id = auth.uid()
    )
  );

-- UPDATE: Users can only update date invitations for their active pair
DROP POLICY IF EXISTS "Users can update date invitations of their pair" ON public.date_invitations;
CREATE POLICY "Users can update date invitations of their pair"
  ON public.date_invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pair_members pm
      WHERE pm.pair_id = date_invitations.pair_id
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pair_members pm
      WHERE pm.pair_id = date_invitations.pair_id
        AND pm.user_id = auth.uid()
    )
  );

-- DELETE: Users can only delete/cancel date invitations of their active pair
DROP POLICY IF EXISTS "Users can delete date invitations of their pair" ON public.date_invitations;
CREATE POLICY "Users can delete date invitations of their pair"
  ON public.date_invitations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pair_members pm
      WHERE pm.pair_id = date_invitations.pair_id
        AND pm.user_id = auth.uid()
    )
  );

-- 5. Add to realtime publication for instant live synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE public.date_invitations;

-- 6. Migrate existing date invitations from moments (moment_date = '1970-01-01') safely
DO $$
DECLARE
  r RECORD;
  inv_json JSONB;
BEGIN
  FOR r IN
    SELECT id, pair_id, prompt, created_at
    FROM public.moments
    WHERE moment_date = '1970-01-01' AND prompt LIKE 'DATE_INVITATION:%'
  LOOP
    BEGIN
      inv_json := SUBSTRING(r.prompt FROM 17)::JSONB;
      INSERT INTO public.date_invitations (
        id,
        pair_id,
        creator_user_id,
        sender_name,
        recipient_user_id,
        recipient_name,
        idea,
        status,
        read_by_recipient,
        created_at
      ) VALUES (
        COALESCE(inv_json->>'id', 'inv-' || r.id::TEXT),
        r.pair_id,
        NULLIF(inv_json->>'senderUserId', '')::UUID,
        COALESCE(inv_json->>'senderName', 'Ты'),
        NULLIF(inv_json->>'recipientUserId', '')::UUID,
        COALESCE(inv_json->>'recipientName', 'Партнёр'),
        COALESCE(inv_json->'idea', '{}'::JSONB),
        COALESCE(inv_json->>'status', 'pending'),
        COALESCE((inv_json->>'readByRecipient')::BOOLEAN, false),
        COALESCE(NULLIF(inv_json->>'createdAt', '')::TIMESTAMPTZ, r.created_at)
      ) ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Continue on any individual row parse anomaly
      NULL;
    END;
  END LOOP;
END $$;
