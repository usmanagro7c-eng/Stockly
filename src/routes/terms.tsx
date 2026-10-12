import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
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
            <FileText className="size-6 text-primary" />
            Terms of Service
          </h1>
          <p className="text-xs text-muted-foreground">Last updated: October 2026</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-5 text-sm text-muted-foreground leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Stockly, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. Description of Service</h2>
          <p>
            Stockly provides inventory management, sales tracking, point-of-sale recording, and Google Sheets synchronization tools for businesses and individuals.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. User Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials, security PINs, and the accuracy of the financial and inventory data you input into the system.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. Google Sheets Integration</h2>
          <p>
            Stockly allows synchronization with Google Sheets. You are responsible for ensuring that your Google account and spreadsheet permissions are configured according to your organization&apos;s data security policies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">5. Disclaimer of Warranties</h2>
          <p>
            The service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">6. Contact</h2>
          <p>
            For any inquiries regarding these terms, please contact us at:{" "}
            <a href="mailto:usman.agro7c@gmail.com" className="text-primary font-medium">
              usman.agro7c@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
