import React, { useEffect, useState } from "react";
import { BarChart3, TrendingUp, MousePointerClick, PlayCircle, Mic, Users } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { supabase, hasSupabase } from "../lib/supabase.js";

const TT = { background: "#0E0720", border: "1px solid rgba(199,125,255,.3)", borderRadius: 10, color: "#EDE6F7" };
const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

/* Clé locale AAAA-MM-JJ (toISOString décalerait d'un jour à La Réunion). */
const cleJour = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

export default function Stats() {
  const [overview, setOverview] = useState(null);
  const [jours, setJours] = useState([]);
  const [mois, setMois] = useState([]);
  const [devices, setDevices] = useState([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (!hasSupabase) { setPret(true); return; }
    (async () => {
      const { data: ov } = await supabase.from("stats_overview").select("*").single();
      setOverview(ov || null);

      // 12 derniers mois d'événements, agrégés côté client
      const depuis = new Date(); depuis.setMonth(depuis.getMonth() - 12); depuis.setDate(1);
      const { data: ev } = await supabase.from("analytics_events")
        .select("type, device, created_at")
        .gte("created_at", depuis.toISOString())
        .order("created_at", { ascending: true })
        .limit(20000);
      const events = ev || [];

      // Évolution quotidienne (30 derniers jours)
      const parJour = {};
      for (let i = 29; i >= 0; i--) parJour[cleJour(new Date(Date.now() - i * 864e5))] = 0;
      // Évolution mensuelle (12 derniers mois)
      const parMois = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
        parMois[d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")] = 0;
      }
      const dev = { Mobile: 0, Ordinateur: 0, Tablette: 0 };
      const M = { mobile: "Mobile", desktop: "Ordinateur", tablet: "Tablette" };
      events.forEach(e => {
        if (e.type !== "visit") return;
        const d = new Date(e.created_at);
        const kj = cleJour(d);
        if (kj in parJour) parJour[kj]++;
        const km = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        if (km in parMois) parMois[km]++;
        if (M[e.device]) dev[M[e.device]]++;
      });
      setJours(Object.entries(parJour).map(([k, v]) => ({ d: k.slice(8) + "/" + k.slice(5, 7), v })));
      setMois(Object.entries(parMois).map(([k, v]) => ({ d: MOIS[Number(k.slice(5, 7)) - 1], v })));
      setDevices([
        { name: "Mobile", value: dev.Mobile, c: "#C77DFF" },
        { name: "Ordinateur", value: dev.Ordinateur, c: "#FF4D8D" },
        { name: "Tablette", value: dev.Tablette, c: "#EFDCA8" },
      ]);
      setPret(true);
    })();
  }, []);

  if (!pret) return <div className="loading">Chargement des statistiques…</div>;

  const n = (x) => (x == null ? "0" : new Intl.NumberFormat("fr-FR").format(x));
  const tuiles = [
    { icon: Users, k: "Visiteurs aujourd'hui", v: n(overview?.visiteurs_jour), d: "depuis minuit" },
    { icon: Users, k: "Visiteurs ce mois", v: n(overview?.visiteurs_mois), d: "mois en cours" },
    { icon: Users, k: "Visiteurs depuis le début", v: n(overview?.visiteurs_total), d: "au total" },
    { icon: MousePointerClick, k: "Clics « Réserver »", v: n(overview?.clics_reserver), d: "boutons du site" },
    { icon: TrendingUp, k: "Taux de conversion", v: overview?.taux_conversion != null ? overview.taux_conversion + " %" : "—", d: "demandes / visiteurs" },
    { icon: PlayCircle, k: "Lectures de vidéos", v: n(overview?.lectures_videos), d: "galerie" },
    { icon: Mic, k: "Écoutes de témoignages", v: n(overview?.ecoutes_audio), d: "avis vocaux" },
  ];

  const aucun = !overview || Number(overview.visiteurs_total) === 0;
  const aDevices = devices.some(d => d.value > 0);

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
      {aucun && (
        <div className="card" style={{ gridColumn: "1 / -1", borderColor: "rgba(239,220,166,.35)" }}>
          <h3 style={{ color: "var(--gold)" }}>Aucune visite enregistrée pour l'instant</h3>
          <p style={{ fontSize: ".84rem", color: "var(--mute)", margin: 0, lineHeight: 1.6 }}>
            La mesure démarre dès la prochaine visite du site public. Chaque visiteur est compté une fois
            par jour et par appareil ; les rechargements de page ne gonflent pas les chiffres.
          </p>
        </div>
      )}

      {tuiles.map((s, i) => (
        <div className="stat" key={i}>
          <div className="k">{s.k}</div><div className="v neon">{s.v}</div><div className="d">{s.d}</div>
        </div>
      ))}

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3><BarChart3 size={16} /> Évolution quotidienne (30 derniers jours)</h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={jours} margin={{ left: -24, right: 6, top: 6 }}>
              <defs>
                <linearGradient id="gj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C77DFF" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#C77DFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="d" stroke="#998CB2" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis stroke="#998CB2" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="v" name="Visiteurs" stroke="#C77DFF" strokeWidth={2} fill="url(#gj)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3><BarChart3 size={16} /> Évolution mensuelle (12 derniers mois)</h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mois} margin={{ left: -24, right: 6, top: 6 }}>
              <XAxis dataKey="d" stroke="#998CB2" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="#998CB2" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="v" name="Visiteurs" fill="#C77DFF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Appareils</h3>
        {!aDevices && <div style={{ color: "var(--mute)", fontSize: ".84rem" }}>Disponible dès les premières visites.</div>}
        {aDevices && (
          <>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={devices} dataKey="value" innerRadius={44} outerRadius={70} paddingAngle={3} stroke="none">
                    {devices.map((d, i) => <Cell key={i} fill={d.c} />)}
                  </Pie>
                  <Tooltip contentStyle={TT} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: ".76rem", color: "var(--mute)" }}>
              {devices.map((d, i) => (
                <span key={i}><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: d.c, marginRight: 6 }} />{d.name} ({d.value})</span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
