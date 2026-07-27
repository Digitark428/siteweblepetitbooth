import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// hasSupabase = false tant que le .env n'est pas renseigné : l'admin
// bascule alors en mode démonstration (données locales) au lieu de planter.
export const hasSupabase = Boolean(url && key);

export const supabase = hasSupabase ? createClient(url, key) : null;
