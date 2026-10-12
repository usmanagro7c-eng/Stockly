import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-all"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            Privacy Policy
          </h1>
          <p className="text-xs text-muted-foreground">Last updated: October 2026</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-5 text-sm text-muted-foreground leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
          <p>
            Stockly (&quot;we&quot;, &quot;our&quot;, or &quot;app&quot;) is an inventory and profit tracking application. We respect your privacy and are committed to protecting your personal information and business records.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. Google Account Data &amp; Sheets Access</h2>
          <p>
            When you connect Stockly to your Google account, the application requests access to Google Sheets via Google OAuth scopes (specifically <code>https://www.googleapis.com/auth/spreadsheets</code> and <code>https://www.googleapis.com/auth/userinfo.email</code>).
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Purpose:</strong> We access your Google account solely to read and write your inventory, sales, purchases, and expenses data to your designated Google Sheet.</li>
            <li><strong>No Third-Party Sharing:</strong> We do not sell, rent, or share your Google user data or spreadsheet contents with any third parties or advertisers.</li>
            <li><strong>Data Storage:</strong> Data synchronized through Stockly is stored locally on your device via secure client-side storage (IndexedDB) and in your personal Google Sheet.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. Google API Limited Use Disclosure</h2>
          <p>
            Stockly&apos;s use and transfer of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. Data Retention and Revocation</h2>
          <p>
            You can revoke Stockly&apos;s access to your Google account at any time by clicking &quot;Disconnect&quot; or &quot;Sign Out&quot; in the Settings page of the app, or through your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Google Account Security settings
            </a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">5. Contact Information</h2>
          <p>
            If you have any questions or inquiries regarding this Privacy Policy, please contact us at:{" "}
            <a href="mailto:usman.agro7c@gmail.com" className="text-primary font-medium">
              usman.agro7c@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
