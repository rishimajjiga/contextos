// ── Live Session module · paid promotion banners ─────────────────────────────
// Admin-managed paid 16:4 banners shown between poll cards. Each has an
// admin-set display duration; once expired it stops appearing to users.
// Realtime + a periodic timer drop expired promos without a page reload.

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

const live = (p: LivePromotion) => !p.expiresAt || new Date(p.expiresAt).getTime() > Date.now();

export function useLivePromotions(enabled: boolean) {
  const [all, setAll] = useState<LivePromotion[]>([]);
  const [tick, setTick] = useState(0);          // forces re-filter as time passes
  const chan = useRef<RealtimeChannel | null>(null);

  const fetchPromos = useCallback(async () => {
    const client = getLiveClient();
    if (!client) return;
    const { data } = await client
      .from(TABLES.promotions)
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setAll(((data ?? []) as Row[]).map(toPromo));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const client = getLiveClient();
    if (!client) return;
    fetchPromos();
    chan.current = client
      .channel("live:promotions")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.promotions }, () => fetchPromos())
      .subscribe();
    // Re-evaluate expiry every 30s so timed promos disappear on schedule.
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => {
      if (chan.current) client.removeChannel(chan.current);
      chan.current = null;
      clearInterval(t);
    };
  }, [enabled, fetchPromos]);

  // Only non-expired promos are shown (to users and admin alike).
  const promos = all.filter(live);
  void tick; // referenced so the filter recomputes on each interval tick

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
    await fetchPromos();
  }, [fetchPromos]);

  /** Admin: delete a promo banner. */
  const deletePromotion = useCallback(async (id: string) => {
    const client = getLiveClient();
    if (!client) return;
    setAll((prev) => prev.filter((p) => p.id !== id));
    const { error } = await client.from(TABLES.promotions).delete().eq("id", id);
    if (error) await fetchPromos();
  }, [fetchPromos]);

  return { promos, createPromotion, deletePromotion };
}
