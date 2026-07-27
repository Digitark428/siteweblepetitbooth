import SaveBar from "../components/SaveBar.jsx";
import React, { useState } from "react";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { useContent } from "../lib/content.jsx";
import { Text, Area, Slider, Toggle, Card } from "../components/Field.jsx";
import MediaPicker from "../components/MediaPicker.jsx";

export default function HomeEditor() {
  const { content, set } = useContent();
  const [pickPhoto, setPickPhoto] = useState(false);
  if (!content) return <div className="loading">Chargement…</div>;
  const h = content.hero;

  const setLine = (i, v) => set("manifeste", content.manifeste.map((l, j) => (j === i ? v : l)));
  const addLine = () => set("manifeste", [...content.manifeste, ""]);
  const delLine = (i) => set("manifeste", content.manifeste.filter((_, j) => j !== i));

  return (
    <div style={{ maxWidth: 760 }}>
      <Card title="Hero (première section)">
        <Text label="Titre" value={h.titre} onChange={v => set("hero.titre", v)} />
        <Text label="Sous-titre" value={h.sousTitre} onChange={v => set("hero.sousTitre", v)} />
        <Text label="Accroche (en gras)" value={h.claimFort} onChange={v => set("hero.claimFort", v)} />
        <Text label="Accroche (suite)" value={h.claim} onChange={v => set("hero.claim", v)} />
        <div className="grid2">
          <Text label="Bouton principal" value={h.ctaPrincipal} onChange={v => set("hero.ctaPrincipal", v)} />
          <Text label="Bouton secondaire" value={h.ctaSecondaire} onChange={v => set("hero.ctaSecondaire", v)} />
        </div>
      </Card>

      <Card title="Photo de fond du hero">
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {h.photoUrl
            ? <img src={h.photoUrl} onClick={() => setPickPhoto(true)} style={{ width: 160, height: 100, objectFit: "cover", borderRadius: 10, cursor: "pointer", border: "1px solid var(--edge-soft)" }} />
            : <div className="thumb thumb--pick" style={{ width: 160, height: 100 }} onClick={() => setPickPhoto(true)}><ImageIcon size={22} /></div>}
          <div style={{ flex: 1, display: "grid", gap: 12 }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setPickPhoto(true)}>Choisir une image</button>
            {h.photoUrl && <button className="btn btn--ghost btn--sm" onClick={() => set("hero.photoUrl", "")}>Retirer la photo</button>}
            <div style={{ fontSize: ".72rem", color: "var(--mute)" }}>Conseil : 2560×1440 px (min. 1920×1080), JPG optimisé.</div>
          </div>
        </div>
        <Slider label="Opacité" value={h.photoOpacite} onChange={v => set("hero.photoOpacite", v)} suffix=" %" />
        <Text label="Centrage (gauche/droite %, haut/bas %)" value={h.photoPosition} onChange={v => set("hero.photoPosition", v)} placeholder="50% 50%" />
      </Card>

      <Card title="Deuxième section — le manifeste">
        {content.manifeste.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input className="inp" value={l} onChange={e => setLine(i, e.target.value)} />
            <button className="ico danger" onClick={() => delLine(i)}><Trash2 size={15} /></button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" onClick={addLine} style={{ justifySelf: "start" }}><Plus size={14} /> Ajouter une ligne</button>
      </Card>

      <Card title="Compteur de clients">
        <Toggle label="Afficher le compteur sur le site" checked={content.compteur.visible} onChange={v => set("compteur.visible", v)} />
        <div className="grid2">
          <label><span className="field-lbl">Nombre</span>
            <input className="inp" type="number" value={content.compteur.nombre} onChange={e => set("compteur.nombre", Number(e.target.value))} /></label>
          <Text label="Texte" value={content.compteur.texte} onChange={v => set("compteur.texte", v)} />
        </div>
      </Card>

      {pickPhoto && <MediaPicker kind="image" onClose={() => setPickPhoto(false)}
        onPick={a => { set("hero.photoUrl", a.url); setPickPhoto(false); }} />}
    <SaveBar />
    </div>
  );
}
