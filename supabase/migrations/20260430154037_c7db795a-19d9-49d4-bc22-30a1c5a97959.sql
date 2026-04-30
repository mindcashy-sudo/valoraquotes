REVOKE EXECUTE ON FUNCTION public.next_quote_number(uuid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_quote_number(uuid, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_quote_number(uuid, int) FROM authenticated;