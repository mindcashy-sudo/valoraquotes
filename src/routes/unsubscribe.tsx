import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<"checking" | "valid" | "already" | "invalid" | "done" | "error">("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) return setState("invalid");
        if (json.valid) return setState("valid");
        if (json.reason === "already_unsubscribed") return setState("already");
        setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await r.json().catch(() => ({}));
      if (json.success) setState("done");
      else if (json.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Disiscrizione email</h1>
        {state === "checking" && <p className="text-muted-foreground">Verifica in corso…</p>}
        {state === "valid" && (
          <>
            <p className="text-muted-foreground">Conferma per non ricevere più email da Valora.</p>
            <Button onClick={confirm} disabled={busy}>
              {busy ? "Attendere…" : "Conferma disiscrizione"}
            </Button>
          </>
        )}
        {state === "already" && <p className="text-muted-foreground">Sei già disiscritto. Non riceverai più email.</p>}
        {state === "done" && <p className="text-muted-foreground">Disiscrizione completata. Non riceverai più email.</p>}
        {state === "invalid" && <p className="text-destructive">Link non valido o scaduto.</p>}
        {state === "error" && <p className="text-destructive">Errore. Riprova più tardi.</p>}
      </div>
    </div>
  );
}
