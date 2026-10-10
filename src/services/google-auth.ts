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

/** Result delivered to every queued OAuth waiter: a token, or the reason it failed. */
interface TokenResult {
  token?: string;
  error?: string;
  errorDescription?: string;
}

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
let pendingCallbacks: ((result: TokenResult) => void)[] = [];

/** Settle every queued waiter with `result` and empty the queue. */
function drainCallbacks(result: TokenResult): void {
  const waiters = pendingCallbacks;
  pendingCallbacks = [];
  for (const waiter of waiters) waiter(result);
}

/**
 * Turn a Google OAuth error code into an actionable message. Most failures
 * here are configuration mistakes in Google Cloud Console, so point at the
 * exact fix instead of a generic "authentication failed".
 */
function describeGoogleAuthError(result: TokenResult): string {
  const origin =
    typeof window !== "undefined" && window.location ? window.location.origin : "your app origin";
  switch (result.error) {
    case "origin_mismatch":
      return `Google blocked this app: the origin "${origin}" is not registered. Add it under "Authorized JavaScript origins" for this OAuth Client ID in Google Cloud Console (https://console.cloud.google.com/apis/credentials), then retry.`;
    case "access_denied":
      return "Google sign-in was canceled";
    case "invalid_client":
      return "Google rejected the Client ID. Check VITE_GOOGLE_CLIENT_ID and the OAuth client type (Web application).";
    case "idpiframe_initialization_failed":
      return "Google Identity Services could not initialize. Ensure third-party cookies are allowed and the origin is registered in Google Cloud Console.";
    case undefined:
    case "":
      return "Google authentication failed — no access token received";
    default:
      return `Google authentication failed: ${result.errorDescription || result.error}`;
  }
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
          const expiresIn = Number(response.expires_in) || 3500;
          writeLocal("googleSheetTokenExpiresAt", String(Date.now() + expiresIn * 1000));
        }
        // Settle everyone: a silent renewal and an interactive sign-in that
        // were both waiting can share one response without either hanging.
        drainCallbacks({
          token: response?.access_token || undefined,
          error: response?.error,
          errorDescription: response?.error_description,
        });
      },
    });
  }
  return {
    isAuthenticated: isTokenValid(),
    hasToken: isTokenValid(),
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
    const waiter = (result: TokenResult) => {
      clearTimeout(timeout);
      if (!result.token) reject(new Error(describeGoogleAuthError(result)));
      else resolve(result.token);
    };

    const timeout = setTimeout(() => {
      const i = pendingCallbacks.indexOf(waiter);
      if (i !== -1) pendingCallbacks.splice(i, 1);
      const origin =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "your app origin";
      reject(
        new Error(
          `Google sign-in timed out. If Google showed an "Access blocked" or origin error, add "${origin}" under "Authorized JavaScript origins" for this OAuth Client ID in Google Cloud Console, then retry.`,
        ),
      );
    }, AUTH_TIMEOUT_MS);

    pendingCallbacks.push(waiter);

    try {
      oauthInstance!.requestAccessToken({ prompt: "select_account" });
    } catch (error) {
      clearTimeout(timeout);
      const i = pendingCallbacks.indexOf(waiter);
      if (i !== -1) pendingCallbacks.splice(i, 1);
      reject(error instanceof Error ? error : new Error("Google authentication failed"));
    }
  });

  writeLocal("googleSheetToken", token);
  writeLocal("googleSheetTokenExpiresAt", String(Date.now() + 3500 * 1000));

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
 * Attempt to acquire a fresh access token without prompting the user.
 * Works natively on Capacitor Android/iOS. On web, GIS token flow requires direct user interaction.
 */
export async function refreshAccessTokenSilently(): Promise<string | null> {
  if (isNativePlatform()) {
    try {
      const result = await GoogleSignIn.signIn();
      if (result.accessToken) {
        writeLocal("googleSheetToken", result.accessToken);
        writeLocal("googleSheetTokenExpiresAt", String(Date.now() + 3500 * 1000));
        if (result.email) writeLocal("googleSheetEmail", result.email);
        return result.accessToken;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function isTokenExpiringSoon(): boolean {
  const token = readLocal("googleSheetToken");
  if (!token) return true;
  const expiresAt = Number(readLocal("googleSheetTokenExpiresAt"));
  if (!expiresAt) return false;
  return Date.now() > expiresAt - 120_000;
}

/**
 * Return the stored access token for Google Sheets API requests.
 */
export async function getAccessToken(): Promise<string | null> {
  const stored = readLocal("googleSheetToken");
  if (!stored) return null;

  if (isNativePlatform()) {
    if (isTokenExpiringSoon()) {
      const refreshed = await refreshAccessTokenSilently().catch(() => null);
      if (refreshed) return refreshed;
    }
    return stored;
  }

  return stored;
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

export function isTokenValid(): boolean {
  const token = readLocal("googleSheetToken");
  if (!token) return false;
  const expiresAt = Number(readLocal("googleSheetTokenExpiresAt"));
  if (expiresAt && Date.now() > expiresAt) {
    return false;
  }
  return true;
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

export function getGoogleRole(): "edit" | "read" | null {
  const role = readLocal("googleSheetRole");
  return role === "edit" || role === "read" ? role : null;
}

export function setGoogleRole(role: "edit" | "read" | null): void {
  if (role) writeLocal("googleSheetRole", role);
  else if (typeof localStorage !== "undefined") localStorage.removeItem("googleSheetRole");
}

export function getGoogleSheetTitle(): string | null {
  return readLocal("googleSheetTitle");
}

export function setGoogleSheetTitle(title: string): void {
  writeLocal("googleSheetTitle", title);
}

export function setGoogleSheetData(token: string, email: string, sheetId: string): void {
  writeLocal("googleSheetToken", token);
  writeLocal("googleSheetTokenExpiresAt", String(Date.now() + 3500 * 1000));
  writeLocal("googleSheetEmail", email);
  writeLocal("googleSheetId", sheetId);
  writeLocal("googleLastSync", new Date().toISOString());
}

export function clearGoogleSheetData(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("googleSheetToken");
  localStorage.removeItem("googleSheetTokenExpiresAt");
  localStorage.removeItem("googleSheetEmail");
  localStorage.removeItem("googleSheetId");
  localStorage.removeItem("googleSheetTitle");
  localStorage.removeItem("googleSheetRole");
  localStorage.removeItem("googleLastSync");
}

