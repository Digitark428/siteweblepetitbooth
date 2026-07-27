import React, { useState } from "react";
import { Image as ImageIcon, RotateCcw, History } from "lucide-react";
import { useContent } from "../lib/content.jsx";
import { hasSupabase } from "../lib/supabase.js";
import { Text, Color, Card } from "../components/Field.jsx";
import MediaPicker from "../components/MediaPicker.jsx";

const FONTS = ["Sora", "Manrope", "Poppins", "Montserrat", "Playfair Display", "Inter"];

export default function Settings() {
  const { content, set, history, restore } = useContent();
  const [pick, setPick] = useState(null); // "logo" | "favicon"
  if (!content) return <div className="loading">Chargement…</div>;
  const t = content.theme, id = content.identite, c = content.contact;

  return (
    <div style={{ maxWidth: 760 }}>
      <Card title="Couleurs du site">
        <Color label="Néon (violet)" value={t.neon} onChange={v => set("theme.neon", v)} />
        <Color label="Magenta (rose)" value={t.magenta} onChange={v => set("theme.magenta", v)} />
        <Color label="Doré (accents)" value={t.gold} onChange={v => set("theme.gold", v)} />
        <Color label="Fond" value={t.fond} onChange={v => set("theme.fond", v)} />
      </Card>

      <Card title="Polices">
        <div className="grid2">
          <label><span className="field-lbl">Police des titres</span>
            <select className="inp" value={t.policeTitre} onChange={e => set("theme.policeTitre", e.target.value)}>
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select></label>
          <label><span className="field-lbl">Police du texte</span>
            <select className="inp" value={t.policeTexte} onChange={e => set("theme.policeTexte", e.target.value)}>
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select></label>
        </div>
      </Card>

      <Card title="Identité">
        <div className="grid2">
          <div>
            <span className="field-lbl">Logo</span>
            {id.logoUrl
              ? <img src={id.logoUrl} onClick={() => setPick("logo")} style={{ height: 54, cursor: "pointer" }} />
              : <div className="thumb thumb--pick" style={{ width: "100%", height: 54 }} onClick={() => setPick("logo")}><ImageIcon size={18} /></div>}
          </div>
          <div>
            <span className="field-lbl">Favicon</span>
            {id.faviconUrl
              ? <img src={id.faviconUrl} onClick={() => setPick("favicon")} style={{ height: 40, cursor: "pointer" }} />
              : <div className="thumb thumb--pick" style={{ width: 54, height: 40 }} onClick={() => setPick("favicon")}><ImageIcon size={16} /></div>}
          </div>
        </div>
      </Card>

      <Card title="Coordonnées & réseaux">
        <div className="grid2">
          <Text label="E-mail" value={c.email} onChange={v => set("contact.email", v)} />
          <Text label="Téléphone" value={c.telephone} onChange={v => set("contact.telephone", v)} />
        </div>
        <div className="grid2">
          <Text label="WhatsApp (indicatif + numéro)" value={c.whatsapp} onChange={v => set("contact.whatsapp", v)} placeholder="262693813858" />
          <Text label="Instagram (sans @)" value={c.instagram} onChange={v => set("contact.instagram", v)} />
        </div>
      </Card>

      <Card title="Historique des versions">
        {!hasSupabase && <p style={{ fontSize: ".8rem", color: "var(--mute)", margin: 0 }}>L'historique s'active une fois Supabase connecté.</p>}
        {hasSupabase && history.length === 0 && <p style={{ fontSize: ".8rem", color: "var(--mute)", margin: 0 }}>Aucune version publiée pour l'instant.</p>}
        {history.map(v => (
          <div key={v.id} className="row" style={{ gridTemplateColumns: "1fr auto", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}><History size={15} style={{ color: "var(--mute)" }} />
              <span style={{ fontSize: ".86rem" }}>{v.label}</span></div>
            <button className="btn btn--ghost btn--sm" onClick={() => restore(v.id)}><RotateCcw size={13} /> Restaurer</button>
          </div>
        ))}
      </Card>

      {pick && <MediaPicker kind="image" onClose={() => setPick(null)}
        onPick={a => { set(pick === "logo" ? "identite.logoUrl" : "identite.faviconUrl", a.url); setPick(null); }} />}
    </div>
  );
}
