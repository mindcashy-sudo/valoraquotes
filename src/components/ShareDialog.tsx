import { useEffect, useState } from "react";
import { Copy, Check, Loader2, Share2, Eye, CheckCircle2, XCircle, ExternalLink, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { shareQuote, unshareQuote, getQuoteShareInfo } from "@/lib/server-fns/share.functions";

interface ShareInfo {
  public_token: string | null;
  share_status: string;
  shared_at: string | null;
  expires_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  accepted_at: string | null;
  rejected_at: string | null;
  client_message: string | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "shared":
      return { label: "Inviato", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
    case "viewed":
      return { label: "Visualizzato", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    case "accepted":
      return { label: "Accettato", className: "bg-valora-green/15 text-valora-green" };
    case "rejected":
      return { label: "Rifiutato", className: "bg-red-500/10 text-red-600 dark:text-red-400" };
    default:
      return null;
  }
}

interface Props {
  quoteId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

export function ShareDialog({ quoteId, open, onOpenChange, onChanged }: Props) {
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getQuoteShareInfo({ data: { id: quoteId } })
      .then((r) => setInfo(r.share as ShareInfo | null))
      .finally(() => setLoading(false));
  }, [open, quoteId]);

  const url =
    info?.public_token && typeof window !== "undefined"
      ? `${window.location.origin}/p/${info.public_token}`
      : null;

  const handleShare = async () => {
    setBusy(true);
    try {
      const res = await shareQuote({ data: { id: quoteId, expiresInDays: 30 } });
      if (res.error) {
        toast.error(res.error);
      } else {
        const fresh = await getQuoteShareInfo({ data: { id: quoteId } });
        setInfo(fresh.share as ShareInfo | null);
        toast.success("Link generato");
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUnshare = async () => {
    setBusy(true);
    try {
      const res = await unshareQuote({ data: { id: quoteId } });
      if (res.error) {
        toast.error(res.error);
      } else {
        setInfo(null);
        toast.success("Link revocato");
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiato");
    setTimeout(() => setCopied(false), 2000);
  };

  const badge = info ? statusBadge(info.share_status) : null;
  const isShared =
    info?.public_token &&
    info.share_status !== "private" &&
    (!info.expires_at || new Date(info.expires_at).getTime() > Date.now());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Condividi col cliente
          </DialogTitle>
          <DialogDescription>
            Genera un link pubblico brandizzato. Il cliente potrà vedere il preventivo,
            accettarlo o rifiutarlo. Ricevi notifica delle aperture.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !isShared ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              Questo preventivo non è ancora condiviso. Genera un link valido 30 giorni.
            </div>
            <Button onClick={handleShare} disabled={busy} className="w-full h-11">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
              Genera link condivisione
            </Button>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Link pubblico
              </label>
              <div className="flex gap-2">
                <Input value={url ?? ""} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" asChild className="shrink-0">
                  <a href={url ?? "#"} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="w-3.5 h-3.5" />
                  Aperture
                </div>
                <p className="text-2xl font-bold tabular-nums">{info?.view_count ?? 0}</p>
                {info?.last_viewed_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Ultima: {new Date(info.last_viewed_at).toLocaleString("it-IT")}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Stato
                </div>
                {badge ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                ) : null}
                {info?.expires_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Scade: {new Date(info.expires_at).toLocaleDateString("it-IT")}
                  </p>
                )}
              </div>
            </div>

            {info?.share_status === "accepted" && (
              <div className="rounded-xl bg-valora-green/10 border border-valora-green/30 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-valora-green shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Preventivo accettato</p>
                  {info.accepted_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(info.accepted_at).toLocaleString("it-IT")}
                    </p>
                  )}
                  {info.client_message && (
                    <p className="text-xs mt-2 italic">"{info.client_message}"</p>
                  )}
                </div>
              </div>
            )}

            {info?.share_status === "rejected" && (
              <div className="rounded-xl bg-muted/60 border border-border p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Modifiche richieste</p>
                  {info.client_message && (
                    <p className="text-xs mt-2 italic">"{info.client_message}"</p>
                  )}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleUnshare}
              disabled={busy}
              className="w-full text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Revoca link
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
