import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const LAST_UPDATED = "June 21, 2026";

const sections = [
  {
    id: "introduction",
    title: "1. Introduction",
    content: `ContextOS ("we", "our", or "us") operates the website https://www.usecontextos.com and the ContextOS browser extension (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our Service.

By using ContextOS, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use the Service.`,
  },
  {
    id: "information-we-collect",
    title: "2. Information We Collect",
    content: `We collect the following types of information:

Account Information
When you sign up, we collect your name and email address through our authentication provider (Clerk). If you sign in with Google, we receive your name, email, and profile picture from Google.

User-Generated Content
We store the memories, projects, prompts, and notes you create within ContextOS. This content is stored to provide the core functionality of the Service.

API Keys
We store hashed API keys that you generate to connect the extension and third-party tools to your account. The full key is shown only once and never stored in plain text.

Technical Information
We may collect device type, browser type, and general usage patterns to improve the Service. We do not collect IP addresses for tracking purposes.`,
  },
  {
    id: "how-we-use",
    title: "3. How We Use Your Information",
    content: `We use the information we collect to:

• Provide, operate, and maintain the ContextOS Service
• Inject your saved context into AI tools you connect (ChatGPT, Claude, Gemini, Perplexity, Grok, and others)
• Authenticate your identity and manage your session
• Send transactional emails (account verification, billing receipts)
• Process payments and manage your subscription
• Respond to support requests
• Improve and debug the Service

We do not use your data for advertising, and we never sell your personal information to third parties.`,
  },
  {
    id: "ai-services",
    title: "4. AI Services and Third-Party Providers",
    content: `ContextOS integrates with the following third-party services to deliver its functionality:

Clerk (Authentication)
We use Clerk to handle user authentication, including Google OAuth sign-in. Clerk stores your email address and manages session tokens. Clerk's privacy policy is available at https://clerk.com/privacy.

Supabase (Database)
Your memories, projects, and account data are stored in Supabase's PostgreSQL database, hosted on AWS infrastructure. Supabase's privacy policy is available at https://supabase.com/privacy.

Razorpay (Payments)
Subscription payments are processed by Razorpay. We never store your credit or debit card details — all payment information is handled directly by Razorpay. Razorpay's privacy policy is available at https://razorpay.com/privacy/.

AI Platforms (ChatGPT, Claude, Gemini, etc.)
ContextOS injects your saved context into AI platforms you use. We do not transmit your data to these platforms — the extension injects your content locally within your browser session only.

We do not share your personal data with any other third parties except as required by law.`,
  },
  {
    id: "extension-permissions",
    title: "5. Browser Extension Permissions",
    content: `The ContextOS Chrome extension requests the following permissions, each of which is necessary for the Service to function:

storage
Used to save your API key and preferences locally in your browser so you stay connected between sessions.

tabs
Used to detect which AI platform (ChatGPT, Claude, Gemini, etc.) you are currently using so the extension can activate on supported pages.

activeTab
Used to interact with the currently active tab to inject your saved context into AI chat interfaces.

scripting
Used to run the content scripts that display the ContextOS suggestion panel and auto-inject context into AI platforms.

contextMenus
Used to provide a right-click menu option to save selected text as a memory directly from any webpage.

The extension does not read your browsing history, access pages unrelated to AI platforms you actively open, or transmit any data without your action.`,
  },
  {
    id: "data-storage",
    title: "6. Data Storage and Security",
    content: `Your data is stored in Supabase's PostgreSQL database, hosted on AWS in the US region. We implement the following security measures:

• All data in transit is encrypted using TLS (HTTPS)
• API keys are stored as SHA-256 hashes — the plain-text key is never stored
• Authentication tokens are managed by Clerk using industry-standard JWT practices
• Database access is restricted to authenticated backend services only
• We use row-level security (RLS) policies to ensure users can only access their own data

While we take security seriously and implement reasonable precautions, no method of transmission over the internet is 100% secure. We encourage you to use a strong password and keep your API keys confidential.`,
  },
  {
    id: "cookies",
    title: "7. Cookies and Analytics",
    content: `ContextOS uses only essential cookies required for the Service to function:

Session Cookies
Managed by Clerk to keep you signed in during your session. These are necessary for authentication and cannot be disabled while using the Service.

We do not use:
• Advertising or tracking cookies
• Third-party analytics platforms (e.g. Google Analytics)
• Fingerprinting or cross-site tracking

We do not display advertisements and do not allow advertisers to track users through our Service.`,
  },
  {
    id: "user-rights",
    title: "8. Your Rights",
    content: `You have the following rights regarding your personal data:

Access
You can view all your memories and projects at any time from your ContextOS dashboard.

Correction
You can edit or update your memories and profile information directly within the Service.

Deletion
You can delete individual memories, projects, and API keys at any time. To delete your entire account and all associated data, go to Settings → Delete Account, or contact us at support@usecontextos.com.

Data Export
You can download a backup of your data from Settings → Download Backup at any time.

Portability
Your data export is provided in a standard format you can take with you.

If you are located in the European Economic Area (EEA), you may have additional rights under the GDPR. Please contact us to exercise these rights.`,
  },
  {
    id: "data-retention",
    title: "9. Data Retention",
    content: `We retain your data for as long as your account is active. If you delete your account, we permanently delete all associated data within 30 days.

If your subscription expires, your account enters a grace period. During this period your data is preserved but access is limited. After the grace period, your data may be purged in accordance with the plan limits. You can download a backup at any time during this period.

Anonymized, aggregated data (e.g. total number of users) may be retained indefinitely for business analytics purposes.`,
  },
  {
    id: "children",
    title: "10. Children's Privacy",
    content: `ContextOS is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at support@usecontextos.com and we will delete it promptly.

If you are between 13 and 18, please review this policy with a parent or guardian before using the Service.`,
  },
  {
    id: "changes",
    title: "11. Changes to This Privacy Policy",
    content: `We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page and, for significant changes, notify you by email or by a prominent notice on the Service.

We encourage you to review this page periodically. Your continued use of ContextOS after changes are posted constitutes your acceptance of the updated policy.`,
  },
  {
    id: "contact",
    title: "12. Contact Information",
    content: `If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your data, please contact us:

Email: support@usecontextos.com
Website: https://www.usecontextos.com

We aim to respond to all privacy-related inquiries within 5 business days.`,
  },
];

