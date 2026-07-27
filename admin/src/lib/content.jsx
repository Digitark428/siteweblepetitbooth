import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase, hasSupabase } from "./supabase.js";
import { useAuth } from "./auth.jsx";

/* ============================================================
   Contenu éditable du site — un seul document JSON.
   draft = version de travail · published = version en ligne.
   ============================================================ */
export const DEFAULT_CONTENT = {
  hero: {
    titre: "ENTREZ",
    sousTitre: "dans une autre dimension",
    claimFort: "Bien plus qu'un Vidéo Booth.",
    claim: "Une expérience dont vos invités se souviendront.",
    ctaPrincipal: "Réserver ma date",
    ctaSecondaire: "Voir l'expérience",
    photoUrl: "",
    photoOpacite: 55,
    photoPosition: "50% 50%",
  },
  manifeste: [
    "Imaginez vos invités entrer sur scène.",
    "La musique démarre. La lumière s'allume. Les regards se tournent.",
    "En quelques secondes, ils deviennent les stars.",
    "Ils rient, ils dansent, ils s'amusent. Chaque passage est unique, spontané, vivant.",
    "Et surtout… inoubliable.",
    "Une expérience.",
  ],
  compteur: { nombre: 185, texte: "événements immortalisés à La Réunion", visible: true },
  formules: [
    { nom: "Essentiel", tagline: "L'essentiel pour capturer vos premiers souvenirs", prix: "390", lignes: ["2 h de prestation", "Installation complète", "Animation", "Envoi instantané des vidéos"], enAvant: false },
    { nom: "Expérience", tagline: "L'expérience complète qui marque vos invités", prix: "590", lignes: ["5 h de prestation", "Installation complète", "Ambiance immersive (musique & lumières)", "Voix off personnalisée", "Vidéos personnalisées", "Animation dynamique", "Montage best-of dynamique", "Envoi instantané", "Galerie privée"], enAvant: true },
    { nom: "Signature", tagline: "L'expérience VIP, sans limites", prix: "990", lignes: ["Toute la formule Expérience comprise", "Prestation jusqu'à 8 h maximum", "Animateur principal : installation, animation, accompagnement, envoi, démontage", "Deuxième animateur sur des moments clés (relance des invités, ambiance, coulisses)"], enAvant: false },
  ],
  surMesure: "Un besoin particulier ? Composez votre formule sur mesure : dites-nous votre événement dans le formulaire de réservation, on s'adapte à votre budget et à vos envies.",
  musique: { url: "", volume: 50, autoplay: false, loop: true, actif: false },
  theme: { neon: "#C77DFF", magenta: "#FF4D8D", gold: "#EFDCA8", fond: "#050208", policeTitre: "Sora", policeTexte: "Manrope" },
  identite: { logoUrl: "", faviconUrl: "" },
  contact: { email: "lepetitbooth@gmail.com", telephone: "0693 813 858", whatsapp: "262693813858", instagram: "lepetitbooth" },
};

/* Fusion profonde pour compléter un document partiel avec les valeurs par défaut. */
function merge(base, over) {
  if (Array.isArray(over)) return over;
  if (over && typeof over === "object") {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = merge(base?.[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}
function deepSet(obj, path, value) {
  const keys = path.split(".");
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}

/* Repli démonstration : document en mémoire pour la session. */
const demo = { draft: null, published: null, history: [] };

const ContentCtx = createContext(null);
export const useContent = () => useContext(ContentCtx);

export function ContentProvider({ children }) {
  const { session } = useAuth();
  const [content, setContent] = useState(null);     // brouillon en cours
  const [published, setPublished] = useState(null); // dernière version publiée
  const [history, setHistory] = useState([]);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef(null);

  const load = useCallback(async () => {
    if (!hasSupabase) {
      demo.draft ??= structuredClone(DEFAULT_CONTENT);
      demo.published ??= structuredClone(DEFAULT_CONTENT);
      setContent(demo.draft); setPublished(demo.published); setHistory(demo.history);
      return;
    }
    const { data } = await supabase.from("site_content").select("draft, published").eq("id", 1).single();
    const pub = merge(DEFAULT_CONTENT, data?.published || {});
    const dr = data?.draft && Object.keys(data.draft).length ? merge(DEFAULT_CONTENT, data.draft) : pub;
    setPublished(pub); setContent(dr);
    setDirty(JSON.stringify(dr) !== JSON.stringify(pub));
    const h = await supabase.from("content_history").select("id, label, published_at").order("published_at", { ascending: false });
    setHistory(h.data || []);
  }, []);

  useEffect(() => { if (session) load(); }, [session, load]);

  /* Sauvegarde différée du brouillon (ne bloque pas la saisie). */
  const persistDraft = useCallback((draft) => {
    if (!hasSupabase) { demo.draft = draft; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase.from("site_content").update({ draft, updated_at: new Date().toISOString() }).eq("id", 1);
    }, 700);
  }, []);

  const set = useCallback((path, value) => {
    setContent(prev => {
      const next = deepSet(prev, path, value);
      setDirty(JSON.stringify(next) !== JSON.stringify(published));
      persistDraft(next);
      return next;
    });
  }, [published, persistDraft]);

  const publish = useCallback(async () => {
    const snapshot = content;
    if (hasSupabase) {
      // archive l'ancienne version publiée
      await supabase.from("content_history").insert({ snapshot: published, label: "Version du " + new Date().toLocaleString("fr-FR") });
      await supabase.from("site_content").update({ published: snapshot, draft: snapshot, updated_at: new Date().toISOString() }).eq("id", 1);
      const h = await supabase.from("content_history").select("id, label, published_at").order("published_at", { ascending: false });
      setHistory(h.data || []);
    } else {
      demo.history = [{ id: "h" + Date.now(), label: "Version du " + new Date().toLocaleString("fr-FR"), published_at: new Date().toISOString() }, ...demo.history];
      demo.published = snapshot; demo.draft = snapshot; setHistory(demo.history);
    }
    setPublished(snapshot); setDirty(false);
  }, [content, published]);

  const discard = useCallback(async () => {
    setContent(published); setDirty(false);
    if (hasSupabase) await supabase.from("site_content").update({ draft: published }).eq("id", 1);
    else demo.draft = published;
  }, [published]);

  const restore = useCallback(async (id) => {
    // Recharge une ancienne version dans le brouillon (à revoir puis publier).
    if (hasSupabase) {
      const { data } = await supabase.from("content_history").select("snapshot").eq("id", id).single();
      if (data?.snapshot) { const snap = merge(DEFAULT_CONTENT, data.snapshot); setContent(snap); setDirty(true); persistDraft(snap); }
    }
  }, [persistDraft]);

  return (
    <ContentCtx.Provider value={{ content, published, history, dirty, set, publish, discard, restore, reload: load }}>
      {children}
    </ContentCtx.Provider>
  );
}
