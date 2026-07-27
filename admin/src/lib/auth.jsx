import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, hasSupabase } from "./supabase.js";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasSupabase) {
      // Mode démo : pas de backend configuré.
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    if (!hasSupabase) {
      // Repli démo : mot de passe provisoire, sans backend.
      if (password === "lepetitboothstudio") {
        setSession({ user: { email: email || "demo" }, demo: true });
        return { error: null };
      }
      return { error: { message: "Mot de passe incorrect." } };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (hasSupabase) await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthCtx.Provider value={{ session, ready, signIn, signOut, demo: !hasSupabase }}>
      {children}
    </AuthCtx.Provider>
  );
}
