import React, { useEffect, useState } from "react";
import { BarChart3, LayoutDashboard, Calendar as CalIcon } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { supabase, hasSupabase } from "../lib/supabase.js";
import { fmtDate } from "../lib/format.js";

const TT = { background: "#0E0720", border: "1px solid rgba(199,125,255,.3)", borderRadius: 10, color: "#EDE6F7" };
const DEMO_VISITS = [
  { d: "Lun", v: 42 }, { d: "Mar", v: 61 }, { d: "Mer", v: 55 }, { d: "Jeu", v: 78 },
  { d: "Ven", v: 96 }, { d: "Sam", v: 134 }, { d: "Dim", v: 88 },
];
const DEMO_DEVICES = [
  { name: "Mobile", value: 68, c: "#C77DFF" },
  { name: "Ordinateur", value: 24, c: "#FF4D8D" },
  { name: "Tablette", value: 8, c: "#EFDCA8" },
];

export default function Dashboard({ reservations, calendar }) {
  const [overview, setOverview] = useState(null);
  const [visits, setVisits] = useState(null);
  const [devices, setDevices] = useState(null);

  useEffect(() => {
    if (!hasSupabase) return;
    supabase.from("stats_overview").select("*").single().then(({ data }) => setOverview(data));

    // 7 derniers jours + répartition appareils, agrégés côté client
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    supabase.from("analytics_events").select("type, device, created_at").gte("created_at", since)
      .then(({ data }) => {
        if (!data) return;
        const JS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
        const days = {};
        for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); days[JS[d.getDay()]] = 0; }
        const dev = { Mobile: 0, Ordinateur: 0, Tablette: 0 };
        const M = { mobile: "Mobile", desktop: "Ordinateur", tablet: "Tablette" };
        data.forEach(e => {
          if (e.type === "visit") { const l = JS[new Date(e.created_at).getDay()]; if (l in days) days[l]++; if (M[e.device]) dev[M[e.device]]++; }
        });
        const total = data.filter(e => e.type === "visit").length;
        if (total > 0) {
          setVisits(Object.entries(days).map(([d, v]) => ({ d, v })));
          setDevices([
            { name: "Mobile", value: dev.Mobile, c: "#C77DFF" },
            { name: "Ordinateur", value: dev.Ordinateur, c: "#FF4D8D" },
            { name: "Tablette", value: dev.Tablette, c: "#EFDCA8" },
          ]);
        }
      });
  }, []);

  const visitData = visits || DEMO_VISITS;
  const deviceData = devices || DEMO_DEVICES;

  const nbNouvelles = (reservations || []).filter(r => r.statut === "nouvelle").length;
  const upcoming = (calendar || []).filter(e => e.date_evenement >= new Date().toISOString().slice(0, 10)).slice(0, 3);

  const stats = [
    { k: "Visiteurs aujourd'hui", v: overview ? String(overview.visiteurs_jour) : "88", d: "en direct" },
    { k: "Visiteurs ce mois", v: overview ? String(overview.visiteurs_mois) : "2 341", d: "30 derniers jours" },
    { k: "Demandes à traiter", v: String(nbNouvelles), d: "réservations nouvelles" },
    { k: "Clics « Réserver »", v: overview ? String(overview.clics_reserver) : "312", d: "depuis le site" },
  ];

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
      {stats.map((s, i) => (
        <div className="stat" key={i}>
          <div className="k">{s.k}</div><div className="v neon">{s.v}</div><div className="d">{s.d}</div>
        </div>
      ))}

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3><BarChart3 size={16} /> Visiteurs (7 derniers jours)</h3>
        <div style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visitData} margin={{ left: -20, right: 6, top: 6 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C77DFF" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#C77DFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="d" stroke="#998CB2" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="v" stroke="#C77DFF" strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3><LayoutDashboard size={16} /> Appareils</h3>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={deviceData} dataKey="value" innerRadius={44} outerRadius={70} paddingAngle={3} stroke="none">
                {deviceData.map((d, i) => <Cell key={i} fill={d.c} />)}
              </Pie>
              <Tooltip contentStyle={TT} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: ".76rem", color: "var(--mute)" }}>
          {deviceData.map((d, i) => (
            <span key={i}><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: d.c, marginRight: 6 }} />{d.name}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <h3><CalIcon size={16} /> Prochaines dates</h3>
        {upcoming.length === 0 && <div style={{ color: "var(--mute)", fontSize: ".84rem" }}>Aucune date à venir.</div>}
        {upcoming.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--edge-soft)" }}>
            <span className={`tag ${e.statut}`}>{e.statut === "confirmee" ? "Confirmée" : "Devis"}</span>
            <span style={{ fontSize: ".84rem" }}>{fmtDate(e.date_evenement)} · {e.ville}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
