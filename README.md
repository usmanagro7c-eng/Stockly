# Stockly

Stockly is an offline-first inventory, sales and profit manager for small retail shops. It tracks purchases, sales, stock, adjustments and profit, and can sync data to Google Sheets.

## Tech Stack

- TanStack Start (React + SSR)
- TypeScript
- Tailwind CSS
- Dexie (IndexedDB persistence)
- Capacitor (Android & iOS)

## Development

You need Node.js and npm (or bun).

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

The dev server runs at http://localhost:8080.

## Google Sheets Sync

Google Sheets sync uses Google Identity Services. To enable it:

1. Create an OAuth 2.0 Client ID in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add an **Authorized JavaScript origin** for every URL you open the app from (e.g. `http://localhost:8080`, your production domain). Origins must match exactly with no trailing slash.
3. Enable the **Google Sheets API** for the project.
4. Set the Client ID in your environment:

   ```sh
   VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
   ```

For native Android/iOS builds, register additional OAuth clients (Android: package name + SHA-1; iOS: bundle ID) in the same Google Cloud project.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript type checking
- `npm run test` — run tests

## Native Builds

```sh
npm run cap:sync
npm run cap:open:android
npm run cap:open:ios
```
