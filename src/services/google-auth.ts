/** Google Sheets authentication service (Google Identity Services + Capacitor native) */
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

const CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"] || "";
const PLACEHOLDER = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

/** Interactive sign-in: long enough for a real consent flow, short enough to fail visibly. */
const AUTH_TIMEOUT_MS = 45_000;
/** Silent (`prompt: "none"`) renewal only needs a round trip. */
const SILENT_RENEWAL_TIMEOUT_MS = 5_000;

const OAUTH_CONFIG = {
  clientId: CLIENT_ID && CLIENT_ID !== PLACEHOLDER ? CLIENT_ID : "",
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
};

function assertClientConfigured(): void {
  if (!OAUTH_CONFIG.clientId) {
    throw new Error(
      "Google Sheets sync is not configured — add your Client ID (VITE_GOOGLE_CLIENT_ID) to the .env file.",
    );
  }
}

export function isNativePlatform(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

let oauthInstance: google.accounts.oauth2.TokenClient | null = null;

/**
 * Queue of waiters for the single Google token callback channel.
 *
 * A single-slot callback meant a background silent renewal (`getAccessToken`,
 * fired by every sync tick) could clobber an interactive sign-in in flight —
 * the sign-in promise could then only settle by waiting out its full timeout,
 * which pinned the UI in a "syncing" state. A queue means whichever waiter
 * registered first receives the next token response, and every waiter is
 * settled on timeout so nothing is left hanging.
 */
let pendingCallbacks: ((token: string) => void)[] = [];

/** Hand the next token response to the longest-waiting consumer. */
function takeNextCallback(): ((token: string) => void) | null {
  return pendingCallbacks.shift() ?? null;
}

/** Settle every queued waiter with `token` and empty the queue. */
function drainCallbacks(token: string): void {
  const waiters = pendingCallbacks;
  pendingCallbacks = [];
  for (const waiter of waiters) waiter(token);
}

export interface AuthState {
  isAuthenticated: boolean;
  hasToken: boolean;
  email: string | null;
}

function readLocal(key: string): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
}

function writeLocal(key: string, value: string): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
}

export function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== "undefined") {
      resolve();
      return;
    }
    if (typeof document === "undefined") {
      reject(new Error("Google Identity Services is only available in the browser"));
      return;
    }
    const existing = document.getElementById("gsi-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services")),
      );
      return;
    }
    const script = document.createElement("script");
    script.id = "gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

/** Initialize the native Google Sign-In plugin (Capacitor) once. */
async function initializeNative(): Promise<void> {
  await GoogleSignIn.initialize({
    clientId: OAUTH_CONFIG.clientId,
    scopes: OAUTH_CONFIG.scopes,
  });
}

export async function initializeOAuth(): Promise<AuthState> {
  if (isNativePlatform()) {
    await initializeNative();
    return {
      isAuthenticated: readLocal("googleSheetToken") !== null,
      hasToken: readLocal("googleSheetToken") !== null,
      email: readLocal("googleSheetEmail"),
    };
  }

  await loadGoogleIdentityScript();
  if (!google || !google.accounts?.oauth2) {
    throw new Error("Google OAuth is not available. Check your Google Client ID in the .env file.");
  }
  if (!oauthInstance) {
    oauthInstance = google.accounts.oauth2.initTokenClient({
      client_id: OAUTH_CONFIG.clientId,
      scope: OAUTH_CONFIG.scopes.join(" "),
      callback: (response: google.accounts.oauth2.TokenResponse) => {
        if (response?.access_token) {
          writeLocal("googleSheetToken", response.access_token);
        }
        // Settle everyone: a silent renewal and an interactive sign-in that
        // were both waiting can share one response without either hanging.
        drainCallbacks(response?.access_token || "");
      },
    });
  }
  return {
    isAuthenticated: readLocal("googleSheetToken") !== null,
    hasToken: readLocal("googleSheetToken") !== null,
    email: readLocal("googleSheetEmail"),
  };
}

