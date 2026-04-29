import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Valora Quotes" },
      { name: "description", content: "Quick Quote AI generates professional quotes from voice input, offering a fast and cost-effective solution." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Valora Quotes" },
      { property: "og:description", content: "Quick Quote AI generates professional quotes from voice input, offering a fast and cost-effective solution." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Valora Quotes" },
      { name: "twitter:description", content: "Quick Quote AI generates professional quotes from voice input, offering a fast and cost-effective solution." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/741111fe-de2c-4e78-b37a-31957cbfef49/id-preview-7cab813b--f6ed1a4d-e0ec-40ef-bd1b-7461750b46b9.lovable.app-1776869367238.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/741111fe-de2c-4e78-b37a-31957cbfef49/id-preview-7cab813b--f6ed1a4d-e0ec-40ef-bd1b-7461750b46b9.lovable.app-1776869367238.png" },
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
    <html lang="en">
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
    </AuthProvider>
  );
}
