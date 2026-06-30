// ── Live Session module · promotion banners ──────────────────────────────────
// Admin-managed 16:4 ad images shown between poll cards. Independent of polls
// and sessions; realtime so new promos appear live.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getLiveClient } from "../lib/supabaseClient";
import { TABLES } from "../config";
import type { LivePromotion } from "../types";

interface Row {
  id: string;
  image_url: string;
  link_url: string | null;
  sponsored: boolean | null;
  is_active: boolean;
  created_at: string;
}

const toPromo = (r: Row): LivePromotion => ({
  id: r.id,
  imageUrl: r.image_url,
  linkUrl: r.link_url,
  sponsored: !!r.sponsored,
  isActive: r.is_active,
  createdAt: r.created_at,
});

export function useLivePromotions(enabled: boolean) {
  const [promos, setPromos] = useState<LivePromotion[]>([]);
  const chan = useRef<RealtimeChannel | null>(null);

  const fetchPromos = useCallback(async () => {
    const client = getLiveClient();
    if (!client) return;
    const { data } = await client
      .from(TABLES.promotions)
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setPromos(((data ?? []) as Row[]).map(toPromo));
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
    return () => {
      if (chan.current) client.removeChannel(chan.current);
      chan.current = null;
    };
  }, [enabled, fetchPromos]);

  /** Admin: add a promo banner (imageUrl already uploaded). */
  const createPromotion = useCallback(async (
    imageUrl: string, linkUrl: string | null, sponsored: boolean, adminEmail: string,
  ) => {
    const client = getLiveClient();
    if (!client) throw new Error("Live session backend not configured.");
    const { error } = await client.from(TABLES.promotions).insert({
      image_url: imageUrl, link_url: linkUrl, sponsored, is_active: true, created_by: adminEmail,
    });
    if (error) throw error;
    await fetchPromos();
  }, [fetchPromos]);

  /** Admin: delete a promo banner. */
  const deletePromotion = useCallback(async (id: string) => {
    const client = getLiveClient();
    if (!client) return;
    setPromos((prev) => prev.filter((p) => p.id !== id));
    const { error } = await client.from(TABLES.promotions).delete().eq("id", id);
    if (error) await fetchPromos();
  }, [fetchPromos]);

  return { promos, createPromotion, deletePromotion };
}
