import SaveBar from "../components/SaveBar.jsx";
import React, { useState, useRef } from "react";
import { Music, Play, Pause } from "lucide-react";
import { useContent } from "../lib/content.jsx";
import { Slider, Toggle, Card } from "../components/Field.jsx";
import MediaPicker from "../components/MediaPicker.jsx";

export default function MusicView() {
  const { content, set } = useContent();
  const [pick, setPick] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ref = useRef();
  if (!content) return <div className="loading">Chargement…</div>;
  const m = content.musique;

  const toggle = () => { const a = ref.current; if (!a) return; playing ? a.pause() : a.play(); };

  return (
    <div style={{ maxWidth: 560 }}>
      <Card title="Musique d'ambiance du site">
        <Toggle label="Activer la musique sur le site" checked={m.actif} onChange={v => set("musique.actif", v)} />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {m.url ? (
            <>
              <button className="voice-play" onClick={toggle}>{playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}</button>
              <span style={{ fontSize: ".82rem", color: "var(--mute)" }}>Piste sélectionnée</span>
              <audio ref={ref} src={m.url} loop={m.loop} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
            </>
          ) : <span style={{ fontSize: ".82rem", color: "var(--mute)" }}>Aucune piste</span>}
          <button className="btn btn--ghost btn--sm" onClick={() => setPick(true)} style={{ marginLeft: "auto" }}>
            <Music size={14} /> {m.url ? "Remplacer" : "Choisir une musique"}
          </button>
        </div>

        <Slider label="Volume" value={m.volume} onChange={v => set("musique.volume", v)} suffix=" %" />
        <Toggle label="Lecture automatique à l'ouverture" checked={m.autoplay} onChange={v => set("musique.autoplay", v)} />
        <Toggle label="Lecture en boucle" checked={m.loop} onChange={v => set("musique.loop", v)} />
        <p style={{ fontSize: ".74rem", color: "var(--mute)", margin: 0 }}>
          Note : les navigateurs bloquent souvent le son automatique tant que le visiteur n'a pas cliqué. Un bouton
          « couper / relancer la musique » s'affiche automatiquement en bas à droite du site pour le visiteur.
        </p>
      </Card>

      {pick && <MediaPicker kind="audio" onClose={() => setPick(false)} onPick={a => { set("musique.url", a.url); setPick(false); }} />}
    <SaveBar />
    </div>
  );
}
