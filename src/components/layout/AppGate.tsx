import { Delete, Loader2, LockKeyhole, RefreshCw, Sparkles, Store } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useStockStore } from "@/store/stockStore";
import { generateDeviceId } from "@/services/ids";
import { verifyPin } from "@/services/security";
import { inputClass, btnPrimary } from "@/components/common/ui-bits";
import { StocklyLogo } from "@/components/common/StocklyLogo";
import { cn } from "@/lib/utils";

/**
 * Boots the offline database, runs first-launch setup and the PIN lock
 * screen before rendering the application.
 */
const INIT_TIMEOUT_MS = 12_000;

export function AppGate({ children }: { children: ReactNode }) {
  const init = useStockStore((s) => s.init);
  const ready = useStockStore((s) => s.ready);
  const locked = useStockStore((s) => s.locked);
  const settings = useStockStore((s) => s.settings);

  const [attempt, setAttempt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTimedOut(false);

    const timer = setTimeout(() => {
      if (!cancelled) setTimedOut(true);
    }, INIT_TIMEOUT_MS);

    void init().finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [init, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!ready) {
    if (timedOut) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm font-medium">Stockly could not open its local database.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This usually means the app's storage is unavailable on this device. Close and reopen the
            app; if it keeps failing, clear the app storage in Android settings.
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 transition-all"
          >
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="relative flex size-20 items-center justify-center">
          <StocklyLogo className="size-full animate-pulse" />
        </div>
        <p className="text-xs font-semibold text-muted-foreground">Loading Stockly...</p>
      </div>
    );
  }

  if (!settings.user_name) return <SetupScreen />;
  if (locked) return <PinLockScreen />;

  return <>{children}</>;
}

function SetupScreen() {
  const updateSettings = useStockStore((s) => s.updateSettings);
  const deviceId = useStockStore((s) => s.settings.device_id);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [id] = useState(() => deviceId || generateDeviceId());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name to continue");
      return;
    }
    await updateSettings({ user_name: name.trim(), device_id: id });
    toast.success("Welcome to Stockly!");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="surface w-full max-w-md p-6 sm:p-8 shadow-pop border-border/80">
        <div className="flex size-16 items-center justify-center mb-4">
          <StocklyLogo className="size-full" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Set up Stockly</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome! Offline-first inventory and profit manager. All data is saved on this device.
        </p>

        <div className="mt-6 space-y-1.5">
          <label htmlFor="setup-name" className="label-xs block font-semibold text-muted-foreground">
            Your Name / Store Name <span className="text-destructive font-bold">*</span>
          </label>
          <input
            id="setup-name"
            className={inputClass}
            inputMode="text"
            enterKeyHint="done"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="e.g. Usman Amjad"
          />
          {error && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-border/70 bg-elevated/70 p-3">
          <p className="label-xs text-muted-foreground">Assigned Device ID</p>
          <p className="num mt-1 text-xs font-mono font-semibold text-foreground truncate">{id}</p>
        </div>

        <button
          type="submit"
          className="mt-6 min-h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90 active:scale-98"
        >
          Get Started
        </button>
      </form>
    </div>
  );
}

function PinLockScreen() {
  const unlock = useStockStore((s) => s.unlock);
  const hash = useStockStore((s) => s.settings.pin_code_hash);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const submit = async (value: string) => {
    if (await verifyPin(value, hash)) {
      setError(false);
      unlock();
    } else {
      setError(true);
      setPin("");
    }
  };

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(false), 600);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 6 ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter") setPin((p) => (p.length >= 4 ? (void submit(p), p) : p));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hash]);

  const press = (digit: string) => setPin((p) => (p.length < 6 ? p + digit : p));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10 select-none">
      <div className="relative flex size-20 items-center justify-center mb-3">
        <StocklyLogo className="size-full" />
      </div>
      <h1 className="mt-2 text-xl font-bold tracking-tight text-foreground">Enter your PIN</h1>
      <p className="mt-1 text-sm text-muted-foreground">Stockly is locked for your security.</p>

      {/* PIN dots */}
      <div className={cn("mt-6 flex gap-3.5", error && "animate-shake")}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border transition-all duration-150",
              i < pin.length
                ? "border-primary bg-primary scale-110 shadow-xs shadow-primary/50"
                : "border-border/80 bg-muted/60",
            )}
          />
        ))}
      </div>
      <p className="mt-2.5 h-5 text-xs font-semibold text-destructive" role="alert">
        {error ? "Incorrect PIN. Please try again." : ""}
      </p>

      {/* Numeric Touch Keypad (Ergonomic for Android APK & Mobile touch) */}
      <div className="mt-3 grid w-full max-w-xs grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="num min-h-14 rounded-2xl border border-border/80 bg-elevated/80 text-xl font-bold text-foreground active:scale-95 active:bg-accent transition-all shadow-xs"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          aria-label="Backspace"
          className="flex min-h-14 items-center justify-center rounded-2xl border border-border/80 bg-elevated/80 active:scale-95 active:bg-accent transition-all shadow-xs text-muted-foreground hover:text-foreground"
        >
          <Delete className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => press("0")}
          className="num min-h-14 rounded-2xl border border-border/80 bg-elevated/80 text-xl font-bold text-foreground active:scale-95 active:bg-accent transition-all shadow-xs"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => void submit(pin)}
          disabled={pin.length < 4}
          aria-label="Unlock"
          className="min-h-14 rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-30 active:scale-95 transition-all shadow-sm shadow-primary/25"
        >
          OK
        </button>
      </div>
    </div>
  );
}
