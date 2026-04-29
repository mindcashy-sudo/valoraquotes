-- studio_profiles table
CREATE TABLE public.studio_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  studio_name TEXT,
  architect_name TEXT,
  vat_number TEXT,
  fiscal_code TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  province TEXT,
  phone TEXT,
  email TEXT,
  pec TEXT,
  iban TEXT,
  albo_number TEXT,
  logo_url TEXT,
  default_work_zone TEXT,
  default_vat_percent NUMERIC NOT NULL DEFAULT 22,
  default_validity_days INTEGER NOT NULL DEFAULT 30,
  default_terms TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own studio profile"
  ON public.studio_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own studio profile"
  ON public.studio_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own studio profile"
  ON public.studio_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own studio profile"
  ON public.studio_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_studio_profiles_updated_at
  BEFORE UPDATE ON public.studio_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for studio assets (logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-assets', 'studio-assets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own studio assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'studio-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own studio assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'studio-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own studio assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'studio-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own studio assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'studio-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );