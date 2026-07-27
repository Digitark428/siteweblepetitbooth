import React from "react";
import { X } from "lucide-react";

export default function Modal({ title, icon: Icon, children, onClose, foot }) {
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ position: "relative" }}>
        <button className="ico close" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        {title && <h3>{Icon && <Icon size={17} />} {title}</h3>}
        {children}
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}
