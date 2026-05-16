import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina non trovata</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La pagina che cerchi non esiste o è stata spostata.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}

const SITE_URL = "https://usevalora.it";
const OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/741111fe-de2c-4e78-b37a-31957cbfef49/id-preview-7cab813b--f6ed1a4d-e0ec-40ef-bd1b-7461750b46b9.lovable.app-1776869367238.png";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Valora — Preventivi professionali per architetti" },
      { name: "description", content: "Da memo vocale a preventivo strutturato e brandizzato in pochi minuti. Workflow completo per studi di architettura: PDF, link cliente, tracking accettazione." },
      { name: "author", content: "Valora" },
      { name: "robots", content: "index, follow" },
      { property: "og:site_name", content: "Valora" },
      { property: "og:title", content: "Valora — Preventivi professionali per architetti" },
      { property: "og:description", content: "Da memo vocale a preventivo strutturato e brandizzato in pochi minuti. Tracking accettazione, PDF, archivio clienti." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:locale", content: "it_IT" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Valora — Preventivi professionali per architetti" },
      { name: "twitter:description", content: "Da memo vocale a preventivo strutturato e brandizzato in pochi minuti." },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.removeItem("valora_theme");
    } catch {
      // ignore
    }
  }
  return (
    <AuthProvider>
      <Outlet />
      <Toaster position="top-center" richColors closeButton />
    </AuthProvider>
  );
}
