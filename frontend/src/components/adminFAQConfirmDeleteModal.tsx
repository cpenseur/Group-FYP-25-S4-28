import React from "react";

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export default function AdminFAQConfirmDeleteModal({
  open,
  title = "Delete FAQ",
  description = "This action cannot be undone.",
  confirmText = "Delete",
  onConfirm,
  onCancel,
  busy,
}: Props) {
  if (!open) return null;

  return (
    <>
      <div className="adminfaqdel-backdrop" onClick={onCancel} />

      <div
        className="adminfaqdel-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adminfaqdel-head">
          <h2 className="adminfaqdel-title">{title}</h2>
          <button
            className="adminfaqdel-close"
            onClick={onCancel}
            aria-label="Close"
            disabled={!!busy}
          >
            ✕
          </button>
        </div>

        <p className="adminfaqdel-desc">{description}</p>

        <div className="adminfaqdel-actions">
          <button className="adminfaqdel-btn" onClick={onCancel} disabled={!!busy}>
            Cancel
          </button>
          <button
            className="adminfaqdel-btn adminfaqdel-btn-danger"
            onClick={onConfirm}
            disabled={!!busy}
          >
            {busy ? "Deleting…" : confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .adminfaqdel-backdrop{
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          z-index: 9998;
        }
        .adminfaqdel-card{
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(520px, 96vw);
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 30px 80px rgba(15, 23, 42, 0.25);
          border: 1px solid rgba(229, 231, 235, 0.9);
          overflow: hidden;
          z-index: 9999;
          padding: 16px 18px 18px;
        }
        .adminfaqdel-head{
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .adminfaqdel-title{
          margin: 0;
          font-size: 1.05rem;
        }
        .adminfaqdel-close{
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
        }
        .adminfaqdel-desc{
          margin: 10px 0 0;
          color: #6b7280;
          font-size: 0.9rem;
        }
        .adminfaqdel-actions{
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .adminfaqdel-btn{
          border-radius: 999px;
          padding: 0.5rem 1rem;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .adminfaqdel-btn-danger{
          background: #b91c1c;
          color: #fff;
          border-color: transparent;
        }
        .adminfaqdel-btn:disabled{
          opacity: 0.6;
          cursor: default;
        }
      `}</style>
    </>
  );
}
