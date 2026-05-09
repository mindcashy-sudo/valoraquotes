CREATE TABLE public.studio_price_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'cad',
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_studio_price_list_user ON public.studio_price_list(user_id);
CREATE INDEX idx_studio_price_list_category ON public.studio_price_list(user_id, category);

ALTER TABLE public.studio_price_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own price list" ON public.studio_price_list
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own price list" ON public.studio_price_list
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own price list" ON public.studio_price_list
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own price list" ON public.studio_price_list
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_studio_price_list_updated
  BEFORE UPDATE ON public.studio_price_list
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();