export async function authenticate(): Promise<AuthState> {
  assertClientConfigured();
  await initializeOAuth();

  if (isNativePlatform()) {
    try {
      const result = await GoogleSignIn.signIn();
      if (!result.accessToken) {
        throw new Error("Google authentication failed — no access token received");
      }
      writeLocal("googleSheetToken", result.accessToken);
      writeLocal("googleSheetEmail", result.email ?? "");
      return { isAuthenticated: true, hasToken: true, email: result.email };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "SIGN_IN_CANCELED"
      ) {
        throw new Error("Google sign-in was canceled");
      }
      throw error instanceof Error ? error : new Error("Google sign-in failed");
    }
  }

  if (!oauthInstance) {
    throw new Error("Google OAuth was not initialized");
  }

  const token = await new Promise<string>((resolve, reject) => {
    const waiter = (t: string) => {
      clearTimeout(timeout);
      if (!t) reject(new Error("Google authentication failed"));
      else resolve(t);
    };

    const timeout = setTimeout(() => {
      const i = pendingCallbacks.indexOf(waiter);
      if (i !== -1) pendingCallbacks.splice(i, 1);
      reject(new Error("Google authentication timed out"));
    }, AUTH_TIMEOUT_MS);

    pendingCallbacks.push(waiter);

    try {
      oauthInstance!.requestAccessToken({ prompt: "consent" });
    } catch (error) {
      clearTimeout(timeout);
      const i = pendingCallbacks.indexOf(waiter);
      if (i !== -1) pendingCallbacks.splice(i, 1);
      reject(error instanceof Error ? error : new Error("Google authentication failed"));
    }
  });

  writeLocal("googleSheetToken", token);

  let email: string | null = null;
  try {
    const me = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (me.ok) {
      const data = (await me.json()) as { email?: string };
      email = data.email ?? null;
      writeLocal("googleSheetEmail", email ?? "");
    }
  } catch {
    // email is optional; ignore failures
  }

  return { isAuthenticated: true, hasToken: true, email };
}

/**
 * Return a valid access token for the Sheets API. On web, tries a silent
 * (`prompt: ""`) renewal so live sync survives token expiry; falls back to
 * the stored token. On native, returns the token from the last sign-in.
 */
export async function getAccessToken(): Promise<string | null> {
  const stored = readLocal("googleSheetToken");
  if (isNativePlatform()) return stored;

  if (typeof window === "undefined" || typeof google === "undefined" || !oauthInstance) {
    return stored;
  }

  return new Promise<string | null>((resolve) => {
    const waiter = (t: string) => {
      clearTimeout(timer);
      resolve(t || stored);
    };

    // Falls back to the stored token so a failed or silently-declined renewal
    // degrades to "keep using what we have" instead of stalling the sync.
    const timer = setTimeout(() => {
      const i = pendingCallbacks.indexOf(waiter);
      if (i !== -1) pendingCallbacks.splice(i, 1);
      resolve(stored);
    }, SILENT_RENEWAL_TIMEOUT_MS);

    pendingCallbacks.push(waiter);

    try {
      oauthInstance!.requestAccessToken({ prompt: "none" });
    } catch {
      clearTimeout(timer);
      const i = pendingCallbacks.indexOf(waiter);
      if (i !== -1) pendingCallbacks.splice(i, 1);
      resolve(stored);
    }
  });
}

export async function revokeAccess(): Promise<void> {
  if (isNativePlatform()) {
    try {
      await GoogleSignIn.signOut();
    } catch (error) {
      console.error("Failed to sign out of Google:", error);
    }
  } else {
    const token = readLocal("googleSheetToken");
    if (token && typeof google !== "undefined" && google.accounts?.oauth2) {
      try {
        google.accounts.oauth2.revoke(token, () => {
          console.log("Google access revoked");
        });
      } catch (error) {
        console.error("Failed to revoke access:", error);
      }
    }
  }

  clearGoogleSheetData();
}

export function isAuthenticated(): boolean {
  return readLocal("googleSheetToken") !== null;
}

export function getGoogleSheetId(): string | null {
  return readLocal("googleSheetId");
}

export function getGoogleEmail(): string | null {
  return readLocal("googleSheetEmail");
}

export function setGoogleSheetData(token: string, email: string, sheetId: string): void {
  writeLocal("googleSheetToken", token);
  writeLocal("googleSheetEmail", email);
  writeLocal("googleSheetId", sheetId);
  writeLocal("googleLastSync", new Date().toISOString());
}

export function clearGoogleSheetData(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("googleSheetToken");
  localStorage.removeItem("googleSheetEmail");
  localStorage.removeItem("googleSheetId");
  localStorage.removeItem("googleLastSync");
}
