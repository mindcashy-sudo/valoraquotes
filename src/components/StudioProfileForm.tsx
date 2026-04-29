import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertStudioProfile,
  createLogoUploadUrl,
  getLogoSignedUrl,
} from "@/server/studio.functions";

export interface StudioProfile {
  id?: string;
  studio_name?: string | null;
  architect_name?: string | null;
  vat_number?: string | null;
  fiscal_code?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  province?: string | null;
  phone?: string | null;
  email?: string | null;
  pec?: string | null;
  iban?: string | null;
  albo_number?: string | null;
  logo_url?: string | null;
  default_work_zone?: string | null;
  default_vat_percent?: number;
  default_validity_days?: number;
  default_terms?: string | null;
  onboarding_completed?: boolean;
}

interface Props {
  initial: StudioProfile | null;
  mode?: "full" | "onboarding-step-1" | "onboarding-step-2";
  onSaved: (p: StudioProfile) => void;
  saveLabel?: string;
  showLogo?: boolean;
  showDefaults?: boolean;
  showFiscal?: boolean;
}

const FIELD_LABEL = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";

export function StudioProfileForm({
  initial,
  onSaved,
  saveLabel = "Salva",
  showLogo = true,
  showDefaults = true,
  showFiscal = true,
}: Props) {
  const [draft, setDraft] = useState<StudioProfile>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(initial ?? {});
  }, [initial]);

  // Resolve signed URL for current logo
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!draft.logo_url) {
        setLogoPreview(null);
        return;
      }
      const res = await getLogoSignedUrl({ data: { path: draft.logo_url } });
      if (!cancelled && res.url) setLogoPreview(res.url);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [draft.logo_url]);

  const update = <K extends keyof StudioProfile>(k: K, v: StudioProfile[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("Logo troppo grande (max 2MB)");
      return;
    }
    const ext = file.name.split(".").pop() ?? "png";
    setUploadingLogo(true);
    try {
      const signed = await createLogoUploadUrl({ data: { ext } });
      if (signed.error || !signed.path || !signed.token) {
        alert(signed.error ?? "Errore upload");
        return;
      }
      const { error: upErr } = await supabase.storage
        .from("studio-assets")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type,
          upsert: true,
        });
      if (upErr) {
        alert(upErr.message);
        return;
      }
      update("logo_url", signed.path);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...draft, onboarding_completed: true };
      const res = await upsertStudioProfile({ data: payload });
      if (res.error || !res.profile) {
        alert(res.error ?? "Errore salvataggio");
        return;
      }
      onSaved(res.profile as StudioProfile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {showLogo && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold">Logo studio</h3>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Nessun logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {draft.logo_url ? "Sostituisci logo" : "Carica logo"}
              </Button>
              {draft.logo_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update("logo_url", null)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Rimuovi
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPG, SVG · max 2MB</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold">Dati studio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Nome studio *</label>
            <Input
              value={draft.studio_name ?? ""}
              onChange={(e) => update("studio_name", e.target.value)}
              placeholder="Studio Rossi Architettura"
            />
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Nome e cognome architetto *</label>
            <Input
              value={draft.architect_name ?? ""}
              onChange={(e) => update("architect_name", e.target.value)}
              placeholder="Arch. Mario Rossi"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className={FIELD_LABEL}>Indirizzo</label>
            <Input
              value={draft.address ?? ""}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Via Roma 12"
            />
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Città</label>
            <Input
              value={draft.city ?? ""}
              onChange={(e) => update("city", e.target.value)}
              placeholder="Milano"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>CAP</label>
              <Input
                value={draft.postal_code ?? ""}
                onChange={(e) => update("postal_code", e.target.value)}
                placeholder="20121"
              />
            </div>
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>Provincia</label>
              <Input
                value={draft.province ?? ""}
                onChange={(e) => update("province", e.target.value)}
                placeholder="MI"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Telefono</label>
            <Input
              value={draft.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Email contatto</label>
            <Input
              type="email"
              value={draft.email ?? ""}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>PEC</label>
            <Input
              type="email"
              value={draft.pec ?? ""}
              onChange={(e) => update("pec", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>N° iscrizione albo</label>
            <Input
              value={draft.albo_number ?? ""}
              onChange={(e) => update("albo_number", e.target.value)}
            />
          </div>
        </div>
      </div>

      {showFiscal && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold">Dati fiscali</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>Partita IVA</label>
              <Input
                value={draft.vat_number ?? ""}
                onChange={(e) => update("vat_number", e.target.value)}
                placeholder="IT12345678901"
              />
            </div>
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>Codice fiscale</label>
              <Input
                value={draft.fiscal_code ?? ""}
                onChange={(e) => update("fiscal_code", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={FIELD_LABEL}>IBAN</label>
              <Input
                value={draft.iban ?? ""}
                onChange={(e) => update("iban", e.target.value)}
                placeholder="IT60X0542811101000000123456"
              />
            </div>
          </div>
        </div>
      )}

      {showDefaults && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold">Default preventivi</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-3">
              <label className={FIELD_LABEL}>Zona di lavoro principale</label>
              <Input
                value={draft.default_work_zone ?? ""}
                onChange={(e) => update("default_work_zone", e.target.value)}
                placeholder="Milano e provincia"
              />
              <p className="text-xs text-muted-foreground">
                Influenza i benchmark di prezzo nei preventivi generati.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>IVA % default</label>
              <Input
                type="number"
                value={draft.default_vat_percent ?? 22}
                onChange={(e) =>
                  update("default_vat_percent", Number(e.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>Validità offerta (giorni)</label>
              <Input
                type="number"
                value={draft.default_validity_days ?? 30}
                onChange={(e) =>
                  update("default_validity_days", Number(e.target.value) || 30)
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Condizioni standard</label>
            <Textarea
              value={draft.default_terms ?? ""}
              onChange={(e) => update("default_terms", e.target.value)}
              placeholder="Es: Pagamento 30% all'accettazione, 40% a metà lavori, 30% al saldo. Tempi indicativi salvo imprevisti…"
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Saranno incluse automaticamente nei PDF dei preventivi.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="h-11 px-8 rounded-xl">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
