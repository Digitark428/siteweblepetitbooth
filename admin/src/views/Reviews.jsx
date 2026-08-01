import React, { useState, useRef } from "react";
import { Plus, Trash2, Pencil, GripVertical, Star, Play, Pause, User, Mic, Link2, Copy, Check } from "lucide-react";
import Modal from "../components/Modal.jsx";
import MediaPicker from "../components/MediaPicker.jsx";
import { supabase, hasSupabase } from "../lib/supabase.js";

const EMPTY_TEXT = { kind: "text", prenom: "", nom: "", lieu: "", photo_url: "", texte: "", note: 5, visible: true };
const EMPTY_AUDIO = { kind: "audio", prenom: "", nom: "", lieu: "", photo_url: "", audio_url: "", visible: true };

export default function Reviews({ items, setItems }) {
  const [tab, setTab] = useState("text");
  const [editing, setEditing] = useState(null);
  const dragId = useRef(null);
  const [overId, setOverId] = useState(null);
  const [invite, setInvite] = useState(null);
  const [copied, setCopied] = useState(false);

  // Génère un lien d'invitation à déposer un avis (écrit ou vocal)
  const genLink = async () => {
    const token = "av" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    const base = window.location.origin + window.location.pathname.replace(/admin\/?$/, "");
    const url = base + "avis.html?type=" + (tab === "audio" ? "vocal" : "ecrit") + "&t=" + token;
    if (hasSupabase) {
      await supabase.from("review_invites").insert({ token, kind: tab, label: tab === "audio" ? "Avis vocal" : "Avis écrit" });
    }
    setInvite(url); setCopied(false);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch (_) { alert("Copie impossible. Sélectionnez le lien à la main."); }
  };

  if (items === null) return <div className="loading">Chargement des avis…</div>;

  const list = items.filter(r => r.kind === tab);

  const persistOrder = async (full) => {
    if (!hasSupabase) return;
    await Promise.all(full.map((it, i) => supabase.from("reviews").update({ position: i }).eq("id", it.id)));
  };
  const save = async (item) => {
    if (item.id) {
      setItems(items.map(x => (x.id === item.id ? item : x)));
      if (hasSupabase) await supabase.from("reviews").update(strip(item)).eq("id", item.id);
    } else {
      const withPos = { ...item, position: items.length };
      if (hasSupabase) {
        const { data } = await supabase.from("reviews").insert(strip(withPos)).select().single();
        setItems([...items, data || { ...withPos, id: "r" + Date.now() }]);
      } else {
        setItems([...items, { ...withPos, id: "r" + Date.now() }]);
      }
    }
    setEditing(null);
  };
  const remove = async (id) => {
    if (!confirm("Supprimer cet avis ?")) return;
    setItems(items.filter(x => x.id !== id));
    if (hasSupabase) await supabase.from("reviews").delete().eq("id", id);
  };
  const toggle = async (it) => {
    const v = !it.visible;
    setItems(items.map(x => (x.id === it.id ? { ...x, visible: v } : x)));
    if (hasSupabase) await supabase.from("reviews").update({ visible: v }).eq("id", it.id);
  };
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
      <div className="tabs">
        <button className={`tab ${tab === "text" ? "on" : ""}`} onClick={() => setTab("text")}>Avis classiques</button>
        <button className={`tab ${tab === "audio" ? "on" : ""}`} onClick={() => setTab("audio")}>Avis vocaux</button>
      </div>

      <div className="toolbar">
        <div style={{ flex: 1, color: "var(--mute)", fontSize: ".84rem" }}>Glissez pour réordonner. Nombre illimité.</div>
        <button className="btn btn--ghost btn--sm" onClick={genLink}>
          <Link2 size={14} /> Inviter un client
        </button>
        <button className="btn btn--sm" onClick={() => setEditing(tab === "text" ? { ...EMPTY_TEXT } : { ...EMPTY_AUDIO })}>
          <Plus size={14} /> Ajouter un avis
        </button>
      </div>

      {invite && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3><Link2 size={15} /> Lien à envoyer à votre client</h3>
          <p style={{ fontSize: ".8rem", color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.6 }}>
            Envoyez ce lien par SMS, WhatsApp ou e-mail. Le client remplit le formulaire
            {tab === "audio" ? " et enregistre son message vocal" : ""} : son avis est publié
            automatiquement dans la catégorie <b style={{ color: "var(--mist)" }}>{tab === "audio" ? "Avis vocaux" : "Avis écrits"}</b> du site.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input className="inp" readOnly value={invite} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 240, fontSize: ".82rem" }} />
            <button className="btn btn--sm" onClick={copyLink}>
              {copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setInvite(null)}>Fermer</button>
          </div>
        </div>
      )}

      {list.length === 0 && <div className="empty">Aucun avis {tab === "text" ? "classique" : "vocal"} pour l'instant.</div>}

      {list.map(r => (
        <div key={r.id}
          className={`row ${overId === r.id ? "over" : ""}`}
          style={{ gridTemplateColumns: "auto auto 1fr auto", opacity: dragId.current === r.id ? 0.4 : 1 }}
          draggable
          onDragStart={() => (dragId.current = r.id)}
          onDragOver={(e) => { e.preventDefault(); setOverId(r.id); }}
          onDragLeave={() => setOverId(o => (o === r.id ? null : o))}
          onDrop={() => onDrop(r.id)}
        >
          <span className="handle"><GripVertical size={16} /></span>
          {r.photo_url
            ? <img className="thumb thumb--round" src={r.photo_url} alt="" />
            : <div className="thumb thumb--round" style={{ display: "grid", placeItems: "center", color: "var(--mute)" }}><User size={18} /></div>}
          <div>
            <div className="who">{r.prenom} {r.nom} {r.lieu && <span style={{ color: "var(--mute)", fontWeight: 400 }}>· {r.lieu}</span>}</div>
            {r.kind === "text"
              ? <div className="meta" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Stars n={r.note} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>{r.texte}</span>
                </div>
              : <div className="meta"><VoicePreview url={r.audio_url} /></div>}
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <label className="switch" title="Visible sur le site"><input type="checkbox" checked={r.visible} onChange={() => toggle(r)} /></label>
            <button className="ico" onClick={() => setEditing(r)}><Pencil size={15} /></button>
            <button className="ico danger" onClick={() => remove(r.id)}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}

      {editing && <ReviewEditor item={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function strip(it) { const { id, ...rest } = it; return rest; }

function Stars({ n = 0 }) {
  return <span style={{ display: "inline-flex", gap: 2, color: "var(--gold)", flex: "none" }}>
    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={13} fill={i <= n ? "currentColor" : "none"} />)}
  </span>;
}

function VoicePreview({ url }) {
  const ref = useRef();
  const [playing, setPlaying] = useState(false);
  if (!url) return <span style={{ color: "var(--magenta)" }}>Aucun audio</span>;
  const toggle = () => {
    const a = ref.current;
    if (playing) { a.pause(); } else { a.play(); }
  };
  return (
    <span className="voice">
      <button className="voice-play" onClick={toggle}>{playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}</button>
      <span style={{ fontSize: ".78rem", color: "var(--mute)" }}>Témoignage vocal</span>
      <audio ref={ref} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </span>
  );
}

function ReviewEditor({ item, onSave, onClose }) {
  const [f, setF] = useState(item);
  const [picker, setPicker] = useState(null);   // "photo" | "audio"
  const isAudio = f.kind === "audio";

  return (
    <Modal title={item.id ? "Modifier l'avis" : (isAudio ? "Nouvel avis vocal" : "Nouvel avis")} icon={isAudio ? Mic : Star} onClose={onClose}
      foot={<>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Annuler</button>
        <button className="btn btn--sm" onClick={() => onSave(f)}>Enregistrer</button>
      </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="grid2">
          <div><span className="field-lbl">Prénom</span><input className="inp" value={f.prenom} onChange={e => setF({ ...f, prenom: e.target.value })} /></div>
          <div><span className="field-lbl">Nom</span><input className="inp" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} /></div>
        </div>
        <div><span className="field-lbl">Lieu</span><input className="inp" value={f.lieu} onChange={e => setF({ ...f, lieu: e.target.value })} placeholder="Saint-Pierre" /></div>

        <div>
          <span className="field-lbl">Photo</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {f.photo_url
              ? <img src={f.photo_url} className="thumb thumb--round" onClick={() => setPicker("photo")} style={{ cursor: "pointer" }} />
              : <div className="thumb thumb--round thumb--pick" onClick={() => setPicker("photo")}><User size={18} /></div>}
            <button className="btn btn--ghost btn--sm" onClick={() => setPicker("photo")}>Choisir une photo</button>
          </div>
        </div>

        {!isAudio && (
          <>
            <div>
              <span className="field-lbl">Note</span>
              <div className="stars-input">
                {[1, 2, 3, 4, 5].map(i => (
                  <button key={i} className={i <= f.note ? "on" : ""} onClick={() => setF({ ...f, note: i })}>
                    <Star size={22} fill={i <= f.note ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>
            <div><span className="field-lbl">Témoignage</span>
              <textarea className="inp" style={{ minHeight: 90, resize: "vertical" }} value={f.texte} onChange={e => setF({ ...f, texte: e.target.value })} />
            </div>
          </>
        )}

        {isAudio && (
          <div>
            <span className="field-lbl">Fichier audio</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {f.audio_url ? <VoicePreview url={f.audio_url} /> : <span style={{ color: "var(--mute)", fontSize: ".8rem" }}>Aucun fichier</span>}
              <button className="btn btn--ghost btn--sm" onClick={() => setPicker("audio")}>Choisir un audio</button>
            </div>
          </div>
        )}

        <label className="switch"><input type="checkbox" checked={f.visible} onChange={e => setF({ ...f, visible: e.target.checked })} /> Visible sur le site</label>
      </div>

      {picker === "photo" && <MediaPicker kind="image" onClose={() => setPicker(null)} onPick={a => { setF({ ...f, photo_url: a.url }); setPicker(null); }} />}
      {picker === "audio" && <MediaPicker kind="audio" onClose={() => setPicker(null)} onPick={a => { setF({ ...f, audio_url: a.url }); setPicker(null); }} />}
    </Modal>
  );
}
