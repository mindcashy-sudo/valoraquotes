
REVOKE EXECUTE ON FUNCTION public.increment_free_quotes_used(uuid) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.increment_free_quotes_used(uuid) TO service_role;
