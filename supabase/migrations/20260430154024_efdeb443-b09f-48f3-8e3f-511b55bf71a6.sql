-- Add quote_number column to quotes (nullable so existing rows survive)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_number text;

-- Per-user, per-year counter
CREATE TABLE IF NOT EXISTS public.quote_counters (
  user_id uuid NOT NULL,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year)
);

ALTER TABLE public.quote_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own counters"
  ON public.quote_counters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own counters"
  ON public.quote_counters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own counters"
  ON public.quote_counters FOR UPDATE
  USING (auth.uid() = user_id);

-- Atomic next-number function (SECURITY DEFINER bypasses RLS for the upsert,
-- but uses the provided user id explicitly so it's safe).
CREATE OR REPLACE FUNCTION public.next_quote_number(_user_id uuid, _year int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_n int;
BEGIN
  INSERT INTO public.quote_counters (user_id, year, last_number, updated_at)
  VALUES (_user_id, _year, 1, now())
  ON CONFLICT (user_id, year)
  DO UPDATE SET last_number = quote_counters.last_number + 1,
                updated_at = now()
  RETURNING last_number INTO next_n;
  RETURN next_n;
END;
$$;