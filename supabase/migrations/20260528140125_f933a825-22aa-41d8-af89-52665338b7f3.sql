-- ============================================================
-- PRICE LISTS
-- ============================================================
CREATE TABLE public.price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NULL,
  nome text NOT NULL,
  regione text NULL,
  anno integer NULL,
  source text NOT NULL DEFAULT 'manual',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.price_lists TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.price_lists TO authenticated;
GRANT ALL ON public.price_lists TO service_role;

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public lists visible to all authenticated"
  ON public.price_lists FOR SELECT TO authenticated
  USING (is_public = true OR owner_id = auth.uid());

CREATE POLICY "Owner inserts own price list"
  ON public.price_lists FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND is_public = false);

CREATE POLICY "Owner updates own price list"
  ON public.price_lists FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND is_public = false);

CREATE POLICY "Owner deletes own price list"
  ON public.price_lists FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER trg_price_lists_updated
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PRICE LIST ITEMS
-- ============================================================
CREATE TABLE public.price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id uuid NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  codice text NULL,
  descrizione text NOT NULL,
  unita_misura text NOT NULL DEFAULT 'cad',
  prezzo numeric(12,4) NOT NULL DEFAULT 0,
  incidenza_manodopera numeric(5,2) NOT NULL DEFAULT 0,
  categoria text NULL,
  sottocategoria text NULL,
  search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('italian', coalesce(codice, '')), 'A') ||
    setweight(to_tsvector('italian', coalesce(descrizione, '')), 'B') ||
    setweight(to_tsvector('italian', coalesce(categoria, '')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pli_search ON public.price_list_items USING GIN (search_tsv);
CREATE INDEX idx_pli_codice ON public.price_list_items (codice text_pattern_ops);
CREATE INDEX idx_pli_list ON public.price_list_items (price_list_id);

GRANT SELECT ON public.price_list_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.price_list_items TO authenticated;
GRANT ALL ON public.price_list_items TO service_role;

ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items visible via parent list"
  ON public.price_list_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.price_lists pl
    WHERE pl.id = price_list_items.price_list_id
      AND (pl.is_public = true OR pl.owner_id = auth.uid())
  ));

CREATE POLICY "Owner inserts items in own list"
  ON public.price_list_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.price_lists pl
    WHERE pl.id = price_list_items.price_list_id AND pl.owner_id = auth.uid()
  ));

CREATE POLICY "Owner updates items in own list"
  ON public.price_list_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.price_lists pl
    WHERE pl.id = price_list_items.price_list_id AND pl.owner_id = auth.uid()
  ));

