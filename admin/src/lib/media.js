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

/* FUITE EGRESS : compresse les images côté navigateur avant l'envoi.
   Une photo de téléphone fait 3 à 8 Mo ; affichée en vignette + lightbox,
   1 920 px / JPEG qualité 82 % suffit largement (≈ 300-600 Ko, soit 10× moins
   de trafic Storage à chaque affichage sur le site public). */
async function compressImage(file, maxSide = 1920, quality = 0.82) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size < 400 * 1024) return file; // déjà légère
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 900 * 1024) { bmp.close(); return file; }
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch (_) { return file; }
}

export async function uploadMedia(rawFile) {
  const file = await compressImage(rawFile);
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

  /* FUITE EGRESS : sans cacheControl, Supabase applique max-age=3600 (1 h).
     Chaque visiteur re-téléchargeait donc TOUS les médias toutes les heures.
     Les noms de fichiers étant horodatés (jamais réutilisés), un cache d'un an
     est sans risque : le navigateur ne re-télécharge plus jamais un média déjà vu. */
  const up = await supabase.storage.from("medias").upload(path, file, { upsert: false, cacheControl: "31536000" });
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
