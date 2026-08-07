import React, { useEffect, useRef, useState } from "react";
import { UploadCloud, Music, Check } from "lucide-react";
import Modal from "./Modal.jsx";
import { listMedia, uploadMedia, kindOf, humanSize } from "../lib/media.js";

/**
 * Ouvre la médiathèque pour choisir un fichier, ou en importer un nouveau.
 * props: kind ("image" | "video" | "audio"), onPick(asset), onClose()
 */
export default function MediaPicker({ kind = "image", onPick, onClose }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const refresh = () => listMedia().then(all => setItems(all.filter(m => !kind || m.kind === kind)));
  useEffect(() => { refresh(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (kind && kindOf(file) !== kind) {
      alert(`Ce sélecteur attend un fichier de type « ${kind} ».`);
      return;
    }
    setBusy(true);
    try {
      const asset = await uploadMedia(file);
      onPick(asset);
    } catch (err) {
      alert("Import impossible : " + (err.message || err));
    }
    setBusy(false);
  };

  const labelKind = { image: "une image", video: "une vidéo", audio: "un fichier audio" }[kind] || "un média";
  const accept = { image: "image/*", video: "video/*", audio: "audio/*" }[kind] || "";

  return (
    <Modal title={`Choisir ${labelKind}`} icon={UploadCloud} onClose={onClose}>
      <div className="dropzone" onClick={() => !busy && fileRef.current.click()} style={{ marginBottom: 18 }}>
        <UploadCloud size={26} /><div>{busy ? "Import en cours…" : "Importer un nouveau fichier"}</div>
      </div>
      <input ref={fileRef} type="file" accept={accept} hidden onChange={onFile} />

      {items === null && <div className="loading">Chargement…</div>}
      {items && items.length === 0 && <div className="empty">Aucun média pour l'instant. Importez-en un ci-dessus.</div>}
      {items && items.length > 0 && (
        <div className="media-grid">
          {items.map(m => (
            <div className="media-tile" key={m.id} onClick={() => onPick(m)}>
              {m.kind === "image" && <img className="media-thumb" src={m.url} alt={m.name} />}
              {m.kind === "video" && <video className="media-thumb" src={m.url} muted preload="none" />}
              {m.kind === "audio" && <div className="media-thumb media-thumb--audio"><Music size={26} /></div>}
              <div className="media-info"><div className="n">{m.name}</div><div className="m">{humanSize(m.size_bytes)}</div></div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
