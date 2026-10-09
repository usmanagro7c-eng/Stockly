import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import "./styles.css";
import { AppGate } from "@/components/layout/AppGate";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const queryClient = new QueryClient();
const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const isMobile = useIsMobile();
  return (
    <QueryClientProvider client={queryClient}>
      <AppGate>
        <AppShell>
          <RouterProvider router={router} />
        </AppShell>
      </AppGate>
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
