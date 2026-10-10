import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Download,
  HardDriveDownload,
  Key,
  Lock,
  Mail,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  Upload,
  User,
  X,
  FileSpreadsheet,
  Edit3,
  Eye,
  RefreshCw,
  CheckCircle2,
  Sun,
  Moon,
  Check,
  FileSpreadsheet as FileSpreadsheetIcon,
  ExternalLink,
  Sliders,
  Cloud,
  CheckCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Field,
  PageHeader,
  Panel,
  SectionTitle,
  btnDanger,
  btnOutline,
  btnPrimary,
  inputClass,
} from "@/components/common/ui-bits";
import { useCurrency, useInventory, useStockStore } from "@/store/stockStore";
import { useTheme } from "@/hooks/use-theme";
import {
  exportStockInventoryExcel,
  exportSalesReportExcel,
  exportExpensesReportExcel,
  exportCompleteBusinessWorkbook,
} from "@/services/export-reports";
import { buildBackup, downloadJSON, parseBackup } from "@/services/backup";
import { hashPin, isValidPin, verifyPin } from "@/services/security";
import {
  authenticate,
  getAccessToken,
  getGoogleEmail,
  getGoogleSheetTitle,
  isAuthenticated,
  isTokenValid,
  revokeAccess,
  setGoogleRole,
} from "@/services/google-auth";
import { syncManager } from "@/services/sync-manager";
import type { BackupFile } from "@/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stockly" },
      { name: "description", content: "Manage your profile, security, data and backups." },
      { property: "og:title", content: "Settings — Stockly" },
      { property: "og:description", content: "Configure your Stockly experience." },
    ],
  }),
  component: SettingsPage,
});

type SettingsTab = "general" | "sheets" | "reports" | "security";

