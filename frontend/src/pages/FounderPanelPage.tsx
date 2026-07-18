import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Bell, Megaphone, LifeBuoy, ScrollText, Loader2,
} from "lucide-react";
import {
  founderService, PLANS, DURATIONS, NOTIFICATION_TYPES, AUDIENCES, COMPENSATION_REASONS,
} from "@/services/founder.service";
import { usePlan } from "@/hooks/usePlan";

type Tab = "dashboard" | "users" | "notifications" | "banners" | "support" | "log";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "banners", label: "Banners", icon: Megaphone },
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "log", label: "Activity Log", icon: ScrollText },
];

function Card({ children, className = "" }: { children: any; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface-1 p-4 ${className}`}>{children}</div>;
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { founderService.dashboard().then(setD).catch(() => {}); }, []);
  if (!d) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Users" value={d.total_users} />
        <Stat label="Free" value={d.free_users} />
        <Stat label="Student" value={d.student_users} />
        <Stat label="Pro" value={d.pro_users} />
        <Stat label="Team" value={d.team_users} />
        <Stat label="Active Subs" value={d.active_subscriptions} />
        <Stat label="Expired Subs" value={d.expired_subscriptions} />
        <Stat label="Today's Signups" value={d.todays_signups} />
        <Stat label="Monthly Revenue" value={d.monthly_revenue_display} />
      </div>
      <Card>
        <p className="mb-2 text-sm font-semibold">Recent Payments</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="py-1 pr-3">Email</th><th className="pr-3">Amount</th><th className="pr-3">Plan</th><th className="pr-3">Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {d.recent_payments.map((p: any) => (
                <tr key={p.payment_id} className="border-t border-border">
                  <td className="py-1 pr-3">{p.email ?? "—"}</td>
                  <td className="pr-3">{p.amount_display}</td>
                  <td className="pr-3">{p.plan}</td>
                  <td className="pr-3">{p.status}</td>
                  <td>{new Date(p.date).toLocaleDateString()}</td>
                </tr>
              ))}
              {d.recent_payments.length === 0 && <tr><td colSpan={5} className="py-2 text-muted-foreground">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Users + grant/compensate ─────────────────────────────────────────────────
function UsersTab() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [plan, setPlan] = useState("pro");
  const [duration, setDuration] = useState("1m");
  const [mode, setMode] = useState("grant");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function search() {
    try { setRows(await founderService.searchUsers(q)); }
    catch { toast.error("Search failed"); }
  }
  async function loadDetail(id: string) {
    try { setSel(await founderService.userDetail(id)); } catch { toast.error("Load failed"); }
  }
  async function doGrant() {
    if (!sel) return;
    if (!reason.trim()) { toast.error("A reason is required"); return; }
    setBusy(true);
    try {
      await founderService.grant({ user_id: sel.user.user_id, plan, duration, reason, mode });
      toast.success("Applied");
      await loadDetail(sel.user.user_id);
      setReason("");
    } catch (e: any) { toast.error(e?.response?.data?.detail ?? "Failed"); }
    finally { setBusy(false); }
  }
  async function removeGrant(gid: string) {
    const r = prompt("Reason for removing this grant?");
    if (!r) return;
    try { await founderService.removeGrant(gid, r); toast.success("Removed"); await loadDetail(sel.user.user_id); }
    catch { toast.error("Failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search by email, name, or user ID"
          className="flex-1 rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm"
        />
        <button onClick={search} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Search</button>
      </div>

      {rows.length > 0 && (
        <Card>
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground"><tr><th className="py-1 pr-3">Email</th><th className="pr-3">Plan</th><th className="pr-3">Status</th><th className="pr-3">Expiry</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="py-1 pr-3">{u.email}</td>
                  <td className="pr-3">{u.plan}</td>
                  <td className="pr-3">{u.status}</td>
                  <td className="pr-3">{u.expiry ? new Date(u.expiry).toLocaleDateString() : "—"}</td>
                  <td><button onClick={() => loadDetail(u.user_id)} className="text-brand-500 hover:underline">Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {sel && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{sel.user.email}</p>
              <p className="text-xs text-muted-foreground">
                Plan: {sel.subscription?.plan ?? "free"} · Status: {sel.subscription?.status ?? "—"} ·
                Expiry: {sel.subscription?.expiry ? new Date(sel.subscription.expiry).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-lg border border-border bg-surface-0 px-2 py-2 text-sm">
              <option value="grant">Grant</option>
              <option value="extend">Extend</option>
              <option value="change">Change</option>
            </select>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-lg border border-border bg-surface-0 px-2 py-2 text-sm">
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="rounded-lg border border-border bg-surface-0 px-2 py-2 text-sm">
              {DURATIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <button onClick={doGrant} disabled={busy} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Applying…" : "Apply"}
            </button>
          </div>
          <input
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required) — e.g. Website bug, Beta reward"
            className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm"
            list="comp-reasons"
          />
          <datalist id="comp-reasons">{COMPENSATION_REASONS.map((r) => <option key={r} value={r} />)}</datalist>

          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Payment history</p>
            {sel.payments.length === 0 ? <p className="text-xs text-muted-foreground">No payments.</p> : (
              <ul className="text-xs">{sel.payments.map((p: any) => (
                <li key={p.payment_id} className="flex justify-between border-t border-border py-1">
                  <span>{p.amount_display} · {p.plan} · {p.status}</span>
                  <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString()}</span>
                </li>
              ))}</ul>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Previous manual grants</p>
            {sel.manual_grants.length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : (
              <ul className="text-xs">{sel.manual_grants.map((g: any) => (
                <li key={g.grant_id} className="flex items-center justify-between border-t border-border py-1">
                  <span>{g.plan} · {g.duration_days}d · {g.reason}{g.active ? "" : " (removed)"}</span>
                  {g.active && <button onClick={() => removeGrant(g.grant_id)} className="text-red-500 hover:underline">Remove</button>}
                </li>
              ))}</ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
function NotificationsTab() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ title: "", message: "", type: "announcement", audience: "everyone", delivery: "now", scheduled_at: "" });
  const load = () => founderService.listNotifications().then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  async function send() {
    if (!f.title.trim() || !f.message.trim()) { toast.error("Title and message required"); return; }
    try {
      await founderService.createNotification({ ...f, target_user_ids: [] });
      toast.success(f.delivery === "draft" ? "Saved draft" : f.delivery === "schedule" ? "Scheduled" : "Sent");
      setF({ ...f, title: "", message: "" }); load();
    } catch { toast.error("Failed"); }
  }
  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title" className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
        <textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Message" rows={3} className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="rounded-lg border border-border bg-surface-0 px-2 py-2 text-sm">
            {NOTIFICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} className="rounded-lg border border-border bg-surface-0 px-2 py-2 text-sm">
            {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={f.delivery} onChange={(e) => setF({ ...f, delivery: e.target.value })} className="rounded-lg border border-border bg-surface-0 px-2 py-2 text-sm">
            <option value="now">Send now</option><option value="schedule">Schedule</option><option value="draft">Save draft</option>
          </select>
          <button onClick={send} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">Submit</button>
        </div>
        {f.delivery === "schedule" && (
          <input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
        )}
      </Card>
      <Card>
        <p className="mb-2 text-sm font-semibold">Sent / scheduled / drafts</p>
        <ul className="text-xs">{list.map((n) => (
          <li key={n.id} className="border-t border-border py-1"><span className="font-medium">{n.title}</span> · {n.type} · {n.audience} · <span className="text-muted-foreground">{n.status}</span></li>
        ))}{list.length === 0 && <li className="py-1 text-muted-foreground">None yet.</li>}</ul>
      </Card>
    </div>
  );
}

// ── Banners ───────────────────────────────────────────────────────────────────
function BannersTab() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ title: "", message: "", button_text: "", button_url: "", audience: "everyone", start_date: "", end_date: "", enabled: true });
  const load = () => founderService.listBanners().then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  async function create() {
    if (!f.title.trim()) { toast.error("Title required"); return; }
    try { await founderService.createBanner(f); toast.success("Banner created"); setF({ ...f, title: "", message: "" }); load(); }
    catch { toast.error("Failed"); }
  }
  async function toggle(id: string, enabled: boolean) {
    try { await founderService.toggleBanner(id, enabled); load(); } catch { toast.error("Failed"); }
  }
  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title — e.g. 🚀 Mobile App is now available" className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
        <input value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Message" className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input value={f.button_text} onChange={(e) => setF({ ...f, button_text: e.target.value })} placeholder="Button text" className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
          <input value={f.button_url} onChange={(e) => setF({ ...f, button_url: e.target.value })} placeholder="Button URL" className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
          <input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
          <input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm" />
          <select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} className="rounded-lg border border-border bg-surface-0 px-2 py-2 text-sm">
            {AUDIENCES.filter((a) => a !== "selected").map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={create} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">Create banner</button>
        </div>
      </Card>
      <Card>
        <ul className="text-xs">{list.map((b) => (
          <li key={b.id} className="flex items-center justify-between border-t border-border py-1">
            <span><span className="font-medium">{b.title}</span> · {b.audience}</span>
            <button onClick={() => toggle(b.id, !b.enabled)} className={b.enabled ? "text-green-500" : "text-muted-foreground"}>{b.enabled ? "Enabled" : "Disabled"}</button>
          </li>
        ))}{list.length === 0 && <li className="py-1 text-muted-foreground">No banners.</li>}</ul>
      </Card>
    </div>
  );
}

// ── Support ───────────────────────────────────────────────────────────────────
function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const load = () => founderService.listTickets(filter || undefined).then(setTickets).catch(() => {});
  useEffect(() => { load(); }, [filter]);
  async function setStatus(id: string, status: string) {
    try { await founderService.updateTicket(id, status); toast.success("Updated"); load(); } catch { toast.error("Failed"); }
  }
  return (
    <div className="space-y-3">
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-border bg-surface-0 px-2 py-2 text-sm">
        <option value="">All</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option>
      </select>
      {tickets.map((t) => (
        <Card key={t.id} className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t.subject || "(no subject)"}</p>
            <span className="text-xs text-muted-foreground">{t.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t.email} · {new Date(t.created_at).toLocaleString()}</p>
          <p className="text-sm">{t.message}</p>
          <div className="flex gap-2 pt-1">
            {["open", "in_progress", "resolved"].map((s) => (
              <button key={s} onClick={() => setStatus(t.id, s)} className={`rounded-md px-2 py-1 text-xs ${t.status === s ? "bg-brand-600 text-white" : "border border-border"}`}>{s}</button>
            ))}
          </div>
        </Card>
      ))}
      {tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets.</p>}
    </div>
  );
}

// ── Activity log ──────────────────────────────────────────────────────────────
function LogTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { founderService.activityLog().then(setRows).catch(() => {}); }, []);
  return (
    <Card>
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground"><tr><th className="py-1 pr-3">Date</th><th className="pr-3">Action</th><th className="pr-3">Affected</th><th>Reason</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-1 pr-3">{new Date(r.date).toLocaleString()}</td>
              <td className="pr-3">{r.action}</td>
              <td className="pr-3">{r.affected_user ?? "—"}</td>
              <td>{r.reason}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">No actions logged yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

export function FounderPanelPage() {
  const { plan, isLoading } = usePlan();
  const [tab, setTab] = useState<Tab>("dashboard");

  // Frontend gate is a hint only — every founder API is verified server-side.
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (plan?.plan !== "founder") return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Founder Panel</h1>
        <p className="text-sm text-muted-foreground">Administration for founder accounts only.</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === key ? "border-brand-500 text-brand-500" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "users" && <UsersTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "banners" && <BannersTab />}
      {tab === "support" && <SupportTab />}
      {tab === "log" && <LogTab />}
    </div>
  );
}
