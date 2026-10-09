import { Delete, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useStockStore } from "@/store/stockStore";
import { generateDeviceId } from "@/services/ids";
import { verifyPin } from "@/services/security";
import { inputClass } from "@/components/common/ui-bits";
import { cn } from "@/lib/utils";

/**
 * Boots the offline database, runs first-launch setup and the PIN lock
 * screen before rendering the application.
 */
/**
 * A blocked IndexedDB request never settles, so waiting on `init()` alone could
 * leave the app on its spinner forever with no way out. Give it a deadline and
 * offer a retry.
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
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading Stockly" />
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
      <form onSubmit={submit} className="surface w-full max-w-md p-6">
        <h1 className="text-xl font-semibold tracking-tight">Set up Stockly</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your data stays on this device. Tell us who is using it.
        </p>
        <div className="mt-5 space-y-1.5">
          <label htmlFor="setup-name" className="label-xs block">
            Your name <span className="text-destructive">*</span>
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
            placeholder="e.g. Usman"
          />
          {error ? (
            <p className="text-xs font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-4 rounded-lg border border-border bg-elevated p-3">
          <p className="label-xs">Device ID</p>
          <p className="num mt-1 text-sm font-medium">{id}</p>
        </div>
        <button
          type="submit"
          className="mt-6 min-h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Continue
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

  // Clear the error shake after a beat; cleaned up on unmount.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const press = (digit: string) => setPin((p) => (p.length < 6 ? p + digit : p));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
        <LockKeyhole className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold">Enter your PIN</h1>
      <p className="mt-1 text-sm text-muted-foreground">Stockly is locked for your protection.</p>

      <div className={cn("mt-6 flex gap-3", error && "animate-shake")}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3 rounded-full border",
              i < pin.length ? "border-primary bg-primary" : "border-border bg-muted",
            )}
          />
        ))}
      </div>
      <p className="mt-3 h-5 text-sm font-medium text-destructive" role="alert">
        {error ? "Wrong PIN. Try again." : ""}
      </p>

      <div className="mt-4 grid w-full max-w-xs grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="num min-h-14 rounded-xl border border-border bg-elevated text-lg font-semibold active:bg-accent"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          aria-label="Backspace"
          className="flex min-h-14 items-center justify-center rounded-xl border border-border bg-elevated active:bg-accent"
        >
          <Delete className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => press("0")}
          className="num min-h-14 rounded-xl border border-border bg-elevated text-lg font-semibold active:bg-accent"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => void submit(pin)}
          disabled={pin.length < 4}
          aria-label="Enter"
          className="min-h-14 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
