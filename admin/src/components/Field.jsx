import React from "react";

export function Text({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "block" }}>
      <span className="field-lbl">{label}</span>
      <input className="inp" value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

export function Area({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "block" }}>
      <span className="field-lbl">{label}</span>
      <textarea className="inp" style={{ minHeight: 80, resize: "vertical" }} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

export function Slider({ label, value, min = 0, max = 100, onChange, suffix = "" }) {
  return (
    <label style={{ display: "block" }}>
      <span className="field-lbl">{label} — {value}{suffix}</span>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--neon)" }} />
    </label>
  );
}

export function Toggle({ label, checked, onChange }) {
  return (
    <label className="switch"><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} /> {label}</label>
  );
}

export function Color({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
      <span className="field-lbl" style={{ margin: 0 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input value={value} onChange={e => onChange(e.target.value)} className="inp" style={{ width: 100, padding: "8px 10px" }} />
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 34, height: 34, border: "1px solid var(--edge-soft)", borderRadius: 8, background: "none", cursor: "pointer" }} />
      </span>
    </label>
  );
}

export function Card({ title, children }) {
  return <div className="card" style={{ marginBottom: 16 }}>
    {title && <h3>{title}</h3>}
    <div style={{ display: "grid", gap: 14 }}>{children}</div>
  </div>;
}