function SettingsPage() {
  const settings = useStockStore((s) => s.settings);
  const updateSettings = useStockStore((s) => s.updateSettings);
  const importData = useStockStore((s) => s.importData);
  const logExport = useStockStore((s) => s.logExport);
  const inventory = useInventory();
  const purchases = useStockStore((s) => s.purchases);
  const sales = useStockStore((s) => s.sales);
  const expenses = useStockStore((s) => s.expenses);
  const investments = useStockStore((s) => s.investments);
  const { theme, setTheme } = useTheme();
  const currency = useCurrency();

  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* --- User Profile --- */
  const [profile, setProfile] = useState({
    user_name: settings.user_name,
    currency_symbol: settings.currency_symbol || "Rs.",
    low_stock_threshold: settings.low_stock_threshold,
  });
  const [profileError, setProfileError] = useState("");

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.user_name.trim()) {
      setProfileError("Name is required");
      return;
    }
    if (profile.low_stock_threshold < 0) {
      setProfileError("Low stock limit must be >= 0");
      return;
    }
    await updateSettings({
      user_name: profile.user_name.trim(),
      currency_symbol: profile.currency_symbol.trim(),
      low_stock_threshold: profile.low_stock_threshold,
    });
    setProfileError("");
    toast.success("Settings saved successfully!");
  };

  /* --- PIN Security --- */
  const [pinMode, setPinMode] = useState<"set" | "change" | "disable">("set");
  const [pinFields, setPinFields] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [pinError, setPinError] = useState("");
  const pinHash = settings.pin_code_hash;
  const hasPin = Boolean(pinHash);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (pinMode === "set") {
      if (!isValidPin(pinFields.new)) {
        setPinError("PIN must be 4–6 numeric digits");
        return;
      }
      if (pinFields.new !== pinFields.confirm) {
        setPinError("PINs do not match");
        return;
      }
      const hashed = await hashPin(pinFields.new);
      await updateSettings({ pin_code_hash: hashed });
      setPinFields({ current: "", new: "", confirm: "" });
      setPinMode("change");
      toast.success("Security PIN enabled!");
      return;
    }

    if (pinMode === "change") {
      if (!(await verifyPin(pinFields.current, pinHash))) {
        setPinError("Current PIN is incorrect");
        return;
      }
      if (!isValidPin(pinFields.new)) {
        setPinError("New PIN must be 4–6 numeric digits");
        return;
      }
      if (pinFields.new !== pinFields.confirm) {
        setPinError("PINs do not match");
        return;
      }
      const hashed = await hashPin(pinFields.new);
      await updateSettings({ pin_code_hash: hashed });
      setPinFields({ current: "", new: "", confirm: "" });
      toast.success("Security PIN updated!");
      return;
    }

    if (pinMode === "disable") {
      if (!(await verifyPin(pinFields.current, pinHash))) {
        setPinError("Current PIN is incorrect");
        return;
      }
      await updateSettings({ pin_code_hash: "" });
      setPinFields({ current: "", new: "", confirm: "" });
      setPinMode("set");
      toast.success("Security PIN disabled!");
    }
  };

  /* --- Google Sheets Sync --- */
  const [sheetUrl, setSheetUrl] = useState(settings.linked_file_name || "");
  const [syncing, setSyncing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(() => getGoogleEmail());
  const [sheetTitle, setSheetTitle] = useState<string | null>(() => getGoogleSheetTitle());
  const [refreshingPerms, setRefreshingPerms] = useState(false);
  const connectGoogleSheet = useStockStore((s) => s.connectGoogleSheet);
  const syncToGoogleSheets = useStockStore((s) => s.syncToGoogleSheets);
  const syncFromGoogleSheets = useStockStore((s) => s.syncFromGoogleSheets);
  const refreshSheetPermission = useStockStore((s) => s.refreshSheetPermission);
  const sheetRole = useStockStore((s) => s.sheetRole);

  const handleSheetUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSheetUrl(e.target.value);
  };

  const extractSheetId = (url: string): string | null => {
    const matches = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return matches ? (matches[1] ?? null) : url.trim() || null;
  };

  const handleSignInGoogle = async () => {
    setSigningIn(true);
    try {
      const auth = await authenticate();
      setConnectedEmail(auth.email);
      if (syncManager.isConnected()) {
        try {
          await refreshSheetPermission();
          setSheetTitle(getGoogleSheetTitle());
        } catch {
          // ignore
        }
      }
      toast.success(auth.email ? `Signed in as ${auth.email}` : "Signed in with Google!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await revokeAccess();
      setConnectedEmail(null);
      setSheetTitle(null);
      await updateSettings({ linked_file_name: "" });
      toast.success("Signed out of Google");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const ensureAuth = async () => {
    const token = await getAccessToken();
    if (!token || !isTokenValid()) {
      const auth = await authenticate();
      setConnectedEmail(auth.email);
    }
  };

  const handleRefreshPermissions = async () => {
    setRefreshingPerms(true);
    try {
      await ensureAuth();
      await refreshSheetPermission();
      setSheetTitle(getGoogleSheetTitle());
      const role = syncManager.getRole();
      if (role === "edit") {
        toast.success("Permission verified: Editor (Full access)");
      } else {
        toast.info("Permission verified: Viewer (Read-only)");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify permission");
    } finally {
      setRefreshingPerms(false);
    }
  };

  const handleConnectSheet = async () => {
    const id = extractSheetId(sheetUrl);
    if (!id) {
      toast.error("Invalid Google Sheet URL or ID");
      return;
    }
    setSyncing(true);
    try {
      await ensureAuth();
      await connectGoogleSheet(id);
      setSheetTitle(getGoogleSheetTitle());
      const role = syncManager.getRole();
      if (role === "read") {
        toast.success("Connected to Google Sheet as Viewer (Read-only)!");
      } else {
        toast.success("Connected to Google Sheet as Editor (Full access)!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect to Google Sheet");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectSheet = async () => {
    await syncManager.setSheetId("");
    setGoogleRole(null);
    setSheetTitle(null);
    setSheetUrl("");
    await updateSettings({
      linked_file_name: "",
      last_sync_time: new Date().toISOString(),
    });
    toast.success("Disconnected from Google Sheet");
  };

  const handleSyncToSheets = async () => {
    setSyncing(true);
    try {
      await ensureAuth();
      await syncToGoogleSheets();
      toast.success("Synced to Google Sheet!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncFromSheets = async () => {
    setSyncing(true);
    try {
      await ensureAuth();
      await syncFromGoogleSheets();
      toast.success("Synced from Google Sheet!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = Boolean(settings.linked_file_name);
  const canConnect = Boolean(sheetUrl);
  const isReadOnly = sheetRole === "read";

  /* --- Backup & Restore --- */
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    data: BackupFile;
    mode: "merge" | "replace";
  } | null>(null);

  const handleExport = async () => {
    const {
      purchases,
      sales,
      expenses,
      adjustments,
      changelogs,
      settings: s,
    } = useStockStore.getState();
    const backup = buildBackup({
      purchases,
      sales,
      expenses,
      adjustments,
      changelogs,
      settings: s,
    });
    const filename = `stockly-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
    downloadJSON(backup, filename);
    await logExport();
    toast.success("JSON Backup downloaded!");
  };

  const handleFileSelect = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = parseBackup(text);
      setPendingImport({ data: parsed, mode: importMode });
      setShowImportConfirm(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid backup file");
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    const { data, mode } = pendingImport;
    await importData(
      {
        purchases: data.purchases,
        sales: data.sales,
        expenses: data.expenses,
        adjustments: data.adjustments,
        changelogs: data.changelogs,
      },
      mode,
    );
    const importedSettings = data.settings as Record<string, unknown>;
    if (importedSettings) {
      await updateSettings({
        user_name: (importedSettings.user_name as string) || "",
        currency_symbol: (importedSettings.currency_symbol as string) || "Rs.",
        low_stock_threshold:
          typeof importedSettings.low_stock_threshold === "number"
            ? importedSettings.low_stock_threshold
            : 5,
      });
    }
    setShowImportConfirm(false);
    setPendingImport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success(mode === "replace" ? "All data replaced successfully!" : "Data merged successfully!");
  };

  const userInitial = (profile.user_name.trim()[0] || "U").toUpperCase();

  return (
    <div className="space-y-5 pb-8">
      {/* Top Header with Profile Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-elevated/90 via-surface to-elevated/40 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-xl font-bold text-slate-950 shadow-md ring-2 ring-emerald-500/20">
              {userInitial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {profile.user_name || "Shop Settings"}
                </h1>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
                  {currency}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Manage appearance, Google Sheets cloud link, reports and shop security.
              </p>
            </div>
          </div>

          {/* Quick status pill badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                Sheets Linked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-elevated/60 px-3 py-1.5 font-medium text-muted-foreground">
                <Cloud className="size-3.5" />
                Sheets Offline
              </span>
            )}

            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-medium",
              hasPin
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-elevated/60 text-muted-foreground"
            )}>
              <Shield className="size-3.5" />
              {hasPin ? "PIN Active" : "No PIN"}
            </span>
          </div>
        </div>
      </div>

      {/* Segmented Pill Tab Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-border/80 bg-elevated/40 p-1.5 text-xs font-medium no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 px-3 whitespace-nowrap transition-all tap-active",
            activeTab === "general"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-elevated/60"
          )}
        >
          <Sliders className="size-4" />
          <span>General</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sheets")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 px-3 whitespace-nowrap transition-all tap-active",
            activeTab === "sheets"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-elevated/60"
          )}
        >
          <FileSpreadsheet className="size-4" />
          <span>Google Sheets</span>
          {isConnected && <span className="size-1.5 rounded-full bg-emerald-400" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 px-3 whitespace-nowrap transition-all tap-active",
            activeTab === "reports"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-elevated/60"
          )}
        >
          <FileSpreadsheetIcon className="size-4" />
          <span>Reports & Data</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 px-3 whitespace-nowrap transition-all tap-active",
            activeTab === "security"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-elevated/60"
          )}
        >
          <Lock className="size-4" />
          <span>Security</span>
        </button>
      </div>

      {/* ================= TAB 1: GENERAL (PROFILE & APPEARANCE) ================= */}
      {activeTab === "general" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Shop Profile Panel */}
          <Panel>
            <SectionTitle
              left={<User className="size-4 text-primary" aria-hidden />}
              right={<span className="text-xs text-muted-foreground">Store Details</span>}
            >
              Shop Profile
            </SectionTitle>

            <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Owner / Shop Name" htmlFor="set-name" required error={profileError}>
                <input
                  id="set-name"
                  className={inputClass}
                  value={profile.user_name}
                  onChange={(e) => {
                    setProfile((p) => ({ ...p, user_name: e.target.value }));
                    setProfileError("");
                  }}
                  placeholder="e.g. Usman Agro"
                />
              </Field>

              <Field label="Currency Symbol" htmlFor="set-currency" required>
                <input
                  id="set-currency"
                  className={inputClass}
                  value={profile.currency_symbol}
                  onChange={(e) => setProfile((p) => ({ ...p, currency_symbol: e.target.value }))}
                  placeholder="Rs. or $"
                />
              </Field>

              <Field label="Low Stock Warning Threshold (units)" htmlFor="set-threshold" required>
                <input
                  id="set-threshold"
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={profile.low_stock_threshold}
                  onChange={(e) => {
                    setProfile((p) => ({ ...p, low_stock_threshold: parseInt(e.target.value) || 0 }));
                    setProfileError("");
                  }}
                />
              </Field>

              <Field label="Device ID" htmlFor="set-device">
                <input
                  id="set-device"
                  className={cn(inputClass, "opacity-75 cursor-not-allowed bg-elevated/60 font-mono text-xs")}
                  value={settings.device_id}
                  readOnly
                />
              </Field>

              <div className="sm:col-span-2 pt-2">
                <button type="submit" className={cn(btnPrimary, "w-full sm:w-auto")}>
                  <Save className="size-4" aria-hidden /> Save Changes
                </button>
              </div>
            </form>
          </Panel>

          {/* Theme & Appearance Panel */}
          <Panel>
            <SectionTitle
              left={<Sun className="size-4 text-amber-400" aria-hidden />}
              right={
                <span className="text-xs font-semibold capitalize text-primary">
                  {theme} Active
                </span>
              }
            >
              Appearance & Theme
            </SectionTitle>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {/* Light Mode */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "group relative flex flex-col items-start gap-2.5 rounded-2xl border p-4 text-left transition-all tap-active",
                  theme === "light"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                    : "border-border/80 bg-elevated/40 hover:border-border hover:bg-elevated"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                    <Sun className="size-5" />
                  </div>
                  {theme === "light" && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Clean Light</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    Daylight crisp white mode — high visibility in bright shop sunlight.
                  </p>
                </div>
              </button>

              {/* Dark Mode */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "group relative flex flex-col items-start gap-2.5 rounded-2xl border p-4 text-left transition-all tap-active",
                  theme === "dark"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                    : "border-border/80 bg-elevated/40 hover:border-border hover:bg-elevated"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Moon className="size-5" />
                  </div>
                  {theme === "dark" && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Business Dark</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    Modern sleek slate theme with balanced soft dark contrast.
                  </p>
                </div>
              </button>

              {/* OLED Black */}
              <button
                type="button"
                onClick={() => setTheme("oled")}
                className={cn(
                  "group relative flex flex-col items-start gap-2.5 rounded-2xl border p-4 text-left transition-all tap-active",
                  theme === "oled"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                    : "border-border/80 bg-elevated/40 hover:border-border hover:bg-elevated"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100">
                    <div className="size-3.5 rounded-full bg-black border border-zinc-600" />
                  </div>
                  {theme === "oled" && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">OLED Black</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    True #000000 pure black — saves battery on AMOLED mobile displays.
                  </p>
                </div>
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* ================= TAB 2: GOOGLE SHEETS CLOUD SYNC ================= */}
      {activeTab === "sheets" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          <Panel>
            <SectionTitle
              left={<FileSpreadsheet className="size-4 text-emerald-400" aria-hidden />}
              right={
                isConnected ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle className="size-3.5" /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Cloud Sync</span>
                )
              }
            >
              Google Sheets Sync
            </SectionTitle>

            <div className="mt-4 space-y-4">
              {/* Account Card */}
              <div className="rounded-2xl border border-border/80 bg-elevated/40 p-4 transition-all">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        1
                      </span>
                      <p className="text-sm font-semibold text-foreground">Google Account</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {connectedEmail ? (
                        <span>
                          Connected: <strong className="text-foreground">{connectedEmail}</strong>
                          {!isTokenValid() && (
                            <span className="ml-2 inline-flex items-center text-amber-500 font-semibold">
                              · Token Expired
                            </span>
                          )}
                        </span>
                      ) : (
                        "Sign in to synchronize your business ledger automatically."
                      )}
                    </p>
                  </div>

                  {connectedEmail ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {!isTokenValid() && (
                        <button
                          type="button"
                          onClick={handleSignInGoogle}
                          disabled={signingIn}
                          className={cn(btnPrimary, "text-xs py-2 h-auto")}
                        >
                          <RotateCcw className="size-3.5" />
                          {signingIn ? "Reconnecting..." : "Reconnect"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSignInGoogle}
                        disabled={signingIn}
                        className={cn(btnOutline, "text-xs py-2 h-auto")}
                      >
                        Switch
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOutGoogle}
                        className={cn(btnDanger, "text-xs py-2 h-auto")}
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSignInGoogle}
                      disabled={signingIn}
                      className={cn(btnPrimary, "text-xs py-2.5 h-auto")}
                    >
                      <Mail className="size-4" />
                      {signingIn ? "Signing in..." : "Sign in with Google"}
                    </button>
                  )}
                </div>
              </div>

              {/* Link Spreadsheet Card */}
              <div className="rounded-2xl border border-border/80 bg-elevated/40 p-4 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    2
                  </span>
                  <p className="text-sm font-semibold text-foreground">Spreadsheet Link</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="sheet-url" className="text-xs font-medium text-muted-foreground block">
                    Google Sheet Link or Sheet ID
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="sheet-url"
                      className={cn(inputClass, "flex-1")}
                      value={sheetUrl}
                      onChange={handleSheetUrlChange}
                      placeholder="Paste sheet browser link or sheet ID..."
                    />
                    {isConnected ? (
                      <button
                        type="button"
                        className={cn(btnDanger, "whitespace-nowrap")}
                        onClick={handleDisconnectSheet}
                        disabled={syncing}
                      >
                        <X className="size-4" /> Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={cn(btnPrimary, "whitespace-nowrap")}
                        onClick={handleConnectSheet}
                        disabled={!canConnect || syncing}
                      >
                        <FileSpreadsheet className="size-4" />
                        {syncing ? "Connecting..." : "Link Sheet"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Connected Details Dashboard */}
                {isConnected && (
                  <div className="mt-4 rounded-xl border border-border/80 bg-surface/80 p-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sheet Title</p>
                        <p className="font-semibold text-sm text-foreground truncate mt-0.5">
                          {sheetTitle || "Google Sheet"}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Permission</p>
                          <button
                            type="button"
                            onClick={handleRefreshPermissions}
                            disabled={refreshingPerms || syncing}
                            className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <RefreshCw className={cn("size-3", refreshingPerms && "animate-spin")} />
                            Verify
                          </button>
                        </div>
                        <div className="mt-1">
                          {sheetRole === "edit" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <Edit3 className="size-3" /> Editor · Full Access
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Eye className="size-3" /> Viewer · Read-Only
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Connected Account</p>
                        <p className="font-medium text-xs text-foreground truncate mt-0.5">
                          {connectedEmail || "Google Account"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Last Sync</p>
                        <p className="font-medium text-xs text-foreground mt-0.5">
                          {settings.last_sync_time
                            ? format(new Date(settings.last_sync_time), "dd MMM yyyy, HH:mm")
                            : "Just now"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/80 flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        className={cn(btnOutline, "flex-1 sm:flex-initial")}
                        onClick={handleSyncFromSheets}
                        disabled={syncing}
                      >
                        <RotateCcw className={cn("size-4", syncing && "animate-spin")} />
                        {syncing ? "Syncing..." : "Pull from Sheets"}
                      </button>

                      <button
                        type="button"
                        className={cn(btnPrimary, "flex-1 sm:flex-initial")}
                        onClick={handleSyncToSheets}
                        disabled={syncing || isReadOnly}
                      >
                        <RotateCcw className={cn("size-4", syncing && "animate-spin")} />
                        {isReadOnly ? "Viewer Only (No Write)" : syncing ? "Pushing..." : "Push to Sheets"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ================= TAB 3: REPORTS & DATA ================= */}
      {activeTab === "reports" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Excel / CSV Exports Panel */}
          <Panel>
            <SectionTitle
              left={<FileSpreadsheetIcon className="size-4 text-emerald-400" aria-hidden />}
              right={
                <span className="text-xs font-semibold text-emerald-400">
                  1-Click Downloads
                </span>
              }
            >
              Excel (XLSX) & CSV Exports
            </SectionTitle>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Master Workbook */}
              <button
                type="button"
                className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left transition-all hover:bg-emerald-500/15 group tap-active"
                onClick={() => {
                  exportCompleteBusinessWorkbook(
                    { inventory, sales, purchases, expenses, investments },
                    currency,
                  );
                  toast.success("Master Business Excel Workbook downloaded!");
                }}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <FileSpreadsheetIcon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-emerald-400 transition-colors">
                    Master Business Workbook (.xlsx)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete sheet: Inventory, Sales, Purchases, Expenses & Investments
                  </p>
                </div>
              </button>

              {/* Stock Inventory */}
              <button
                type="button"
                className="flex items-center gap-3.5 rounded-2xl border border-border/80 bg-elevated/40 p-4 text-left transition-all hover:bg-elevated/80 group tap-active"
                onClick={() => {
                  exportStockInventoryExcel(inventory, currency, settings.low_stock_threshold);
                  toast.success("Stock Inventory Excel report downloaded!");
                }}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                  <Download className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    Stock Inventory Report (.xlsx)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Item quantities, average purchase prices & stock valuation
                  </p>
                </div>
              </button>

              {/* Sales History */}
              <button
                type="button"
                className="flex items-center gap-3.5 rounded-2xl border border-border/80 bg-elevated/40 p-4 text-left transition-all hover:bg-elevated/80 group tap-active"
                onClick={() => {
                  exportSalesReportExcel(sales, currency);
                  toast.success("Sales History Excel report downloaded!");
                }}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400">
                  <Download className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    Sales & Profit History (.xlsx)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Customer sales log, revenues, margins & items sold
                  </p>
                </div>
              </button>

              {/* Expenses Sheet */}
              <button
                type="button"
                className="flex items-center gap-3.5 rounded-2xl border border-border/80 bg-elevated/40 p-4 text-left transition-all hover:bg-elevated/80 group tap-active"
                onClick={() => {
                  exportExpensesReportExcel(expenses, currency);
                  toast.success("Expenses Excel sheet downloaded!");
                }}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <Download className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    Shop Expenses Sheet (.xlsx)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Categorized bills, rent, maintenance & monthly totals
                  </p>
                </div>
              </button>
            </div>
          </Panel>

          {/* JSON Backup & Migration Panel */}
          <Panel>
            <SectionTitle
              left={<HardDriveDownload className="size-4 text-primary" aria-hidden />}
              right={<span className="text-xs text-muted-foreground">JSON Archive</span>}
            >
              Data Backup & Restore
            </SectionTitle>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={cn(btnPrimary, "justify-center")}
                onClick={handleExport}
              >
                <HardDriveDownload className="size-4" /> Download JSON Backup
              </button>

              <div className="flex items-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  className="hidden"
                  id="import-file-unified"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <label
                  htmlFor="import-file-unified"
                  className={cn(btnOutline, "w-full justify-center cursor-pointer")}
                >
                  <Upload className="size-4" /> Restore from JSON File
                </label>
              </div>
            </div>

            {/* Import Mode Settings */}
            <div className="mt-4 rounded-2xl border border-border/80 bg-elevated/40 p-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">Import Strategy:</span>
                  <div className="inline-flex rounded-xl bg-background p-1 border border-border/80">
                    <button
                      type="button"
                      onClick={() => setImportMode("merge")}
                      className={cn(
                        "rounded-lg px-3 py-1 text-xs font-medium transition-all",
                        importMode === "merge"
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Merge (Safe)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode("replace")}
                      className={cn(
                        "rounded-lg px-3 py-1 text-xs font-medium transition-all",
                        importMode === "replace"
                          ? "bg-destructive text-destructive-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Replace All
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {importMode === "merge"
                    ? "Merges new records into existing data without deletion."
                    : "Overwrites entire database with the backup file."}
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ================= TAB 4: SECURITY ================= */}
      {activeTab === "security" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          <Panel>
            <SectionTitle
              left={<Key className="size-4 text-primary" aria-hidden />}
              right={
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                    hasPin
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  )}
                >
                  <Shield className="size-3" /> {hasPin ? "PIN Enabled" : "PIN Disabled"}
                </span>
              }
            >
              Shop App PIN Lock
            </SectionTitle>

            <form onSubmit={handlePinSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
              {!hasPin && (
                <>
                  <Field label="Set New PIN" htmlFor="pin-new" required error={pinError}>
                    <input
                      id="pin-new"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      className={inputClass}
                      value={pinFields.new}
                      onChange={(e) => {
                        setPinFields((f) => ({ ...f, new: e.target.value }));
                        setPinError("");
                      }}
                      placeholder="Enter 4–6 numeric digits"
                    />
                  </Field>
                  <Field label="Confirm New PIN" htmlFor="pin-confirm" required error={pinError}>
                    <input
                      id="pin-confirm"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      className={inputClass}
                      value={pinFields.confirm}
                      onChange={(e) => {
                        setPinFields((f) => ({ ...f, confirm: e.target.value }));
                        setPinError("");
                      }}
                      placeholder="Repeat PIN"
                    />
                  </Field>
                </>
              )}

              {hasPin && pinMode === "change" && (
                <>
                  <Field label="Current PIN" htmlFor="pin-current" required error={pinError}>
                    <input
                      id="pin-current"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      className={inputClass}
                      value={pinFields.current}
                      onChange={(e) => {
                        setPinFields((f) => ({ ...f, current: e.target.value }));
                        setPinError("");
                      }}
                      placeholder="Enter current PIN"
                    />
                  </Field>
                  <Field label="New PIN" htmlFor="pin-new" required error={pinError}>
                    <input
                      id="pin-new"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      className={inputClass}
                      value={pinFields.new}
                      onChange={(e) => {
                        setPinFields((f) => ({ ...f, new: e.target.value }));
                        setPinError("");
                      }}
                      placeholder="4–6 digits"
                    />
                  </Field>
                  <Field
                    label="Confirm New PIN"
                    htmlFor="pin-confirm"
                    required
                    error={pinError}
                    sm:col-span-2
                  >
                    <input
                      id="pin-confirm"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      className={inputClass}
                      value={pinFields.confirm}
                      onChange={(e) => {
                        setPinFields((f) => ({ ...f, confirm: e.target.value }));
                        setPinError("");
                      }}
                      placeholder="Confirm new PIN"
                    />
                  </Field>
                </>
              )}

              {hasPin && pinMode === "disable" && (
                <Field
                  label="Enter Current PIN to Disable"
                  htmlFor="pin-current"
                  required
                  error={pinError}
                  sm:col-span-2
                >
                  <input
                    id="pin-current"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    className={inputClass}
                    value={pinFields.current}
                    onChange={(e) => {
                      setPinFields((f) => ({ ...f, current: e.target.value }));
                      setPinError("");
                    }}
                    placeholder="Enter current PIN"
                  />
                </Field>
              )}

              <div className="flex flex-wrap gap-2.5 sm:col-span-2 pt-2">
                {!hasPin ? (
                  <button type="submit" className={btnPrimary}>
                    <Lock className="size-4" /> Enable PIN Lock
                  </button>
                ) : pinMode === "change" ? (
                  <>
                    <button type="submit" className={btnPrimary}>
                      <RotateCcw className="size-4" /> Update PIN
                    </button>
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => {
                        setPinMode("disable");
                        setPinFields({ current: "", new: "", confirm: "" });
                        setPinError("");
                      }}
                    >
                      <Trash2 className="size-4" /> Turn Off PIN
                    </button>
                  </>
                ) : (
                  <>
                    <button type="submit" className={btnDanger}>
                      <X className="size-4" /> Confirm & Disable PIN
                    </button>
                    <button
                      type="button"
                      className={btnOutline}
                      onClick={() => {
                        setPinMode("change");
                        setPinFields({ current: "", new: "", confirm: "" });
                        setPinError("");
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </form>
          </Panel>
        </div>
      )}

      {/* Import Confirmation Dialog */}
      <ConfirmDialog
        open={showImportConfirm}
        onOpenChange={(o) => !o && setShowImportConfirm(false)}
        title={`Import data (${importMode})?`}
        description={
          importMode === "replace"
            ? "This will REPLACE all purchases, sales, expenses, adjustments and activity logs. This cannot be undone."
            : "New records will be merged; existing records with the same ID will be updated."
        }
        confirmLabel={importMode === "replace" ? "Replace all data" : "Merge data"}
        destructive={importMode === "replace"}
        onConfirm={confirmImport}
      />
    </div>
  );
}
