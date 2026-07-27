import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase, hasSupabase } from "../lib/supabase.js";
import { fmtDate } from "../lib/format.js";

const TYPES = ["Mariage", "Anniversaire", "Baptême", "Entreprise", "Séminaire", "Soirée privée", "Autre"];
const EMPTY = { date_evenement: "", heure: "", ville: "", type_evenement: "Mariage", statut: "confirmee" };

export default function Calendar({ items, setItems }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  if (items === null) return <div className="loading">Chargement du planning…</div>;

  const add = async () => {
    if (!f.date_evenement || !f.ville) return;
    setBusy(true);
    const payload = { ...f, heure: f.heure || null };
    if (hasSupabase) {
      const { data, error } = await supabase.from("calendar_events").insert(payload).select().single();
      if (!error) setItems([...items, data].sort((a, b) => a.date_evenement.localeCompare(b.date_evenement)));
    } else {
      setItems([...items, { ...payload, id: "c" + Date.now() }].sort((a, b) => a.date_evenement.localeCompare(b.date_evenement)));
    }
    setF(EMPTY);
    setBusy(false);
  };

  const remove = async (id) => {
    setItems(items.filter(e => e.id !== id));
    if (hasSupabase) await supabase.from("calendar_events").delete().eq("id", id);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "320px 1fr", alignItems: "start" }}>
      <div className="card">
        <h3><Plus size={16} /> Ajouter une date</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <input className="inp" type="date" value={f.date_evenement} onChange={e => setF({ ...f, date_evenement: e.target.value })} />
          <input className="inp" type="time" value={f.heure} onChange={e => setF({ ...f, heure: e.target.value })} />
          <input className="inp" placeholder="Ville" value={f.ville} onChange={e => setF({ ...f, ville: e.target.value })} />
          <select className="inp" value={f.type_evenement} onChange={e => setF({ ...f, type_evenement: e.target.value })}>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select className="inp" value={f.statut} onChange={e => setF({ ...f, statut: e.target.value })}>
            <option value="confirmee">Prestation confirmée</option>
            <option value="devis">Demande de devis (en attente)</option>
          </select>
          <button className="btn btn--wide" onClick={add} disabled={busy}>
            <Plus size={15} /> {busy ? "Ajout…" : "Ajouter au planning"}
          </button>
        </div>
      </div>

      <div>
        {items.length === 0 && <div className="empty">Aucune date au planning.</div>}
        {items.map(e => (
          <div className="row" key={e.id} style={{ gridTemplateColumns: "auto 1fr auto" }}>
            <span className={`tag ${e.statut}`}>{e.statut === "confirmee" ? "Confirmée" : "En attente"}</span>
            <div>
              <div className="who">{fmtDate(e.date_evenement)}{e.heure ? ` · ${String(e.heure).slice(0, 5)}` : ""}</div>
              <div className="meta">{e.ville} · {e.type_evenement}</div>
            </div>
            <button className="ico danger" onClick={() => remove(e.id)}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
