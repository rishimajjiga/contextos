// ── Live Session module · paid sponsored promotion banners ───────────────────
// Admin-managed paid 16:4 banners shown between poll cards. Each has an
// admin-set display duration; once the time is up the promo is AUTO-DELETED
// from the database (best-effort, client-driven) so it vanishes for everyone.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getLiveClient } from "../lib/supabaseClient";
import { TABLES } from "../config";
import type { LivePromotion } from "../types";

interface Row {
  id: string;
  image_url: string;
  link_url: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const toPromo = (r: Row): LivePromotion => ({
  id: r.id,
  imageUrl: r.image_url,
  linkUrl: r.link_url,
  expiresAt: r.expires_at,
  isActive: r.is_active,
  createdAt: r.created_at,
});

const isExpired = (r: Row) => !!r.expires_at && new Date(r.expires_at).getTime() <= Date.now();

export function useLivePromotions(enabled: boolean) {
  const [promos, setPromos] = useState<LivePromotion[]>([]);
  const chan = useRef<RealtimeChannel | null>(null);

  // Fetch live promos and delete any that have passed their expiry.
  const refresh = useCallback(async () => {
    const client = getLiveClient();
    if (!client) return;
    const { data } = await client
      .from(TABLES.promotions)
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Row[];

    const expired = rows.filter(isExpired).map((r) => r.id);
    const liveRows = rows.filter((r) => !isExpired(r));
    setPromos(liveRows.map(toPromo));               // show only live ones immediately

    if (expired.length) {
      // Auto-delete timed-out promos (cascades nothing; row removed for all).
      await client.from(TABLES.promotions).delete().in("id", expired);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const client = getLiveClient();
    if (!client) return;
    refresh();
    chan.current = client
      .channel("live:promotions")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.promotions }, () => refresh())
      .subscribe();
    // Re-check expiry every 30s so promos auto-delete on schedule.
    const t = setInterval(() => refresh(), 30000);
    return () => {
      if (chan.current) client.removeChannel(chan.current);
      chan.current = null;
      clearInterval(t);
    };
  }, [enabled, refresh]);

  /** Admin: add a paid promo with an optional display duration (hours). */
  const createPromotion = useCallback(async (
    imageUrl: string,
    linkUrl: string | null,
    durationHours: number | null,
    adminEmail: string,
  ) => {
    const client = getLiveClient();
    if (!client) throw new Error("Live session backend not configured.");
    const expiresAt = durationHours && durationHours > 0
      ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString()
      : null;
    const { error } = await client.from(TABLES.promotions).insert({
      image_url: imageUrl,
      link_url: linkUrl,
      expires_at: expiresAt,
      is_active: true,
      created_by: adminEmail,
    });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  /** Admin: delete a promo banner now. */
  const deletePromotion = useCallback(async (id: string) => {
    const client = getLiveClient();
    if (!client) return;
    setPromos((prev) => prev.filter((p) => p.id !== id));
    const { error } = await client.from(TABLES.promotions).delete().eq("id", id);
    if (error) await refresh();
  }, [refresh]);

  return { promos, createPromotion, deletePromotion };
}
