"use client";
import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

export default function EditorModal({
  title,
  children,
  onClose,
  onSave,
  saveLabel = "Save",
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        <footer>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={onSave}>
            {saveLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
