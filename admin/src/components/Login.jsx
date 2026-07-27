import React, { useState } from "react";
import { Camera, Lock } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";

export default function Login() {
  const { signIn, demo } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr("");
    const { error } = await signIn(email, pw);
    if (error) setErr(error.message === "Invalid login credentials" ? "E-mail ou mot de passe incorrect." : error.message);
    setBusy(false);
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="cam"><Camera size={26} /></div>
        <h2>Administration</h2>
        <p className="sub"><span className="neon">Le Petit Booth</span> — accès réservé</p>

        {demo && (
          <div className="demo-banner">
            Mode démonstration : aucune base connectée. Renseignez le fichier
            <b> .env </b> pour activer la connexion sécurisée. Mot de passe de test :
            <b> lepetitboothstudio</b>.
          </div>
        )}

        {!demo && (
          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" value={email} autoFocus
              autoComplete="username"
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="vous@lepetitbooth.re" />
          </div>
        )}

        <div className="field">
          <label>Mot de passe</label>
          <input className="input" type="password" value={pw}
            autoComplete="current-password"
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="••••••••••••" />
          <p className="err">{err}</p>
        </div>

        <button className="btn btn--wide" onClick={submit} disabled={busy}>
          <Lock size={15} /> {busy ? "Connexion…" : "Entrer"}
        </button>
        <p className="hint"><Lock size={12} /> Connexion chiffrée</p>
      </div>
    </div>
  );
}
