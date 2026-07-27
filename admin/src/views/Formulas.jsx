import React from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { useContent } from "../lib/content.jsx";
import { Text, Area, Card } from "../components/Field.jsx";

export default function Formulas() {
  const { content, set } = useContent();
  if (!content) return <div className="loading">Chargement…</div>;
  const F = content.formules;

  const setF = (i, key, val) => set("formules", F.map((f, j) => (j === i ? { ...f, [key]: val } : f)));
  const setLine = (i, k, val) => setF(i, "lignes", F[i].lignes.map((l, j) => (j === k ? val : l)));
  const addLine = (i) => setF(i, "lignes", [...F[i].lignes, ""]);
  const delLine = (i, k) => setF(i, "lignes", F[i].lignes.filter((_, j) => j !== k));
  const setAvant = (i) => set("formules", F.map((f, j) => ({ ...f, enAvant: j === i })));

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}>
        {F.map((f, i) => (
          <div className="card" key={i} style={{ borderColor: f.enAvant ? "var(--edge)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Formule {i + 1}</h3>
              <button className={`pill ${f.enAvant ? "on" : ""}`} onClick={() => setAvant(i)} title="Mettre en avant">
                <Star size={12} style={{ marginRight: 5, verticalAlign: -1 }} />{f.enAvant ? "En avant" : "Mettre en avant"}
              </button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <Text label="Nom" value={f.nom} onChange={v => setF(i, "nom", v)} />
              <Text label="Accroche" value={f.tagline} onChange={v => setF(i, "tagline", v)} />
              <label><span className="field-lbl">Prix (€)</span>
                <input className="inp" value={f.prix} onChange={e => setF(i, "prix", e.target.value)} /></label>
              <div>
                <span className="field-lbl">Prestations incluses</span>
                <div style={{ display: "grid", gap: 7 }}>
                  {f.lignes.map((l, k) => (
                    <div key={k} style={{ display: "flex", gap: 7 }}>
                      <input className="inp" value={l} onChange={e => setLine(i, k, e.target.value)} />
                      <button className="ico danger" onClick={() => delLine(i, k)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button className="btn btn--ghost btn--sm" onClick={() => addLine(i)} style={{ justifySelf: "start" }}><Plus size={13} /> Ligne</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="Formule sur mesure (texte mis en valeur)">
          <Area label="Texte" value={content.surMesure} onChange={v => set("surMesure", v)} />
        </Card>
      </div>
    </div>
  );
}
