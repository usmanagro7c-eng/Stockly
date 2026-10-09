import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import appCss from "./styles.css?url";
import { AppGate } from "@/components/layout/AppGate";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <title>Stockly — Inventory & Profit Manager</title>
        <meta
          name="description"
          content="Stockly is an offline-first inventory, sales and profit manager for small retail shops."
        />
        <meta name="theme-color" content="#1a1f26" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Stockly" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta property="og:title" content="Stockly — Inventory & Profit Manager" />
        <meta
          property="og:description"
          content="Track purchases, sales, stock and profit — fully offline."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="stylesheet" href={appCss} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icons/icon-512.png" type="image/png" sizes="512x512" />
      </head>
      <body>{children}</body>
    </html>
  );
}

const queryClient = new QueryClient();
const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

function App() {
  const isMobile = useIsMobile();
  return (
    <QueryClientProvider client={queryClient}>
      <RootShell>
        <AppGate>
          <AppShell>
            <RouterProvider router={router} />
          </AppShell>
        </AppGate>
      </RootShell>
      <Toaster position={isMobile ? "bottom-center" : "top-right"} duration={3000} closeButton />
    </QueryClientProvider>
  );
}

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
