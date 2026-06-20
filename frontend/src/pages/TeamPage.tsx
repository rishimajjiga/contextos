import { useEffect, useState, useCallback } from "react";
import { Users, Copy, Check, Trash2, Crown, UserPlus, Mail, X, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { teamService, type Organization, type InviteResult } from "@/services/team.service";
import { useNavigate } from "react-router-dom";

export function TeamPage() {
  const [org, setOrg] = useState<Organization | null | undefined>(undefined);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [lastInvite, setLastInvite] = useState<InviteResult | null>(null);
  const [pendingInvites, setPendingInvites] = useState<InviteResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const navigate = useNavigate();

  const loadOrg = useCallback(async () => {
    try {
      const data = await teamService.getMyOrg();
      setOrg(data);
      setServerDown(false);
    } catch (err: any) {
      // Distinguish network/server errors from "no org yet"
      if (err?.code === "NETWORK_ERROR" || err?.status === 0 || err?.message?.includes("Network") || err?.message?.includes("fetch") || err?.message?.includes("ECONNREFUSED")) {
        setServerDown(true);
        setOrg(null);
      } else {
        setOrg(null);
      }
    }
  }, []);

  const loadPendingInvites = useCallback(async () => {
    try {
      const data = await teamService.getPendingInvites();
      setPendingInvites(data);
    } catch {
      setPendingInvites([]);
    }
  }, []);

  useEffect(() => { loadOrg(); }, [loadOrg]);

  useEffect(() => {
    if (org) loadPendingInvites();
  }, [org, loadPendingInvites]);

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const created = await teamService.createOrg(orgName.trim());
      setOrg(created);
    } catch (err: any) {
      if (err?.code === "TEAM_PLAN_REQUIRED") {
        setShowUpgrade(true);
      } else {
        setError(err?.message || "Failed to create team.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setError(null);
    setInviting(true);
    try {
      const result = await teamService.inviteMember(inviteEmail.trim());
      setLastInvite(result);
      setInviteEmail("");
      await loadPendingInvites();
    } catch (err: any) {
      setError(err?.message || "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberUserId: string) {
    if (!confirm("Remove this member from your team?")) return;
    try {
      await teamService.removeMember(memberUserId);
      setOrg((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.user_id !== memberUserId) } : prev
      );
    } catch (err: any) {
      setError(err?.message || "Failed to remove member.");
    }
  }

  async function handleRevoke(token: string) {
    if (!confirm("Revoke this invite? The link will no longer work.")) return;
    setRevokingToken(token);
    try {
      await teamService.revokeInvite(token);
      setPendingInvites((prev) => prev.filter((i) => i.token !== token));
      if (lastInvite?.token === token) setLastInvite(null);
    } catch (err: any) {
      setError(err?.message || "Failed to revoke invite.");
    } finally {
      setRevokingToken(null);
    }
  }

  function copyInviteLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function memberDisplay(m: { user_id: string; name: string; email: string; role: string }, isMe: boolean) {
    if (isMe) return "You";
    if (m.name) return m.name;
    if (m.email) return m.email;
    return m.user_id.slice(0, 12) + "...";
  }

  function memberSub(m: { name: string; email: string; role: string }, isMe: boolean) {
    if (isMe && m.email) return m.email;
    if (m.name && m.email) return m.email;
    return m.role;
  }

  if (org === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Invite teammates and share project context across your organization."
      />

      {/* Server down notice */}
      {serverDown && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Backend not reachable</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Make sure the backend server is running on port 8000, then{" "}
              <button
                className="underline font-medium"
                onClick={() => { setServerDown(false); loadOrg(); }}
              >
                retry
              </button>
              .
            </p>
          </div>
        </div>
      )}

      {showUpgrade && (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 text-center space-y-4">
          <div className="text-3xl">👥</div>
          <h3 className="text-lg font-semibold text-foreground">Team plan required</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Creating a team and inviting members requires the <strong>Team plan</strong>.
            Upgrade to share context with up to 5 teammates.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate("/plans")}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Upgrade to Team
            </button>
            <button
              onClick={() => setShowUpgrade(false)}
              className="px-5 py-2.5 border border-border hover:bg-surface-2 text-muted-foreground text-sm font-medium rounded-xl transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-3">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* No org yet */}
      {!org && !showUpgrade && !serverDown && (
        <Card>
          <CardHeader>
            <CardTitle>Create your team</CardTitle>
            <CardDescription>
              Give your team a name to get started. You can invite up to 5 members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="flex gap-3">
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Engineering"
                className="max-w-sm"
              />
              <Button type="submit" disabled={creating || !orgName.trim()}>
                {creating ? <LoadingSpinner size="sm" /> : "Create team"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Org exists */}
      {org && (
        <>
          {/* Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{org.name}</CardTitle>
                  <CardDescription>{org.members.length} / 5 seats used</CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">Team</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {org.members.map((m) => {
                const isMe = m.user_id === org.owner_user_id && m.role === "owner";
                return (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between rounded-lg border border-surface-2 bg-surface-1 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 shrink-0">
                        {m.role === "owner" ? (
                          <Crown className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {memberDisplay(m, isMe)}
                        </p>
                        <p className="text-xs text-text-secondary">{memberSub(m, isMe)}</p>
                      </div>
                    </div>
                    {m.role !== "owner" && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        className="text-text-tertiary hover:text-red-500 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending invites</CardTitle>
                <CardDescription>These links are active and waiting for acceptance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.token}
                    className="flex items-center justify-between rounded-lg border border-surface-2 bg-surface-1 px-4 py-3 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{inv.email}</p>
                        <p className="text-xs text-text-secondary">
                          Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => copyInviteLink(inv.invite_url)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy invite link"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleRevoke(inv.token)}
                        disabled={revokingToken === inv.token}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                        title="Revoke invite"
                      >
                        {revokingToken === inv.token
                          ? <LoadingSpinner size="sm" />
                          : <X className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Invite */}
          {org.members.length < 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invite a member</CardTitle>
                <CardDescription>
                  An invite link will be generated — share it with your teammate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleInvite} className="flex gap-3">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@example.com"
                    className="max-w-sm"
                  />
                  <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? <LoadingSpinner size="sm" /> : (
                      <><UserPlus className="mr-2 h-4 w-4" /> Generate link</>
                    )}
                  </Button>
                </form>

                {lastInvite && (
                  <div className="rounded-lg bg-surface-1 border border-surface-2 p-3">
                    <p className="mb-2 text-sm text-text-secondary">
                      Share this link with <strong>{lastInvite.email}</strong>. Expires in 7 days.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-surface-0 px-3 py-2 text-xs font-mono text-text-primary border border-surface-2">
                        {lastInvite.invite_url}
                      </code>
                      <Button size="sm" variant="outline" onClick={() => copyInviteLink(lastInvite.invite_url)}>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
