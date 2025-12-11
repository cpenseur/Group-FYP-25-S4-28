// src/components/exportPDF.tsx
import React from "react";

type exportPDFProps = {
  open: boolean;
  onClose: () => void;
  onExport: () => void | Promise<void>;
};

export function exportPDF({ open, onClose, onExport }: exportPDFProps) {
  if (!open) return null;

  const handleClick = async () => {
    await onExport();
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "1.75rem 2rem",
          minWidth: "280px",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <p style={{ margin: "0 0 1.5rem", fontSize: "1.1rem", fontWeight: 600 }}>
          Want to export as PDF?
        </p>

        <button
          onClick={handleClick}
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "999px",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Export to PDF
        </button>
      </div>
    </div>
  );
}