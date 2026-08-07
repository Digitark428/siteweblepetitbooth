import React, { useMemo, useState } from "react";
import { Check, Archive, Trash2 } from "lucide-react";
import { supabase, hasSupabase } from "../lib/supabase.js";
import { fmtDate } from "../lib/format.js";

const FILTERS = [["toutes", "Toutes"], ["nouvelle", "Nouvelles"], ["traitee", "Traitées"], ["archivee", "Archivées"]];
const STATUT_LABEL = { nouvelle: "Nouvelle", traitee: "Traitée", archivee: "Archivée" };

export default function Reservations({ items, setItems }) {
  const [filter, setFilter] = useState("toutes");

  if (items === null) return <div className="loading">Chargement des demandes…</div>;

  const setStatut = async (id, statut) => {
    setItems(items.map(r => (r.id === id ? { ...r, statut } : r)));   // MAJ optimiste
    if (hasSupabase) await supabase.from("reservations").update({ statut }).eq("id", id);
  };
  const remove = async (id) => {
    if (!confirm("Supprimer définitivement cette demande ?")) return;
    setItems(items.filter(r => r.id !== id));
    if (hasSupabase) await supabase.from("reservations").delete().eq("id", id);
  };

  const shown = useMemo(
    () => (filter === "toutes" ? items : items.filter(r => r.statut === filter)),
    [items, filter]
  );

  return (
    <div>
      <div className="filters">
        {FILTERS.map(([id, l]) => (
          <button key={id} className={`pill ${filter === id ? "on" : ""}`} onClick={() => setFilter(id)}>
            {l}{id !== "toutes" && ` (${items.filter(r => r.statut === id).length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 && <div className="empty">Aucune demande dans cette catégorie.</div>}

      {shown.map(r => (
        <div className="row" key={r.id} style={{ gridTemplateColumns: "1fr auto" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="who">{r.prenom} {r.nom}</span>
              <span className={`tag ${r.statut}`}>{STATUT_LABEL[r.statut]}</span>
              <span className="tag formule">{r.formule}</span>
            </div>
            <div className="meta">
              {r.type_evenement} · {fmtDate(r.date_evenement)}
              {r.nb_invites ? ` · ${r.nb_invites} invités` : ""} · {r.telephone} · {r.email}
            </div>
            {r.message && <div className="meta" style={{ color: "var(--mist)", marginTop: 6, fontStyle: "italic" }}>« {r.message} »</div>}
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button className="ico" title="Marquer traité" onClick={() => setStatut(r.id, "traitee")}><Check size={15} /></button>
            <button className="ico" title="Archiver" onClick={() => setStatut(r.id, "archivee")}><Archive size={15} /></button>
            <button className="ico danger" title="Supprimer" onClick={() => remove(r.id)}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
