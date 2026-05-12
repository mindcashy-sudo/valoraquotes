
CREATE OR REPLACE FUNCTION public.increment_free_quotes_used(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_val integer;
  caller uuid;
BEGIN
  caller := auth.uid();
  -- Allow service_role (no auth.uid()) to bypass for server-side calls.
  IF caller IS NOT NULL AND caller <> _user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles
     SET free_quotes_used = free_quotes_used + 1,
         updated_at = now()
   WHERE id = _user_id
   RETURNING free_quotes_used INTO new_val;
  RETURN COALESCE(new_val, 0);
END;
$$;
