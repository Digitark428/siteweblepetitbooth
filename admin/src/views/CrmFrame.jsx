import React, { useRef, useEffect } from "react";
import { supabase, hasSupabase } from "../lib/supabase.js";

/**
 * Ouvre le CRM (application autonome dans /admin/crm.html) en pleine page
 * et lui transmet la session admin en cours, pour qu'il s'ouvre directement
 * sans redemander d'identifiant.
 */
export default function CrmFrame() {
  const ref = useRef(null);

  const sendSession = async () => {
    if (!hasSupabase || !ref.current || !ref.current.contentWindow) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        ref.current.contentWindow.postMessage(
          {
            type: "lpb-session",
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
          window.location.origin
        );
      }
    } catch (_) {}
  };

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === "lpb-crm-ready") sendSession();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <iframe
      ref={ref}
      src="crm.html"
      title="CRM — Clients & prestataires"
      className="crm-frame"
      onLoad={sendSession}
    />
  );
}