export function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-surface-0 text-foreground">
      {/* SEO */}
      <title>Privacy Policy — ContextOS</title>

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-surface-0/80 backdrop-blur-xl pt-safe px-safe">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo_mark.png" alt="ContextOS" className="h-7 w-7 rounded-md" />
            <span className="text-sm font-semibold">ContextOS</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-[calc(7rem+var(--safe-top))] pb-10 px-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15">
          <Shield className="h-6 w-6 text-brand-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm">Last Updated: {LAST_UPDATED}</p>
      </div>

      {/* Table of contents + content */}
      <div className="mx-auto max-w-4xl px-6 pb-24 flex gap-10">

        {/* TOC — desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contents</p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-1 leading-snug"
              >
                {s.title}
              </a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-10">
          {/* Intro banner */}
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-5 py-4 text-sm text-muted-foreground leading-relaxed">
            Your privacy matters to us. ContextOS does not sell your data, does not show you ads, and only uses your information to provide the Service. This policy explains exactly what we collect and why.
          </div>

          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-foreground mb-3">{s.title}</h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {s.content}
              </div>
              <div className="mt-6 border-b border-border" />
            </section>
          ))}

          <p className="text-xs text-muted-foreground pt-4">
            © {new Date().getFullYear()} ContextOS. All rights reserved.
          </p>
        </main>
      </div>
    </div>
  );
}
