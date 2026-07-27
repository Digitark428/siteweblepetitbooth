import React, { useState, useRef } from "react";
import { UploadCloud, Trash2, GripVertical, Image as ImageIcon } from "lucide-react";
import MediaPicker from "../components/MediaPicker.jsx";
import { supabase, hasSupabase } from "../lib/supabase.js";
import { uploadMedia } from "../lib/media.js";

export default function Photos({ items, setItems }) {
  const [picker, setPicker] = useState(false);
  const dragId = useRef(null);
  const [overId, setOverId] = useState(null);
  const fileRef = useRef();
  const [busy, setBusy] = useState(false);

  if (items === null) return <div className="loading">Chargement des photos…</div>;

  const persistOrder = async (list) => {
    if (!hasSupabase) return;
    await Promise.all(list.map((it, i) => supabase.from("photos").update({ position: i }).eq("id", it.id)));
  };
  const add = async (url) => {
    const row = { url, position: items.length, visible: true };
    if (hasSupabase) {
      const { data } = await supabase.from("photos").insert(row).select().single();
      setItems([...items, data || { ...row, id: "p" + Date.now() }]);
    } else {
      setItems([...items, { ...row, id: "p" + Date.now() }]);
    }
  };
  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setBusy(true);
    for (const f of files) {
      try { const asset = await uploadMedia(f); await add(asset.url); } catch (err) { alert("Import impossible : " + (err.message || err)); }
    }
    setBusy(false);
    e.target.value = "";
  };
  const remove = async (id) => {
    if (!confirm("Supprimer cette photo ?")) return;
    setItems(items.filter(x => x.id !== id));
    if (hasSupabase) await supabase.from("photos").delete().eq("id", id);
  };
  const onDrop = (targetId) => {
    const from = items.findIndex(x => x.id === dragId.current);
    const to = items.findIndex(x => x.id === targetId);
    if (from === -1 || to === -1 || from === to) { setOverId(null); return; }
    const next = [...items];
    const [m] = next.splice(from, 1); next.splice(to, 0, m);
    setItems(next); persistOrder(next); dragId.current = null; setOverId(null);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3><ImageIcon size={16} /> Ajouter des photos</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn--sm" onClick={() => fileRef.current.click()} disabled={busy}>
            <UploadCloud size={14} /> {busy ? "Import…" : "Depuis mon ordinateur"}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setPicker(true)}>Depuis la médiathèque</button>
          <input ref={fileRef} type="file" hidden multiple accept="image/*" onChange={onFiles} />
        </div>
        <p style={{ fontSize: ".76rem", color: "var(--mute)", margin: "14px 0 0", lineHeight: 1.6 }}>
          <b style={{ color: "var(--mist)" }}>Format conseillé :</b> JPEG (.jpg). ·
          <b style={{ color: "var(--mist)" }}> Résolution idéale :</b> 1600 à 2000 px sur le plus grand côté. ·
          <b style={{ color: "var(--mist)" }}> Taille maximale :</b> 5 Mo par photo. Les images plus lourdes ralentissent le site.
        </p>
      </div>

      <div style={{ marginBottom: 14, color: "var(--mute)", fontSize: ".84rem" }}>
        Glissez les photos pour changer leur ordre. {items.length} photo(s).
      </div>

      {items.length === 0 && <div className="empty">Aucune photo pour l'instant.</div>}

      <div className="media-grid">
        {items.map(p => (
          <div
            key={p.id}
            className={"media-tile" + (overId === p.id ? " sel" : "")}
            draggable
            style={{ opacity: dragId.current === p.id ? 0.4 : 1 }}
            onDragStart={() => (dragId.current = p.id)}
            onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
            onDragLeave={() => setOverId(o => (o === p.id ? null : o))}
            onDrop={() => onDrop(p.id)}
          >
            <span className="media-kind" style={{ display: "flex", alignItems: "center", gap: 4 }}><GripVertical size={11} /> déplacer</span>
            <button className="del" onClick={() => remove(p.id)} aria-label="Supprimer"><Trash2 size={14} /></button>
            <img className="media-thumb" src={p.url} alt="" loading="lazy" />
          </div>
        ))}
      </div>

      {picker && <MediaPicker kind="image" onClose={() => setPicker(false)} onPick={a => { add(a.url); setPicker(false); }} />}
    </div>
  );
}
