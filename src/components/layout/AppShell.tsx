import { Link, useRouterState } from "@tanstack/react-router";
import {
  Cloud,
  CloudOff,
  Eye,
  FileSpreadsheet,
  Layers,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  Sun,
  Moon,
  User,
  X,
  ChevronRight,
  ShieldCheck,
  LayoutDashboard,
  Boxes,
  Tag,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { analyticsNav, primaryNav, systemNav } from "./nav-items";
import { useStockStore } from "@/store/stockStore";
import { useAutoSync } from "@/hooks/use-auto-sync";
import { useTheme } from "@/hooks/use-theme";
import { StocklyLogo } from "@/components/common/StocklyLogo";
import { toast } from "sonner";

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 group transition-transform active:scale-95">
      <div className="relative flex size-10 items-center justify-center transition-all">
        <StocklyLogo className="size-full" />
      </div>
      {!compact && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
            Stockly
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-primary/15 text-primary border border-primary/20">
              Pro
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground/80 font-medium">Inventory & Profit</span>
        </div>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settings = useStockStore((s) => s.settings);
  const sheetRole = useStockStore((s) => s.sheetRole);
  const syncToSheets = useStockStore((s) => s.syncToGoogleSheets);
  const syncFromSheets = useStockStore((s) => s.syncFromGoogleSheets);
  const { theme, cycleTheme, isLight } = useTheme();

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

  const handleManualSync = async () => {
    if (!settings.linked_file_name) {
      toast.info("Link a Google Sheet in Settings to sync data");
      return;
    }
    setSyncing(true);
    try {
      if (sheetRole === "read") {
        await syncFromSheets(true);
        toast.success("Pulled latest data from Google Sheet");
      } else {
        await syncToSheets(true);
        toast.success("Synced data with Google Sheet");
      }
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const isMoreRoute = [...analyticsNav, ...systemNav].some((i) => pathname.startsWith(i.to));
  const activeCls = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const showBanners = !online || sheetRole === "read";

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/25 selection:text-primary">
      {/* Offline / Read-Only Top Status Banner */}
      {showBanners && (
        <div className="sticky top-0 z-40 px-3 pt-2 lg:pl-68 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {!online && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-400 backdrop-blur-md shadow-sm">
              <CloudOff className="size-4 shrink-0 text-amber-400" aria-hidden />
              <span>Offline Mode: Changes are saved safely on this device and will sync automatically once reconnected.</span>
            </div>
          )}
          {sheetRole === "read" && online && (
            <div className="flex items-center gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-medium text-sky-400 backdrop-blur-md shadow-sm">
              <Eye className="size-4 shrink-0 text-sky-400" aria-hidden />
              <span>Viewer Mode: Connected with read-only permissions. You can view all records and pull fresh data.</span>
            </div>
          )}
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl px-4.5 py-5.5 lg:flex">
        <Brand />

        {/* Navigation Sections */}
        <div className="mt-8 flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
          {/* Operations */}
          <div>
            <p className="label-xs px-3 text-muted-foreground/60 mb-2">Operations</p>
            <nav className="flex flex-col gap-1" aria-label="Operations">
              {primaryNav.map((item) => {
                const active = activeCls(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/15 text-primary font-semibold shadow-sm"
                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4.5 transition-colors",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                    {active && (
                      <span className="absolute right-2.5 size-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Analytics & History */}
          <div>
            <p className="label-xs px-3 text-muted-foreground/60 mb-2">Analytics & Audit</p>
            <nav className="flex flex-col gap-1" aria-label="Analytics">
              {analyticsNav.map((item) => {
                const active = activeCls(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/15 text-primary font-semibold shadow-sm"
                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4.5 transition-colors",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                    {active && (
                      <span className="absolute right-2.5 size-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* System */}
          <div>
            <p className="label-xs px-3 text-muted-foreground/60 mb-2">System</p>
            <nav className="flex flex-col gap-1" aria-label="System">
              {systemNav.map((item) => {
                const active = activeCls(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/15 text-primary font-semibold shadow-sm"
                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4.5 transition-colors",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                    {active && (
                      <span className="absolute right-2.5 size-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Desktop Sidebar Bottom Card (Google Sheets status & Store Info) */}
        <div className="mt-auto pt-4 flex flex-col gap-2.5">
          {/* Quick Sync Pill */}
          <div className="rounded-xl border border-border/80 bg-sidebar-accent/50 p-2.5 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                "size-2 rounded-full shrink-0",
                settings.linked_file_name
                  ? (sheetRole === "read" ? "bg-sky-400" : "bg-emerald-400 animate-pulse")
                  : "bg-muted-foreground/50"
              )} />
              <div className="min-w-0 truncate">
                <p className="text-xs font-semibold truncate text-foreground">
                  {settings.linked_file_name ? "Google Sheets" : "Not Linked"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {settings.linked_file_name
                    ? (sheetRole === "read" ? "Viewer Access" : "Editor Synced")
                    : "Tap to connect"}
                </p>
              </div>
            </div>
            {settings.linked_file_name ? (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                title="Sync now"
                aria-label="Sync Google Sheets"
                className="flex size-7.5 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-elevated/70 text-muted-foreground hover:bg-accent hover:text-foreground active:scale-90 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3.5", syncing && "animate-spin text-primary")} />
              </button>
            ) : (
              <Link
                to="/settings"
                className="text-[11px] font-semibold text-primary hover:underline shrink-0"
              >
                Link
              </Link>
            )}
          </div>

          {/* Quick Theme Switcher Pill in Sidebar */}
          <button
            type="button"
            onClick={cycleTheme}
            className="rounded-xl border border-border/80 bg-sidebar-accent/50 p-2.5 flex items-center justify-between text-xs font-medium text-foreground hover:bg-sidebar-accent transition-all group"
          >
            <div className="flex items-center gap-2">
              {isLight ? (
                <Sun className="size-4 text-amber-500" />
              ) : (
                <Moon className="size-4 text-primary" />
              )}
              <span className="capitalize">{theme} Theme</span>
            </div>
            <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
              Tap to switch
            </span>
          </button>

          {/* User profile card */}
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5 transition-all hover:bg-sidebar-accent/70 group"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary font-bold text-xs">
              {(settings.user_name || "S").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                {settings.user_name || "Shopkeeper"}
              </p>
              <p className="num truncate text-[11px] text-muted-foreground/80">
                {settings.device_id || "Stockly Device"}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
          </Link>
        </div>
      </aside>

      {/* Mobile Top Header (Modern Glassmorphic Header) */}
      <header className="pad-safe-top sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-2xl lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Brand />

          {/* Right Mobile Status, Sync & Theme */}
          <div className="flex items-center gap-2">
            {/* Live Sheets Sync Pill */}
            {settings.linked_file_name ? (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                title="Google Sheets status (tap to sync)"
                aria-label="Sync with Google Sheets"
                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-elevated/80 px-2.5 py-1 text-xs font-medium text-foreground active:scale-95 transition-all shadow-xs"
              >
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    sheetRole === "read"
                      ? "bg-sky-400"
                      : "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50",
                  )}
                />
                <RefreshCw
                  className={cn("size-3 text-muted-foreground", syncing && "animate-spin text-primary")}
                />
                <span className="hidden xs:inline text-[11px] font-semibold">{syncing ? "Syncing" : "Synced"}</span>
              </button>
            ) : null}

            {/* Quick Theme Switcher */}
            <button
              type="button"
              onClick={cycleTheme}
              title={`Theme: ${theme}`}
              aria-label="Toggle theme"
              className="flex size-8.5 items-center justify-center rounded-xl border border-border/70 bg-elevated/80 text-foreground hover:text-primary active:scale-90 transition-all shadow-xs"
            >
              {isLight ? (
                <Sun className="size-4 text-amber-500" aria-hidden />
              ) : (
                <Moon className="size-4 text-primary" aria-hidden />
              )}
            </button>

            {/* Profile Avatar Shortcut */}
            <Link
              to="/settings"
              aria-label="Open settings"
              className="flex size-8.5 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary font-bold text-xs shadow-xs active:scale-90 transition-transform"
            >
              {(settings.user_name || "S").slice(0, 2).toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-68">
        <div className="mx-auto w-full max-w-6xl px-3.5 pb-32 pt-4 sm:px-6 sm:pt-7 lg:pb-12">
          {children}
        </div>
      </main>

      {/* Mobile Floating Ergonomic Dock (Buy -> Sell -> Home [Mid] -> Stock -> More) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-3 bottom-2.5 z-30 lg:hidden select-none"
      >
        <div className="flex h-16 items-center justify-around rounded-2xl border border-border/80 bg-card/92 px-2 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 dark:ring-white/5">
          {/* Tab 1: Buy */}
          <Link
            to="/buy"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-90",
              pathname.startsWith("/buy")
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShoppingCart className={cn("size-5", pathname.startsWith("/buy") && "scale-105")} />
            <span>Buy</span>
          </Link>

          {/* Tab 2: Sell */}
          <Link
            to="/sell"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-90",
              pathname.startsWith("/sell")
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Tag className={cn("size-5", pathname.startsWith("/sell") && "scale-105")} />
            <span>Sell</span>
          </Link>

          {/* Tab 3: Center Elevated Home Button (Mid) */}
          <Link
            to="/"
            className="group relative -mt-5 flex flex-col items-center justify-center transition-transform active:scale-90"
            aria-label="Home Dashboard"
          >
            <div className={cn(
              "flex size-12 items-center justify-center rounded-2xl shadow-lg ring-4 ring-background transition-transform group-hover:scale-105",
              pathname === "/"
                ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/40"
                : "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-600/30",
            )}>
              <LayoutDashboard className="size-5.5" />
            </div>
            <span className={cn("mt-1 text-[10px] font-bold tracking-tight", pathname === "/" ? "text-primary" : "text-muted-foreground")}>
              Home
            </span>
          </Link>

          {/* Tab 4: Stock */}
          <Link
            to="/stock"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-90",
              pathname.startsWith("/stock")
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Boxes className={cn("size-5", pathname.startsWith("/stock") && "scale-105")} />
            <span>Stock</span>
          </Link>

          {/* Tab 5: More Menu Button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More options"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-90",
              isMoreRoute
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal className={cn("size-5", isMoreRoute && "scale-105")} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Sheet Modal (Bottom Sheet native feeling) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity duration-200"
            onClick={() => setMoreOpen(false)}
          />

          {/* Bottom Sheet Card */}
          <div className="pad-safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border/80 bg-card/95 p-5 shadow-pop backdrop-blur-2xl animate-in slide-in-from-bottom duration-250">
            {/* Sheet Handle */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border/80" />

            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Navigation & Tools</h2>
                <p className="text-xs text-muted-foreground">Quick access to reports, logs & store settings</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-elevated/70 text-muted-foreground hover:text-foreground active:scale-90 transition-all"
                aria-label="Close menu"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {/* Google Sheets Quick Card inside More Drawer */}
            <div className="mb-4 rounded-2xl border border-border/80 bg-elevated/50 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {settings.linked_file_name ? "Google Sheets Connected" : "Google Sheets Backup"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {settings.linked_file_name
                      ? (sheetRole === "read" ? "Viewer mode active" : "Auto-sync enabled")
                      : "Link your Google Sheet"}
                  </p>
                </div>
              </div>

              {settings.linked_file_name ? (
                <button
                  type="button"
                  onClick={async () => {
                    await handleManualSync();
                  }}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary active:scale-95 transition-all"
                >
                  <RefreshCw className={cn("size-3", syncing && "animate-spin")} />
                  <span>{syncing ? "Syncing..." : "Sync Now"}</span>
                </button>
              ) : (
                <Link
                  to="/settings"
                  onClick={() => setMoreOpen(false)}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95 transition-all"
                >
                  Connect
                </Link>
              )}
            </div>

            {/* Navigation Cards Grid */}
            <div className="grid grid-cols-2 gap-2.5 pb-2">
              {[...analyticsNav, ...systemNav].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-elevated/60 p-3.5 text-left transition-all hover:bg-accent active:scale-95"
                >
                  <div className={cn("flex size-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-xs", item.color || "from-primary/20 to-primary/5 text-primary")}>
                    <item.icon className="size-4.5" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground/80 leading-tight">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