CREATE POLICY "Owner deletes items in own list"
  ON public.price_list_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.price_lists pl
    WHERE pl.id = price_list_items.price_list_id AND pl.owner_id = auth.uid()
  ));

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NULL,
  nome text NOT NULL,
  indirizzo_cantiere text NULL,
  committente text NULL,
  stato text NOT NULL DEFAULT 'bozza',
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user ON public.projects (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- COMPUTI (base + varianti)
-- ============================================================
CREATE TABLE public.computi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_computo_id uuid NULL REFERENCES public.computi(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'base',
  versione integer NOT NULL DEFAULT 0,
  nome text NOT NULL,
  motivazione text NULL,
  stato text NOT NULL DEFAULT 'bozza',
  totale_imponibile numeric(14,2) NOT NULL DEFAULT 0,
  totale_manodopera numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz NULL,
  CONSTRAINT chk_tipo CHECK (tipo IN ('base','variante')),
  CONSTRAINT chk_stato CHECK (stato IN ('bozza','approvato','firmato'))
);

CREATE INDEX idx_computi_user ON public.computi (user_id);
CREATE INDEX idx_computi_project ON public.computi (project_id);
CREATE INDEX idx_computi_parent ON public.computi (parent_computo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.computi TO authenticated;
GRANT ALL ON public.computi TO service_role;

ALTER TABLE public.computi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own computi" ON public.computi FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own computi" ON public.computi FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own computi" ON public.computi FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own computi" ON public.computi FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_computi_updated
  BEFORE UPDATE ON public.computi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- COMPUTO_VOCI (snapshot delle voci nel computo)
-- ============================================================
CREATE TABLE public.computo_voci (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  computo_id uuid NOT NULL REFERENCES public.computi(id) ON DELETE CASCADE,
  ordine integer NOT NULL DEFAULT 0,
  capitolo text NULL,
  -- SNAPSHOT VOCE PREZZIARIO
  source_price_item_id uuid NULL,
  codice text NULL,
  descrizione text NOT NULL,
  unita_misura text NOT NULL DEFAULT 'cad',
  prezzo_unitario numeric(12,4) NOT NULL DEFAULT 0,
  incidenza_manodopera numeric(5,2) NOT NULL DEFAULT 0,
  -- MISURAZIONE
  quantita numeric(14,4) NOT NULL DEFAULT 0,
  formula_misura text NULL,
  -- DERIVATO
  importo numeric(14,2) GENERATED ALWAYS AS (ROUND(quantita * prezzo_unitario, 2)) STORED,
  -- VISTA CLIENTE
  descrizione_cliente text NULL,
  macro_categoria_cliente text NULL,
  visibile_cliente boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voci_computo ON public.computo_voci (computo_id, ordine);
CREATE INDEX idx_voci_user ON public.computo_voci (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.computo_voci TO authenticated;
GRANT ALL ON public.computo_voci TO service_role;

ALTER TABLE public.computo_voci ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own voci" ON public.computo_voci FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own voci" ON public.computo_voci FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own voci" ON public.computo_voci FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own voci" ON public.computo_voci FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_voci_updated
  BEFORE UPDATE ON public.computo_voci
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RICALCOLO TOTALI COMPUTO (trigger su voci)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_computo_totali()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.computo_id, OLD.computo_id);
  UPDATE public.computi c
  SET totale_imponibile = COALESCE((
        SELECT SUM(importo) FROM public.computo_voci WHERE computo_id = target_id
      ), 0),
      totale_manodopera = COALESCE((
        SELECT SUM(importo * incidenza_manodopera / 100.0)
        FROM public.computo_voci WHERE computo_id = target_id
      ), 0),
      updated_at = now()
  WHERE c.id = target_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recalc_after_voci
  AFTER INSERT OR UPDATE OR DELETE ON public.computo_voci
  FOR EACH ROW EXECUTE FUNCTION public.recalc_computo_totali();

-- ============================================================
-- SEED PREZZIARIO DEMO PUBBLICO (~200 voci sintetiche)
-- ============================================================
DO $$
DECLARE
  pl_id uuid;
  cats text[][] := ARRAY[
    ['A','Scavi e movimento terra','mc'],
    ['B','Calcestruzzi','mc'],
    ['C','Acciaio e ferri di armatura','kg'],
    ['D','Murature','mq'],
    ['E','Intonaci','mq'],
    ['F','Pavimenti','mq'],
    ['G','Rivestimenti','mq'],
    ['H','Serramenti','cad'],
    ['I','Impianto idrico','cad'],
    ['L','Impianto elettrico','cad'],
    ['M','Tinteggiature','mq'],
    ['N','Coperture','mq'],
    ['O','Isolamenti termici','mq'],
    ['P','Demolizioni','mc'],
    ['Q','Opere esterne','mq'],
    ['R','Sicurezza cantiere','cad'],
    ['S','Manodopera','h'],
    ['T','Noli','h']
  ];
  descrizioni text[] := ARRAY[
    'fornitura e posa in opera','solo fornitura','solo posa in opera',
    'di tipo standard','di tipo pesante','di tipo leggero',
    'per uso interno','per uso esterno','per ambienti umidi',
    'di prima qualità','di seconda qualità','classe A',
    'spessore 2 cm','spessore 5 cm','spessore 10 cm'
  ];
  i int;
  j int;
  cat text[];
  codice text;
  prezzo numeric;
  inc numeric;
BEGIN
  INSERT INTO public.price_lists (owner_id, nome, regione, anno, source, is_public)
  VALUES (NULL, 'Prezziario Edile Demo 2026', 'Nazionale', 2026, 'official', true)
  RETURNING id INTO pl_id;

  FOR i IN 1..array_length(cats, 1) LOOP
    cat := cats[i:i][1:3];
    FOR j IN 1..12 LOOP
      codice := cats[i][1] || '.' || lpad(j::text, 3, '0');
      prezzo := round((10 + random() * 290)::numeric, 2);
      inc := round((10 + random() * 50)::numeric, 2);
      INSERT INTO public.price_list_items (
        price_list_id, codice, descrizione, unita_misura, prezzo,
        incidenza_manodopera, categoria, sottocategoria
      ) VALUES (
        pl_id,
        codice,
        cats[i][2] || ' - voce ' || j || ', ' || descrizioni[1 + (j % array_length(descrizioni,1))],
        cats[i][3],
        prezzo,
        inc,
        cats[i][2],
        'Tipologia ' || ((j % 3) + 1)
      );
    END LOOP;
  END LOOP;
END $$;