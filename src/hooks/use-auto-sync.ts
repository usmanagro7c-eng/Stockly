import { useEffect, useRef } from "react";
import { syncManager } from "@/services/sync-manager";
import { useStockStore } from "@/store/stockStore";

const PULL_INTERVAL_MS = 60_000;
/** App resume fires visibilitychange immediately; coalesce the burst. */
const VISIBILITY_DEBOUNCE_MS = 3_000;

/**
 * Keeps the local database in sync with the linked Google Sheet while the app
 * is open and online: a periodic pull, an immediate pull when the browser
 * comes back online, a pull when the tab regains focus, and a one-time role
 * refresh on mount. Viewers only pull; editors also push on local changes.
 */
export function useAutoSync() {
  const inFlight = useRef(false);

  useEffect(() => {
    useStockStore
      .getState()
      .refreshSheetPermission()
      .catch(() => undefined);

    /**
     * Only ever one pull at a time. A single pass costs several HTTP round
     * trips plus a full rewrite of the local database; letting a timer, the
     * `online` event and a tab-resume overlap used to queue those Dexie
     * transactions back to back, which locked up the UI on mobile.
     */
    const pull = async () => {
      if (inFlight.current) return;
      const { sheetRole, syncFromGoogleSheets } = useStockStore.getState();
      if (!syncManager.isConnected() || sheetRole === null) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      inFlight.current = true;
      try {
        // Automatic pulls stay out of the changelog; they would otherwise add
        // a row every minute forever.
        await syncFromGoogleSheets(false);
      } catch (error) {
        // Quiet on transient failures; next interval will retry.
        if (typeof console !== "undefined") {
          console.warn("Auto-sync pull failed:", error);
        }
      } finally {
        inFlight.current = false;
      }
    };

    let visibilityTimer: ReturnType<typeof setTimeout> | null = null;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (visibilityTimer) clearTimeout(visibilityTimer);
      visibilityTimer = setTimeout(() => {
        visibilityTimer = null;
        void pull();
      }, VISIBILITY_DEBOUNCE_MS);
    };

    const interval = setInterval(() => void pull(), PULL_INTERVAL_MS);
    const onOnline = () => void pull();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      if (visibilityTimer) clearTimeout(visibilityTimer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
