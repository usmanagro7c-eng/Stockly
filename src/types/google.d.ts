/**
 * Type declarations for the Google Identity Services library
 * loaded via https://accounts.google.com/gsi/client.
 */
declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }
      interface TokenClient {
        requestAccessToken(options?: { prompt?: "consent" | "select_account" | "none" }): void;
      }
      interface TokenResponse {
        access_token?: string;
        scope?: string;
        expires_in?: number;
        token_type?: string;
        error?: string;
        error_description?: string;
        error_uri?: string;
      }
      function initTokenClient(config: TokenClientConfig): TokenClient;
      function revoke(accessToken: string, done: () => void): void;
    }
  }
}

interface Window {
  google?: typeof google;
}
