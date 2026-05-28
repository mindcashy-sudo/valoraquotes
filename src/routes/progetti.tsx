import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/progetti")({
  head: () => ({
    meta: [
      { title: "Progetti — Valora" },
      { name: "description", content: "Gestisci progetti e computi metrici." },
    ],
  }),
  component: () => <Outlet />,
});