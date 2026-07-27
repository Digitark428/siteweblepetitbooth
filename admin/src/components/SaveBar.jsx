import React, { useState } from "react";
import { Save, Check, AlertCircle } from "lucide-react";
import { useContent } from "../lib/content.jsx";

/**
 * Barre « Enregistrer » collée en bas de chaque page d'édition de contenu.
 * Enregistrer = publier immédiatement sur le site public.
 */
export default function SaveBar() {
  const { dirty, publish } = useContent();
  const [state, setState] = useState("idle"); // idle | saving | ok | error

  const onSave = async () => {
    setState("saving");
    const { error } = await publish();
    setState(error ? "error" : "ok");
    if (!error) setTimeout(() => setState("idle"), 4000);
  };

  return (
    <div className="savebar">
      <div className="savebar-msg">
        {state === "ok" && <span className="ok"><Check size={16} /> Modifications enregistrées avec succès et publiées sur le site.</span>}
        {state === "error" && <span className="ko"><AlertCircle size={16} /> L'enregistrement a échoué. Réessayez.</span>}
        {state !== "ok" && state !== "error" && dirty && <span className="pending">Modifications non enregistrées</span>}
        {state !== "ok" && state !== "error" && !dirty && <span className="clean">Tout est enregistré</span>}
      </div>
      <button className="btn" onClick={onSave} disabled={state === "saving" || (!dirty && state === "idle")}>
        <Save size={15} /> {state === "saving" ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
