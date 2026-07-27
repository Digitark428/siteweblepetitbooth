import { supabase, hasSupabase } from "./supabase.js";

// Détecte le type de média à partir du fichier.
export function kindOf(file) {
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "image";
}

export function humanSize(bytes) {
  if (!bytes) return "";
  const u = ["o", "Ko", "Mo", "Go"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

/* ---- Mode démonstration : stockage en mémoire pour la session ---- */
const demoStore = [];

export async function listMedia() {
  if (!hasSupabase) return [...demoStore].reverse();
  const { data, error } = await supabase
    .from("media_assets").select("*").order("created_at", { ascending: false });
  return error ? [] : data;
}

export async function uploadMedia(file) {
  const kind = kindOf(file);
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${kind}s/${Date.now()}-${safe}`;

  if (!hasSupabase) {
    const asset = {
      id: "m" + Date.now() + Math.random().toString(36).slice(2, 6),
      url: URL.createObjectURL(file), path, name: file.name, kind,
      mime: file.type, size_bytes: file.size, created_at: new Date().toISOString(),
    };
    demoStore.push(asset);
    return asset;
  }

  const up = await supabase.storage.from("medias").upload(path, file, { upsert: false });
  if (up.error) throw up.error;
  const url = supabase.storage.from("medias").getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase.from("media_assets").insert({
    url, path, name: file.name, kind, mime: file.type, size_bytes: file.size,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMedia(asset) {
  if (!hasSupabase) {
    const i = demoStore.findIndex(m => m.id === asset.id);
    if (i > -1) demoStore.splice(i, 1);
    return;
  }
  await supabase.storage.from("medias").remove([asset.path]);
  await supabase.from("media_assets").delete().eq("id", asset.id);
}
