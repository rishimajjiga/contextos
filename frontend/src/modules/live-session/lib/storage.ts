// ── Live Session module · poll image upload (Supabase Storage) ────────────────
// Uploads admin poll images into the existing private `contextos-documents`
// bucket under a `live-polls/` prefix and returns a long-lived signed URL.
// Only JPG / PNG / WEBP are accepted. Used only by the admin create-poll flow.

import { getLiveClient } from "./supabaseClient";

const BUCKET = "contextos-documents";
const PREFIX = "live-polls";
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;            // 5 MB
const SIGNED_TTL = 60 * 60 * 24 * 365 * 5;    // ~5 years

export async function uploadPollImage(file: File): Promise<string> {
  const client = getLiveClient();
  if (!client) throw new Error("Backend not configured.");
  if (!ALLOWED.includes(file.type)) throw new Error("Only JPG, PNG or WEBP images are allowed.");
  if (file.size > MAX_BYTES) throw new Error("Image must be under 5 MB.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const uid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${PREFIX}/${uid}.${ext}`;

  const { error: upErr } = await client.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (upErr) throw upErr;

  const { data, error: signErr } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (signErr || !data) throw signErr ?? new Error("Could not sign image URL.");
  return data.signedUrl;
}
