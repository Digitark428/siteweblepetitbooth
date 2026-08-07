import React, { useEffect, useRef, useState, useMemo } from "react";
import { UploadCloud, Music, Search, Trash2 } from "lucide-react";
import { listMedia, uploadMedia, deleteMedia, humanSize } from "../lib/media.js";

const FILTERS = [["tous", "Tous"], ["image", "Photos"], ["video", "Vidéos"], ["audio", "Audio"]];

export default function Media() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("tous");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const refresh = () => listMedia().then(setItems);
  useEffect(() => { refresh(); }, []);

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setBusy(true);
    for (const f of files) {
      try { await uploadMedia(f); } catch (err) { alert("Import impossible : " + (err.message || err)); }
    }
    await refresh();
    setBusy(false);
    e.target.value = "";
  };

  const remove = async (m) => {
    if (!confirm(`Supprimer « ${m.name} » ?`)) return;
    setItems(items.filter(x => x.id !== m.id));
    await deleteMedia(m);
  };

  const shown = useMemo(() => {
    if (!items) return null;
    return items.filter(m =>
      (filter === "tous" || m.kind === filter) &&
      (!q || m.name.toLowerCase().includes(q.toLowerCase()))
    );
  }, [items, filter, q]);

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <Search size={15} />
          <input placeholder="Rechercher un média…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {FILTERS.map(([id, l]) => (
          <button key={id} className={`pill ${filter === id ? "on" : ""}`} onClick={() => setFilter(id)}>{l}</button>
        ))}
        <button className="btn btn--sm" onClick={() => fileRef.current.click()} disabled={busy}>
          <UploadCloud size={14} /> {busy ? "Import…" : "Importer"}
        </button>
        <input ref={fileRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={onFiles} />
      </div>

      {shown === null && <div className="loading">Chargement de la médiathèque…</div>}
      {shown && shown.length === 0 && (
        <div className="dropzone" onClick={() => fileRef.current.click()}>
          <UploadCloud size={28} /><div>Aucun média. Cliquez pour importer photos, vidéos, musiques ou audio.</div>
        </div>
      )}
      {shown && shown.length > 0 && (
        <div className="media-grid">
          {shown.map(m => (
            <div className="media-tile" key={m.id}>
              <span className="media-kind">{m.kind}</span>
              <button className="del" onClick={() => remove(m)} aria-label="Supprimer"><Trash2 size={14} /></button>
              {m.kind === "image" && <img className="media-thumb" src={m.url} alt={m.name} loading="lazy" />}
              {m.kind === "video" && <video className="media-thumb" src={m.url} muted preload="none" />}
              {m.kind === "audio" && <div className="media-thumb media-thumb--audio"><Music size={26} /></div>}
              <div className="media-info">
                <div className="n">{m.name}</div>
                <div className="m">{[m.kind, humanSize(m.size_bytes)].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
