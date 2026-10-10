import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Download,
  FilePlus,
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
  CheckCircle2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  SectionTitle,
  btnDanger,
  btnIcon,
  btnOutline,
  btnPrimary,
  inputClass,
} from "@/components/common/ui-bits";
import { useCurrency, useStockStore } from "@/store/stockStore";
import { buildBackup, downloadJSON, parseBackup } from "@/services/backup";
import { hashPin, isValidPin, verifyPin } from "@/services/security";
import {
  authenticate,
  getGoogleEmail,
  getGoogleSheetTitle,
  isAuthenticated,
  revokeAccess,
  setGoogleRole,
} from "@/services/google-auth";
import { syncManager } from "@/services/sync-manager";
import type { BackupFile } from "@/types";
import { format } from "date-fns";


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

function SettingsPage() {
  const settings = useStockStore((s) => s.settings);
  const updateSettings = useStockStore((s) => s.updateSettings);
  const importData = useStockStore((s) => s.importData);
  const logExport = useStockStore((s) => s.logExport);
  const currency = useCurrency();

  /* --- Refs / state --- */
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
    toast.success("Settings saved!");
  };

  /* --- PIN --- */
  const [pinMode, setPinMode] = useState<"set" | "change" | "disable">("set");
  const [pinFields, setPinFields] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [pinError, setPinError] = useState("");
  const pinHash = settings.pin_code_hash;

  const canSetPin = !pinHash;
  const hasPin = Boolean(pinHash);

  /* --- Google Sheets Sync --- */
  const [sheetUrl, setSheetUrl] = useState(settings.linked_file_name || "");
  const [syncing, setSyncing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(() => getGoogleEmail());
  const [sheetTitle, setSheetTitle] = useState<string | null>(() => getGoogleSheetTitle());
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const connectGoogleSheet = useStockStore((s) => s.connectGoogleSheet);
  const syncToGoogleSheets = useStockStore((s) => s.syncToGoogleSheets);
  const syncFromGoogleSheets = useStockStore((s) => s.syncFromGoogleSheets);
  const sheetRole = useStockStore((s) => s.sheetRole);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const off = () => setOnline(false);
    const on = () => setOnline(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);

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
    if (!isAuthenticated()) {
      const auth = await authenticate();
      setConnectedEmail(auth.email);
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


  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (pinMode === "set") {
      if (!isValidPin(pinFields.new)) {
        setPinError("PIN must be 4–6 digits");
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
      toast.success("PIN set!");
      return;
    }

    if (pinMode === "change") {
      if (!(await verifyPin(pinFields.current, pinHash))) {
        setPinError("Current PIN is incorrect");
        return;
      }
      if (!isValidPin(pinFields.new)) {
        setPinError("New PIN must be 4–6 digits");
        return;
      }
      if (pinFields.new !== pinFields.confirm) {
        setPinError("PINs do not match");
        return;
      }
      const hashed = await hashPin(pinFields.new);
      await updateSettings({ pin_code_hash: hashed });
      setPinFields({ current: "", new: "", confirm: "" });
      toast.success("PIN updated!");
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
      toast.success("PIN disabled!");
    }
  };

  /* --- Export / Import / Backup --- */
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
    toast.success("Backup created!");
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
    // Apply imported settings (but preserve device_id & PIN)
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
    fileInputRef.current!.value = "";
    toast.success(mode === "replace" ? "Data replaced!" : "Data merged!");
  };

  const handleRestore = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Configure your shop, security, and data." />

      {/* User Profile */}
      <Panel>
        <SectionTitle
          left={<SettingsIcon className="size-4" aria-hidden />}
          right={<span className="text-xs text-muted-foreground">Profile</span>}
        >
          User Profile
        </SectionTitle>
        <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="set-name" required error={profileError}>
            <input
              id="set-name"
              className={inputClass}
              value={profile.user_name}
              onChange={(e) => {
                setProfile((p) => ({ ...p, user_name: e.target.value }));
                setProfileError("");
              }}
              placeholder="e.g. Usman"
            />
          </Field>
          <Field label="Currency symbol" htmlFor="set-currency" required>
            <input
              id="set-currency"
              className={inputClass}
              value={profile.currency_symbol}
              onChange={(e) => setProfile((p) => ({ ...p, currency_symbol: e.target.value }))}
              placeholder="Rs."
            />
          </Field>
          <Field label="Low stock limit" htmlFor="set-threshold" required>
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
            <input id="set-device" className={inputClass} value={settings.device_id} readOnly />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className={btnPrimary}>
              <Save className="size-4" aria-hidden /> Save profile
            </button>
          </div>
        </form>
      </Panel>

      {/* PIN Security */}
      <Panel>
        <SectionTitle
          left={<Key className="size-4" aria-hidden />}
          right={
            <span
              className={
                hasPin
                  ? "inline-flex items-center gap-1 text-xs font-medium text-success"
                  : "inline-flex items-center gap-1 text-xs font-medium text-warning"
              }
            >
              <Shield className="size-3" aria-hidden /> {hasPin ? "Enabled" : "Disabled"}
            </span>
          }
        >
          PIN Security
        </SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasPin
            ? "A 4–6 digit PIN protects the app. Enter it to change or disable."
            : "Set a PIN to lock the app on launch."}
        </p>

        <form onSubmit={handlePinSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          {!hasPin && (
            <>
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
              <Field label="Confirm PIN" htmlFor="pin-confirm" required error={pinError}>
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
                  placeholder="Confirm"
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
                  placeholder="Current PIN"
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
                label="Confirm new PIN"
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
                  placeholder="Confirm"
                />
              </Field>
            </>
          )}

          {hasPin && pinMode === "disable" && (
            <Field
              label="Current PIN"
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
                placeholder="Current PIN to disable"
              />
            </Field>
          )}

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {!hasPin ? (
              <button type="submit" className={btnPrimary}>
                <Lock className="size-4" aria-hidden /> Set PIN
              </button>
            ) : pinMode === "change" ? (
              <>
                <button type="submit" className={btnPrimary}>
                  <RotateCcw className="size-4" aria-hidden /> Change PIN
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
                  <Trash2 className="size-4" aria-hidden /> Disable PIN
                </button>
              </>
            ) : (
              <>
                <button type="submit" className={btnDanger}>
                  <X className="size-4" aria-hidden /> Confirm disable
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

      {/* Data Management */}
      <Panel>
        <SectionTitle left={<HardDriveDownload className="size-4" aria-hidden />}>
          Data Management
        </SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Export your complete data as a JSON file, or import a backup to merge or replace.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" className={btnOutline} onClick={handleExport}>
            <Download className="size-4" aria-hidden /> Export All Data
          </button>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              className="hidden"
              id="import-file"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <label htmlFor="import-file" className={btnOutline}>
              <Upload className="size-4" aria-hidden /> Import Data
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-elevated p-3">
          <div className="flex items-center gap-3">
            <span className="label-xs">Import mode</span>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="import-mode"
                value="merge"
                checked={importMode === "merge"}
                onChange={() => setImportMode("merge")}
                className="sr-only peer"
              />
              <span className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border border-border bg-elevated peer-checked:border-primary peer-checked:bg-primary/15 peer-checked:text-primary">
                Merge
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="import-mode"
                value="replace"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
                className="sr-only peer"
              />
              <span className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border border-border bg-elevated peer-checked:border-destructive peer-checked:bg-destructive/15 peer-checked:text-destructive">
                Replace
              </span>
            </label>
            <span className="text-xs text-muted-foreground ml-auto">
              Merge adds new records; Replace overwrites everything.
            </span>
          </div>
        </div>
      </Panel>

      {/* Backup */}
      <Panel>
        <SectionTitle left={<FilePlus className="size-4" aria-hidden />}>
          Backup & Restore
        </SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a full backup or restore from a backup file.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" className={btnPrimary} onClick={handleExport}>
            <HardDriveDownload className="size-4" aria-hidden /> Create Backup
          </button>
          <button type="button" className={btnOutline} onClick={handleRestore}>
            <RotateCcw className="size-4" aria-hidden /> Restore Backup
          </button>
        </div>
      </Panel>

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

      {/* Google Sheets Sync */}
      <Panel>
        <SectionTitle left={<FileSpreadsheet className="size-4" aria-hidden />}>
          Google Sheets Sync &amp; Sharing
        </SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with the Gmail account to which the sheet was shared, then link your spreadsheet.
        </p>

        <div className="mt-5 space-y-5">
          {/* Step 1: Google Account */}
          <div className="rounded-xl border border-border bg-elevated/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    1
                  </span>
                  <p className="text-sm font-semibold text-foreground">Google Account</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {connectedEmail
                    ? `Active account: ${connectedEmail}`
                    : "Sign in with the Gmail account that has access to the sheet."}
                </p>
              </div>

              {connectedEmail ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSignInGoogle}
                    disabled={signingIn}
                    className={btnOutline}
                  >
                    Switch Account
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOutGoogle}
                    className={btnDanger}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSignInGoogle}
                  disabled={signingIn}
                  className={btnPrimary}
                >
                  <Mail className="size-4" aria-hidden />
                  {signingIn ? "Signing in..." : "Sign in with Google"}
                </button>
              )}
            </div>
          </div>

          {/* Step 2: Link Google Sheet */}
          <div className="rounded-xl border border-border bg-elevated/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                2
              </span>
              <p className="text-sm font-semibold text-foreground">Link Google Sheet</p>
            </div>

            <div className="space-y-3">
              <label htmlFor="sheet-url" className="label-xs block">
                Google Sheet URL or ID
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="sheet-url"
                  className={inputClass}
                  value={sheetUrl}
                  onChange={handleSheetUrlChange}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                />
                {isConnected ? (
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={handleDisconnectSheet}
                    disabled={syncing}
                  >
                    <X className="size-4" aria-hidden /> Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={handleConnectSheet}
                    disabled={!canConnect || syncing}
                  >
                    <FileSpreadsheet className="size-4" aria-hidden />
                    {syncing ? "Connecting..." : "Link Sheet"}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Paste the full browser link or sheet ID of the spreadsheet shared with your Gmail.
              </p>
            </div>

            {/* Connected Details */}
            {isConnected && (
              <div className="mt-4 rounded-lg border border-border bg-background p-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="label-xs">Sheet Name</p>
                    <p className="font-medium text-sm text-foreground truncate mt-0.5">
                      {sheetTitle || "Google Sheet"}
                    </p>
                  </div>
                  <div>
                    <p className="label-xs">Your Permission</p>
                    <div className="mt-0.5">
                      {sheetRole === "edit" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <Edit3 className="size-3" /> Editor · Can view and edit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Eye className="size-3" /> Viewer · Read-only access
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="label-xs">Connected Account</p>
                    <p className="font-medium text-xs text-foreground truncate mt-0.5">
                      {connectedEmail || "Google Account"}
                    </p>
                  </div>
                  <div>
                    <p className="label-xs">Last Sync</p>
                    <p className="font-medium text-xs text-foreground mt-0.5">
                      {settings.last_sync_time
                        ? format(new Date(settings.last_sync_time), "dd MMM yyyy, HH:mm")
                        : "Just now"}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnOutline}
                    onClick={handleSyncFromSheets}
                    disabled={syncing}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    {syncing ? "Syncing..." : "Sync from Sheets (Pull)"}
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={handleSyncToSheets}
                    disabled={syncing || isReadOnly}
                    title={isReadOnly ? "Viewer mode: You cannot edit this sheet" : undefined}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    {isReadOnly ? "Write Disabled (Viewer)" : syncing ? "Pushing..." : "Sync to Sheets (Push)"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>


      <p className="text-center text-xs text-muted-foreground">
        <Mail className="size-3 inline" aria-hidden /> Data never leaves this device. Stockly is
        offline-first.
      </p>
    </div>
  );
}
