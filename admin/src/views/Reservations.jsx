import React, { useMemo, useState } from "react";
import { Check, Archive, Trash2, ClipboardList, Phone, Mail } from "lucide-react";
import { supabase, hasSupabase } from "../lib/supabase.js";
import { fmtDate } from "../lib/format.js";
import Modal from "../components/Modal.jsx";

const FILTERS = [["toutes", "Toutes"], ["nouvelle", "Nouvelles"], ["traitee", "Traitées"], ["archivee", "Archivées"]];
const STATUT_LABEL = { nouvelle: "Nouvelle", traitee: "Traitée", archivee: "Archivée" };

/* Créneau horaire lisible (renseigné par le formulaire du site). */
const horaires = (r) => {
  if (!r.heure_debut && !r.heure_fin && !r.nb_heures) return "";
  const plage = [r.heure_debut, r.heure_fin].filter(Boolean).join(" – ");
  const duree = r.nb_heures ? `${r.nb_heures} h` : "";
  return [plage, duree && plage ? `(${duree})` : duree].filter(Boolean).join(" ");
};

export default function Reservations({ items, setItems }) {
  const [filter, setFilter] = useState("toutes");
  const [openId, setOpenId] = useState(null);

  if (items === null) return <div className="loading">Chargement des demandes…</div>;

  const setStatut = async (id, statut) => {
    setItems(items.map(r => (r.id === id ? { ...r, statut } : r)));   // MAJ optimiste
    if (hasSupabase) await supabase.from("reservations").update({ statut }).eq("id", id);
  };
  const remove = async (id) => {
    if (!confirm("Supprimer définitivement cette demande ?")) return;
    setOpenId(null);
    setItems(items.filter(r => r.id !== id));
    if (hasSupabase) await supabase.from("reservations").delete().eq("id", id);
  };

  const shown = useMemo(
    () => (filter === "toutes" ? items : items.filter(r => r.statut === filter)),
    [items, filter]
  );

  const sel = openId != null ? items.find(r => r.id === openId) : null;

  /* Fiche détaillée : toutes les informations enregistrées. */
  const L = ({ k, v }) => (v == null || v === "") ? null : (
    <div style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--edge-soft)", fontSize: ".86rem" }}>
      <span style={{ color: "var(--mute)", minWidth: 150, flexShrink: 0 }}>{k}</span>
      <span style={{ wordBreak: "break-word" }}>{v}</span>
    </div>
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
        <div className="row" key={r.id} style={{ gridTemplateColumns: "1fr auto", cursor: "pointer" }}
             onClick={() => setOpenId(r.id)} title="Ouvrir la fiche détaillée">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="who">{r.prenom} {r.nom}</span>
              <span className={`tag ${r.statut}`}>{STATUT_LABEL[r.statut]}</span>
              <span className="tag formule">{r.formule}</span>
            </div>
            <div className="meta">
              {r.type_evenement} · {fmtDate(r.date_evenement)}
              {horaires(r) ? ` · ${horaires(r)}` : ""}
              {r.nb_invites ? ` · ${r.nb_invites} invités` : ""} · {r.telephone} · {r.email}
            </div>
            {r.message && <div className="meta" style={{ color: "var(--mist)", marginTop: 6, fontStyle: "italic" }}>« {r.message} »</div>}
          </div>
          <div style={{ display: "flex", gap: 7 }} onClick={e => e.stopPropagation()}>
            <button className="ico" title="Marquer traité" onClick={() => setStatut(r.id, "traitee")}><Check size={15} /></button>
            <button className="ico" title="Archiver" onClick={() => setStatut(r.id, "archivee")}><Archive size={15} /></button>
            <button className="ico danger" title="Supprimer" onClick={() => remove(r.id)}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}

      {sel && (
        <Modal
          title={`${sel.prenom || ""} ${sel.nom || ""}`}
          icon={ClipboardList}
          onClose={() => setOpenId(null)}
          foot={
            <>
              <button className="btn ghost" onClick={() => setStatut(sel.id, "traitee")}><Check size={14} /> Marquer traité</button>
              <button className="btn ghost" onClick={() => setStatut(sel.id, "archivee")}><Archive size={14} /> Archiver</button>
              <button className="btn ghost danger" onClick={() => remove(sel.id)}><Trash2 size={14} /> Supprimer</button>
              <button className="btn" onClick={() => setOpenId(null)}>Fermer</button>
            </>
          }
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "2px 0 12px" }}>
            <span className={`tag ${sel.statut}`}>{STATUT_LABEL[sel.statut]}</span>
            <span className="tag formule">{sel.formule}</span>
          </div>
          <L k="Nom" v={sel.nom} />
          <L k="Prénom" v={sel.prenom} />
          <L k="Téléphone" v={sel.telephone && <a href={`tel:${sel.telephone}`} style={{ color: "var(--neon)" }}><Phone size={12} /> {sel.telephone}</a>} />
          <L k="E-mail" v={sel.email && <a href={`mailto:${sel.email}`} style={{ color: "var(--neon)" }}><Mail size={12} /> {sel.email}</a>} />
          <L k="Date demandée" v={fmtDate(sel.date_evenement)} />
          <L k="Formule choisie" v={sel.formule} />
          <L k="Nombre d'heures" v={sel.nb_heures ? `${sel.nb_heures} h` : null} />
          <L k="Horaires" v={[sel.heure_debut, sel.heure_fin].filter(Boolean).join(" – ") || null} />
          <L k="Type d'événement" v={sel.type_evenement} />
          <L k="Lieu" v={sel.lieu} />
          <L k="Nombre d'invités" v={sel.nb_invites} />
          <L k="Message" v={sel.message} />
          <L k="Reçue le" v={sel.created_at ? new Date(sel.created_at).toLocaleString("fr-FR") : null} />
        </Modal>
      )}
    </div>
  );
}
