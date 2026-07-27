import React from "react";
import { Check } from "lucide-react";

const MAP = {
  accueil: { t: "Édition de la page d'accueil", items: ["Titre, sous-titre et slogan du hero", "Photo de fond + opacité + centrage", "Compteur de clients (nombre, texte, affichage)", "Tous les textes des sections"] },
  galerie: { t: "Gestion de la galerie vidéo", items: ["Ajouter / modifier / supprimer des vidéos", "Réordonner par glisser-déposer", "Titres et descriptions personnalisés", "Vignette (poster) de chaque vidéo"] },
  avis: { t: "Gestion des avis clients", items: ["Avis classiques : prénom, nom, lieu, photo, texte, étoiles", "Avis vocaux : photo + fichier audio avec lecteur animé", "Nombre illimité, réordonnables", "Masquer / afficher chaque avis"] },
  formules: { t: "Formules & tarifs", items: ["Modifier prix, titres et descriptions", "Ajouter ou retirer des lignes", "Choisir la formule mise en avant", "Mettre en valeur le sur-mesure"] },
  medias: { t: "Bibliothèque de médias", items: ["Importer photos, vidéos, musiques, audio", "Aperçu, nom, taille, format", "Recherche et filtres", "Réutilisable partout sur le site"] },
  musique: { t: "Musique d'ambiance", items: ["Importer / remplacer la musique", "Réglage du volume", "Lecture automatique et boucle", "Activer / désactiver"] },
  parametres: { t: "Paramètres du site", items: ["Couleurs et polices", "Logo et favicon", "Coordonnées et réseaux sociaux", "Historique des versions publiées"] },
  stats: { t: "Statistiques détaillées", items: ["Visiteurs jour / mois / total", "Conversion, clics Réserver", "Lectures vidéos et écoutes audio", "Pages les plus visitées, appareils"] },
};

export default function Soon({ view }) {
  const s = MAP[view];
  if (!s) return null;
  return (
    <div className="soon">
      <h3 className="neon">{s.t}</h3>
      <p>Cette section fait partie du back-office complet. Voici ce qu'elle permettra de gérer, entièrement sans toucher au code :</p>
      <ul>{s.items.map((it, i) => <li key={i}><Check size={16} /> {it}</li>)}</ul>
    </div>
  );
}
