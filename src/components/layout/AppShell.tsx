import { Link, useRouterState } from "@tanstack/react-router";
import { CloudOff, Eye, MoreHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { moreNav, primaryNav } from "./nav-items";
import { useStockStore } from "@/store/stockStore";
import { useAutoSync } from "@/hooks/use-auto-sync";

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2 4 7v10l8 5 8-5V7l-8-5Zm0 2.3L18 8v1.1l-6 3.4-6-3.4V8l6-3.7Z"
          />
          <path fill="currentColor" d="m6 11.2 5 2.8v5.3l-5-3.1v-5Zm12 0v5l-5 3.1V14l5-2.8Z" />
        </svg>
      </span>
      {!compact && <span className="text-lg font-semibold tracking-tight">Stockly</span>}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settings = useStockStore((s) => s.settings);
  const sheetRole = useStockStore((s) => s.sheetRole);
  const isMoreRoute = moreNav.some((i) => pathname.startsWith(i.to));

  useAutoSync();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const showBanners = !online || sheetRole === "read";

  const activeCls = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background">
      {showBanners ? (
        <div className="sticky top-0 z-40 space-y-1 px-3 pt-2 lg:pl-64">
          {!online ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-xs font-medium text-muted-foreground">
              <CloudOff className="size-4 shrink-0 text-primary" aria-hidden />
              You're offline — changes are saved on this device and will sync when you reconnect.
            </div>
          ) : null}
          {sheetRole === "read" ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-xs font-medium text-muted-foreground">
              <Eye className="size-4 shrink-0 text-primary" aria-hidden />
              Read-only access to this Google Sheet — new entries are not saved to the sheet.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Brand />
        <nav className="mt-7 flex flex-1 flex-col gap-1" aria-label="Main">
          {primaryNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                activeCls(item.to)
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4.5" aria-hidden />
              {item.label}
            </Link>
          ))}
          <p className="label-xs mt-5 px-3">More</p>
          {moreNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                activeCls(item.to)
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4.5" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
          <p className="truncate text-sm font-medium">{settings.user_name || "Shopkeeper"}</p>
          <p className="num truncate text-xs text-muted-foreground">{settings.device_id}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="pad-safe-top sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <div className="text-right">
            <p className="truncate text-xs font-medium">{settings.user_name || "Shopkeeper"}</p>
            <p className="num truncate text-[11px] text-muted-foreground">{settings.device_id}</p>
          </div>
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="pad-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-6">
          {primaryNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                activeCls(item.to) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More sections"
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              isMoreRoute ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            More
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="More"
        >
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="pad-safe-bottom absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-4 shadow-pop">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex size-11 items-center justify-center rounded-lg text-muted-foreground"
                aria-label="Close"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pb-2">
              {moreNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-elevated px-3 text-sm font-medium"
                >
                  <item.icon className="size-5 text-primary" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
