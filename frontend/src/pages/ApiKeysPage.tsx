import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Check, Key, Terminal, Chrome } from "lucide-react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { usePlan } from "@/hooks/usePlan";
import { PageHeader } from "@/components/common/PageHeader";
import { SkeletonList } from "@/components/common/SkeletonCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import type { ApiKey } from "@/types";

// ── Copy button with checkmark feedback ───────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

// ── New key reveal modal ──────────────────────────────────────────────────────

function NewKeyModal({
  apiKey,
  onClose,
}: {
  apiKey: { key: string; name: string };
  onClose: () => void;
}) {
  const mcpConfig = `{
  "mcpServers": {
    "contextos": {
      "command": "python",
      "args": ["C:/path/to/contextos/mcp-server/server.py"],
      "env": {
        "CONTEXTOS_API_KEY": "${apiKey.key}"
      }
    }
  }
}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-brand-400" />
            Your new API key — "{apiKey.name}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Copy this key now — it won't be shown again.
            </p>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">API key</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs break-all select-all">
                {apiKey.key}
              </code>
              <CopyButton text={apiKey.key} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Claude Desktop — MCP config</span>
            </div>
            <div className="relative">
              <pre className="rounded-md border border-border bg-surface-2 px-3 py-2.5 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
                {mcpConfig}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={mcpConfig} label="Copy config" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Paste into <code className="font-mono">claude_desktop_config.json</code> → restart Claude Desktop.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Chrome className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Chrome extension</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Open the ContextOS extension → Settings tab → paste your key into the API Key field → Save.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button onClick={onClose}>Done — I've copied it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create key dialog ─────────────────────────────────────────────────────────

function CreateKeyDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreate(name.trim());
      setName("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-1">
          <div>
            <Label htmlFor="key-name" className="mb-1.5 block">
              Label <span className="text-muted-foreground font-normal">(e.g. "Claude Desktop", "Cursor")</span>
            </Label>
            <Input
              id="key-name"
              placeholder="Claude Desktop"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Generate key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Key row ───────────────────────────────────────────────────────────────────

function KeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3">
          <Key className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{apiKey.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {apiKey.key_prefix}••••••••••••••••••••••••••••••••
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-[11px] text-muted-foreground hidden sm:block">
          Created {formatDate(apiKey.created_at)}
        </span>
        <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/30 bg-green-500/10 hidden sm:flex">
          Active
        </Badge>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Revoke?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              onClick={() => onRevoke(apiKey.id)}
            >
              Yes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirming(false)}
            >
              No
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Revoke key"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ApiKeysPage() {
  const { keys, isLoading, newKey, fetchKeys, createKey, revokeKey, dismissNewKey } = useApiKeys();
  const { plan } = usePlan();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async (name: string) => {
    await createKey(name);
  };

  const keyLimit = plan.limits.api_keys; // -1 = unlimited
  const atLimit = keyLimit !== -1 && keys.length >= keyLimit;
  const limitMessage = plan.plan === "student"
    ? "You have reached the API key limit for the Student Plan."
    : `You've reached the ${keyLimit} API key limit on the ${plan.display_name} plan.`;

  return (
    <div>
      <PageHeader
        title="API keys"
        description="Keys let the MCP server and browser extension talk to your ContextOS data."
        action={
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setShowCreate(true)}
            disabled={atLimit}
            title={atLimit ? limitMessage : undefined}
          >
            <Plus className="h-3.5 w-3.5" /> New key
          </Button>
        }
      />

      {/* Plan limit banner */}
      {atLimit && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          {limitMessage}
        </div>
      )}

      {/* How to use */}
      <Card className="mb-6 border-brand-500/20 bg-brand-500/5">
        <CardContent className="flex items-start gap-4 p-4">
          <Key className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">How API keys work</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Generate a key here, paste it into the MCP server config or Chrome extension, and any AI tool
              you connect will be able to read and write your ContextOS memory.
              Each key has a label so you know which tool it belongs to.
              Revoke a key instantly if a device is lost or compromised.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Key list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {keys.length} key{keys.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <SkeletonList count={2} />
          ) : keys.length === 0 ? (
            <EmptyState
              icon={Key}
              title="No API keys yet"
              description="Generate your first key to connect Claude Desktop, Cursor, or the browser extension."
              action={
                <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
                  <Plus className="h-3.5 w-3.5" /> Generate key
                </Button>
              }
            />
          ) : (
            <div>
              {keys.map(k => (
                <KeyRow key={k.id} apiKey={k} onRevoke={revokeKey} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateKeyDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      {newKey && (
        <NewKeyModal apiKey={newKey} onClose={dismissNewKey} />
      )}
    </div>
  );
}
