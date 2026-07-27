import React, { useState, useRef } from "react";
import { Plus, Trash2, Pencil, GripVertical, Film, Image as ImageIcon } from "lucide-react";
import Modal from "../components/Modal.jsx";
import MediaPicker from "../components/MediaPicker.jsx";
import { supabase, hasSupabase } from "../lib/supabase.js";

const EMPTY = { title: "", description: "", media_url: "", poster_url: "", visible: true };

export default function Gallery({ items, setItems }) {
  const [editing, setEditing] = useState(null);   // objet en cours d'édition (ou null)
  const dragId = useRef(null);
  const [overId, setOverId] = useState(null);

  if (items === null) return <div className="loading">Chargement de la galerie…</div>;

  /* ---- Persistance ---- */
  const persistOrder = async (list) => {
    if (!hasSupabase) return;
    await Promise.all(list.map((it, i) =>
      supabase.from("gallery_items").update({ position: i }).eq("id", it.id)));
  };
  const save = async (item) => {
    if (item.id) {
      setItems(items.map(x => (x.id === item.id ? item : x)));
      if (hasSupabase) await supabase.from("gallery_items").update(strip(item)).eq("id", item.id);
    } else {
      const withPos = { ...item, position: items.length };
      if (hasSupabase) {
        const { data } = await supabase.from("gallery_items").insert(strip(withPos)).select().single();
        setItems([...items, data || { ...withPos, id: "g" + Date.now() }]);
      } else {
        setItems([...items, { ...withPos, id: "g" + Date.now() }]);
      }
    }
    setEditing(null);
  };
  const remove = async (id) => {
    if (!confirm("Supprimer cette vidéo de la galerie ?")) return;
    setItems(items.filter(x => x.id !== id));
    if (hasSupabase) await supabase.from("gallery_items").delete().eq("id", id);
  };
  const toggle = async (it) => {
    const v = !it.visible;
    setItems(items.map(x => (x.id === it.id ? { ...x, visible: v } : x)));
    if (hasSupabase) await supabase.from("gallery_items").update({ visible: v }).eq("id", it.id);
  };

  /* ---- Glisser-déposer natif ---- */
  const onDrop = (targetId) => {
    const from = items.findIndex(x => x.id === dragId.current);
    const to = items.findIndex(x => x.id === targetId);
    if (from === -1 || to === -1 || from === to) { setOverId(null); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    persistOrder(next);
    dragId.current = null;
    setOverId(null);
  };

  return (
    <div>
      <div className="toolbar">
        <div style={{ flex: 1, color: "var(--mute)", fontSize: ".84rem" }}>
          Glissez les vignettes pour changer l'ordre d'affichage sur le site.
        </div>
        <button className="btn btn--sm" onClick={() => setEditing({ ...EMPTY })}><Plus size={14} /> Ajouter une vidéo</button>
      </div>

      {items.length === 0 && <div className="empty">Aucune vidéo. Ajoutez-en une pour remplir la galerie.</div>}

      {items.map(it => (
        <div
          key={it.id}
          className={`row ${overId === it.id ? "over" : ""}`}
          style={{ gridTemplateColumns: "auto auto 1fr auto", opacity: dragId.current === it.id ? 0.4 : 1 }}
          draggable
          onDragStart={() => (dragId.current = it.id)}
          onDragOver={(e) => { e.preventDefault(); setOverId(it.id); }}
          onDragLeave={() => setOverId(o => (o === it.id ? null : o))}
          onDrop={() => onDrop(it.id)}
        >
          <span className="handle"><GripVertical size={16} /></span>
          {it.poster_url
            ? <img className="thumb" src={it.poster_url} alt="" />
            : <div className="thumb" style={{ display: "grid", placeItems: "center", color: "var(--mute)" }}><Film size={18} /></div>}
          <div>
            <div className="who">{it.title || "Sans titre"}</div>
            <div className="meta">{it.description || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <label className="switch" title="Visible sur le site">
              <input type="checkbox" checked={it.visible} onChange={() => toggle(it)} />
            </label>
            <button className="ico" onClick={() => setEditing(it)}><Pencil size={15} /></button>
            <button className="ico danger" onClick={() => remove(it.id)}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}

      {editing && <GalleryEditor item={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function strip(it) {
  const { id, ...rest } = it;
  return rest;
}

function GalleryEditor({ item, onSave, onClose }) {
  const [f, setF] = useState(item);
  const [picker, setPicker] = useState(null);   // "media" | "poster" | null

  return (
    <Modal title={item.id ? "Modifier la vidéo" : "Nouvelle vidéo"} icon={Film} onClose={onClose}
      foot={<>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Annuler</button>
        <button className="btn btn--sm" onClick={() => onSave(f)}>Enregistrer</button>
      </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <span className="field-lbl">Titre</span>
          <input className="inp" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Mariage · Saint-Gilles" />
        </div>
        <div>
          <span className="field-lbl">Description</span>
          <input className="inp" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Texte affiché sous la vidéo" />
        </div>
        <div className="grid2">
          <div>
            <span className="field-lbl">Vidéo (fichier importé)</span>
            {f.media_url && !/youtu/.test(f.media_url)
              ? <video src={f.media_url} className="thumb" style={{ width: "100%", height: 120 }} muted onClick={() => setPicker("media")} />
              : <div className="thumb thumb--pick" style={{ width: "100%", height: 120 }} onClick={() => setPicker("media")}><Film size={20} /></div>}
          </div>
          <div>
            <span className="field-lbl">Vignette (poster)</span>
            {f.poster_url
              ? <img src={f.poster_url} className="thumb" style={{ width: "100%", height: 120 }} onClick={() => setPicker("poster")} />
              : <div className="thumb thumb--pick" style={{ width: "100%", height: 120 }} onClick={() => setPicker("poster")}><ImageIcon size={20} /></div>}
          </div>
        </div>
        <div>
          <span className="field-lbl">…ou lien YouTube (au lieu d'un fichier)</span>
          <input className="inp" value={/youtu/.test(f.media_url) ? f.media_url : ""} placeholder="https://youtu.be/…"
            onChange={e => setF({ ...f, media_url: e.target.value })} />
        </div>
        <p style={{ fontSize: ".74rem", color: "var(--mute)", margin: 0, lineHeight: 1.6 }}>
          Les vidéos s'affichent en <b style={{ color: "var(--mist)" }}>format vertical 9:16</b>. Filmez ou exportez au format
          portrait pour un rendu optimal. Sans vignette, l'aperçu se génère automatiquement (1ʳᵉ image du fichier ou miniature YouTube).
        </p>
        <label className="switch">
          <input type="checkbox" checked={f.visible} onChange={e => setF({ ...f, visible: e.target.checked })} />
          Visible sur le site
        </label>
      </div>

      {picker === "media" && <MediaPicker kind="video" onClose={() => setPicker(null)}
        onPick={a => { setF({ ...f, media_url: a.url }); setPicker(null); }} />}
      {picker === "poster" && <MediaPicker kind="image" onClose={() => setPicker(null)}
        onPick={a => { setF({ ...f, poster_url: a.url }); setPicker(null); }} />}
    </Modal>
  );
}
