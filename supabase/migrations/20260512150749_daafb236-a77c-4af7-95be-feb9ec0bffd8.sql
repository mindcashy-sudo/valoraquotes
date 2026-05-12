
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS free_quotes_used integer NOT NULL DEFAULT 0;

-- Atomic increment, returns new value. SECURITY DEFINER so we can call it
-- from the (anon-key) authenticated client without an extra RLS write policy.
CREATE OR REPLACE FUNCTION public.increment_free_quotes_used(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_val integer;
BEGIN
  UPDATE public.profiles
     SET free_quotes_used = free_quotes_used + 1,
         updated_at = now()
   WHERE id = _user_id
   RETURNING free_quotes_used INTO new_val;
  RETURN COALESCE(new_val, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_free_quotes_used(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_free_quotes_used(uuid) TO authenticated, service_role;
