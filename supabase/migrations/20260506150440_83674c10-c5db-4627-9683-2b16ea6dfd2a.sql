-- Add public sharing fields to quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_status TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_message TEXT;

CREATE INDEX IF NOT EXISTS quotes_public_token_idx ON public.quotes (public_token);

-- Allow public SELECT only when the row carries a non-null token, is in a shared state and not expired.
-- Other rows remain protected by the existing owner-only policy.
DROP POLICY IF EXISTS "Public can view shared quotes by token" ON public.quotes;
CREATE POLICY "Public can view shared quotes by token"
ON public.quotes
FOR SELECT
TO anon, authenticated
USING (
  public_token IS NOT NULL
  AND share_status IN ('shared', 'viewed', 'accepted', 'rejected')
  AND (expires_at IS NULL OR expires_at > now())
);

-- Quote views (one row per public open). Insert is open to anyone with a valid token (handled in server route).
CREATE TABLE IF NOT EXISTS public.quote_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS quote_views_quote_id_idx ON public.quote_views (quote_id);

ALTER TABLE public.quote_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view their quote views" ON public.quote_views;
CREATE POLICY "Owners can view their quote views"
ON public.quote_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_views.quote_id
      AND q.user_id = auth.uid()
  )
);
-- No public insert policy: views are inserted by the server route via the admin client.