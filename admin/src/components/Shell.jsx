import React from "react";
import {
  Camera, LayoutDashboard, Home, Images, Star, Layers, Calendar as CalIcon,
  Inbox, FolderOpen, Music, Settings, BarChart3, LogOut, Eye, CircleDot, Bell,
  Undo2, UploadCloud, Check
} from "lucide-react";
import { useAuth } from "../lib/auth.jsx";
import { useContent } from "../lib/content.jsx";

export const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "galerie", label: "Galerie", icon: Images },
  { id: "avis", label: "Avis", icon: Star },
  { id: "formules", label: "Formules", icon: Layers },
  { id: "calendrier", label: "Calendrier", icon: CalIcon },
  { id: "reservations", label: "Réservations", icon: Inbox },
  { id: "medias", label: "Médias", icon: FolderOpen },
  { id: "musique", label: "Musique", icon: Music },
  { id: "parametres", label: "Paramètres", icon: Settings },
  { id: "stats", label: "Statistiques", icon: BarChart3 },
];

export default function Shell({ view, setView, nbNouvelles, children }) {
  const { signOut } = useAuth();
  const { dirty, publish, discard } = useContent();
  const current = NAV.find(n => n.id === view);

  const onPublish = async () => {
    if (!confirm("Publier les modifications ? Elles remplaceront la version en ligne.")) return;
    await publish();
  };
  const onDiscard = async () => {
    if (!confirm("Annuler toutes les modifications non publiées et revenir à la version en ligne ?")) return;
    await discard();
  };
  const preview = () => window.open("../index.html", "_blank");

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="cam"><Camera size={19} /></span>
          <span><b>LE PETIT <span className="neon">BOOTH</span></b><i>Administration</i></span>
        </div>
        <nav className="nav">
          {NAV.map(n => (
            <button key={n.id} className={view === n.id ? "on" : ""} onClick={() => setView(n.id)}>
              <n.icon size={17} />{n.label}
              {n.id === "reservations" && nbNouvelles > 0 && <span className="badge">{nbNouvelles}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button onClick={signOut}><LogOut size={17} /> Déconnexion</button>
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <h1>{current?.label}</h1>
          <span className="spacer" />
          {nbNouvelles > 0 && (
            <span className="chip chip--pink"><Bell size={13} /> {nbNouvelles} nouvelle{nbNouvelles > 1 ? "s" : ""}</span>
          )}
          {dirty
            ? <span className="chip"><CircleDot size={13} /> Modifications non publiées</span>
            : <span className="chip" style={{ color: "#8ff0b0", borderColor: "rgba(126,231,159,.3)" }}><Check size={13} /> À jour</span>}
          {dirty && <button className="btn btn--ghost btn--sm" onClick={onDiscard}><Undo2 size={14} /> Annuler</button>}
          <button className="btn btn--ghost btn--sm" onClick={preview}><Eye size={14} /> Prévisualiser</button>
          <button className="btn btn--sm" onClick={onPublish} disabled={!dirty}><UploadCloud size={14} /> Publier</button>
        </header>
        <div className="view">{children}</div>
      </main>
    </div>
  );
}
