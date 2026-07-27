import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "./lib/auth.jsx";
import { supabase, hasSupabase } from "./lib/supabase.js";
import Login from "./components/Login.jsx";
import Shell from "./components/Shell.jsx";
import Dashboard from "./views/Dashboard.jsx";
import Reservations from "./views/Reservations.jsx";
import Calendar from "./views/Calendar.jsx";
import Gallery from "./views/Gallery.jsx";
import Reviews from "./views/Reviews.jsx";
import Media from "./views/Media.jsx";
import HomeEditor from "./views/HomeEditor.jsx";
import Formulas from "./views/Formulas.jsx";
import MusicView from "./views/MusicView.jsx";
import Settings from "./views/Settings.jsx";
import Soon from "./views/Soon.jsx";

/* Données de démonstration (utilisées si aucune base n'est connectée) */
const DEMO_RES = [
  { id: "d1", prenom: "Laëtitia", nom: "Hoarau", telephone: "0692 45 12 88", email: "l.hoarau@exemple.re", formule: "Expérience", type_evenement: "Mariage", date_evenement: "2026-09-12", nb_invites: 120, message: "Salle à Saint-Gilles, début vers 20h.", statut: "nouvelle" },
  { id: "d2", prenom: "Sandrine", nom: "Bègue", telephone: "0693 71 04 55", email: "s.begue@exemple.re", formule: "Signature", type_evenement: "Entreprise", date_evenement: "2026-11-28", nb_invites: 200, message: "Soirée de fin d'année, logo à intégrer.", statut: "nouvelle" },
  { id: "d3", prenom: "Jérémy", nom: "Robert", telephone: "0692 33 90 21", email: "j.robert@exemple.re", formule: "Essentiel", type_evenement: "Anniversaire", date_evenement: "2026-08-30", nb_invites: 40, message: "30 ans, ambiance dancefloor.", statut: "traitee" },
];
const DEMO_CAL = [
  { id: "c1", date_evenement: "2026-08-30", heure: "19:00", ville: "Saint-Pierre", type_evenement: "Anniversaire", statut: "confirmee" },
  { id: "c2", date_evenement: "2026-09-12", heure: "20:00", ville: "Saint-Gilles", type_evenement: "Mariage", statut: "confirmee" },
  { id: "c3", date_evenement: "2026-11-28", heure: "18:30", ville: "Le Port", type_evenement: "Entreprise", statut: "devis" },
];
const DEMO_GALLERY = [
  { id: "g1", title: "Mariage · Saint-Gilles", description: "Ambiance dancefloor au coucher du soleil", media_url: "", poster_url: "", position: 0, visible: true },
  { id: "g2", title: "Anniversaire · 30 ans", description: "Passages best-of de la soirée", media_url: "", poster_url: "", position: 1, visible: true },
  { id: "g3", title: "Soirée entreprise", description: "Team-building au Port", media_url: "", poster_url: "", position: 2, visible: true },
];
const DEMO_REVIEWS = [
  { id: "r1", kind: "text", prenom: "Laëtitia", nom: "H.", lieu: "Saint-Gilles", photo_url: "", texte: "Nos invités ont fait la queue toute la soirée !", note: 5, position: 0, visible: true },
  { id: "r2", kind: "text", prenom: "Sandrine", nom: "B.", lieu: "Le Port", photo_url: "", texte: "Installation impeccable pour notre soirée d'entreprise.", note: 5, position: 1, visible: true },
  { id: "r3", kind: "audio", prenom: "Jérémy", nom: "R.", lieu: "Saint-Pierre", photo_url: "", audio_url: "", position: 2, visible: true },
];

export default function App() {
  const { session, ready } = useAuth();
  const [view, setView] = useState("dashboard");
  const [reservations, setReservations] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [reviews, setReviews] = useState(null);

  const load = useCallback(async () => {
    if (!hasSupabase) {
      setReservations(DEMO_RES);
      setCalendar(DEMO_CAL);
      setGallery(DEMO_GALLERY);
      setReviews(DEMO_REVIEWS);
      return;
    }
    const [r, c, g, a] = await Promise.all([
      supabase.from("reservations").select("*").order("created_at", { ascending: false }),
      supabase.from("calendar_events").select("*").order("date_evenement", { ascending: true }),
      supabase.from("gallery_items").select("*").order("position", { ascending: true }),
      supabase.from("reviews").select("*").order("position", { ascending: true }),
    ]);
    setReservations(r.error ? [] : r.data);
    setCalendar(c.error ? [] : c.data);
    setGallery(g.error ? [] : g.data);
    setReviews(a.error ? [] : a.data);
  }, []);

  useEffect(() => { if (session) load(); }, [session, load]);

  if (!ready) return null;
  if (!session) return <Login />;

  const nbNouvelles = (reservations || []).filter(r => r.statut === "nouvelle").length;

  return (
    <Shell view={view} setView={setView} nbNouvelles={nbNouvelles}>
      {view === "dashboard" && <Dashboard reservations={reservations} calendar={calendar} />}
      {view === "reservations" && <Reservations items={reservations} reload={load} setItems={setReservations} />}
      {view === "calendrier" && <Calendar items={calendar} reload={load} setItems={setCalendar} />}
      {view === "galerie" && <Gallery items={gallery} setItems={setGallery} />}
      {view === "avis" && <Reviews items={reviews} setItems={setReviews} />}
      {view === "medias" && <Media />}
      {view === "accueil" && <HomeEditor />}
      {view === "formules" && <Formulas />}
      {view === "musique" && <MusicView />}
      {view === "parametres" && <Settings />}
      {view === "stats" && <Soon view="stats" />}
    </Shell>
  );
}
