import { Link } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";

/**
 * Public account-deletion page — the URL submitted to the Google Play Console's
 * Data Safety "account deletion" field, so it must be reachable without signing in.
 * Explains what gets deleted, how to do it, and the fallback for users who can no
 * longer sign in.
 */
export function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ContextOS
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Trash2 className="h-6 w-6 text-red-600" />
          <h1 className="text-2xl font-bold">Delete your ContextOS account</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-10">
          Applies to ContextOS on the web, the Android app, and the browser extension.
        </p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">How to delete your account</h2>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>
                Sign in and open{" "}
                <Link to="/settings" className="text-green-700 underline underline-offset-2">
                  Settings
                </Link>
                .
              </li>
              <li>Scroll to the <strong className="text-foreground">Delete Account</strong> section.</li>
              <li>
                Tap <strong className="text-foreground">Delete my account…</strong>, type{" "}
                <code className="px-1 rounded bg-surface-2">DELETE</code> to confirm, and confirm the deletion.
              </li>
            </ol>
            <p className="mt-2 text-muted-foreground">
              If you can no longer sign in, email{" "}
              <a href="mailto:support@usecontextos.com" className="text-green-700 underline underline-offset-2">
                support@usecontextos.com
              </a>{" "}
              from the address on your account and we will delete it for you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">What is deleted</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Your account profile (name, email) and sign-in identity</li>
              <li>All memories, notes, and documents you saved</li>
              <li>All projects and their context</li>
              <li>API keys and connected devices (including push-notification tokens)</li>
              <li>Teams you own, and your membership in other teams</li>
              <li>Support tickets and notification history</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">What is retained</h2>
            <p className="text-muted-foreground">
              Payment and subscription records are retained where required for legal, tax, and
              accounting purposes. These records contain no profile information or saved content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Processing time</h2>
            <p className="text-muted-foreground">
              In-app deletion is immediate. Residual copies in encrypted backups are purged within
              30 days. Email requests are processed within 7 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Questions</h2>
            <p className="text-muted-foreground">
              Contact{" "}
              <a href="mailto:support@usecontextos.com" className="text-green-700 underline underline-offset-2">
                support@usecontextos.com
              </a>
              . See also our{" "}
              <Link to="/privacy" className="text-green-700 underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
