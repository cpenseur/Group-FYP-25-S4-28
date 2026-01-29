import React, { useEffect, useState } from "react";

export type AdminFAQFormData = {
  country: string;
  category: string;
  question: string;
  answer: string;
  is_published: boolean;
};

type Props = {
  open: boolean;
  initialData?: (AdminFAQFormData & { id?: number }) | null;
  onClose: () => void;
  onSave: (data: AdminFAQFormData) => Promise<void>;
};

export default function AdminFAQModal({
  open,
  initialData,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<AdminFAQFormData>({
    country: "",
    category: "",
    question: "",
    answer: "",
    is_published: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setForm({
        country: initialData.country ?? "",
        category: initialData.category ?? "",
        question: initialData.question ?? "",
        answer: initialData.answer ?? "",
        is_published:
          typeof initialData.is_published === "boolean"
            ? initialData.is_published
            : true,
      });
      setError(null);
    } else {
      setForm({
        country: "",
        category: "",
        question: "",
        answer: "",
        is_published: true,
      });
      setError(null);
    }
  }, [initialData, open]);

  if (!open) return null;

  const update = (k: keyof AdminFAQFormData, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    if (!form.country.trim()) return "Country is required.";
    if (!form.category.trim()) return "Category is required.";
    if (!form.question.trim()) return "Question is required.";
    if (!form.answer.trim()) return "Answer is required.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        country: form.country.trim(),
        category: form.category.trim(),
        question: form.question.trim(),
        answer: form.answer.trim(),
        is_published: !!form.is_published,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save FAQ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adminfaq-modal-backdrop" onClick={onClose} />
      <div
        className="adminfaq-modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adminfaq-modal-head">
          <div>
            <h2 className="adminfaq-modal-title">
              {initialData ? "Edit FAQ" : "Create FAQ"}
            </h2>
            <p className="adminfaq-modal-sub">
              All fields are required. Published controls visibility in Discovery.
            </p>
          </div>

          <button
            className="adminfaq-modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="adminfaq-modal-body">
          {error && <div className="adminfaq-error">{error}</div>}

          <div className="adminfaq-grid">
            <div className="adminfaq-field">
              <label>Country</label>
              <input
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                placeholder="e.g. Japan"
                disabled={saving}
              />
            </div>

            <div className="adminfaq-field">
              <label>Category</label>
              <input
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                placeholder="e.g. Transport"
                disabled={saving}
              />
            </div>

            <div className="adminfaq-field adminfaq-field-wide">
              <label>Question</label>
              <textarea
                value={form.question}
                onChange={(e) => update("question", e.target.value)}
                placeholder="Type the FAQ question…"
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="adminfaq-field adminfaq-field-wide">
              <label>Answer</label>
              <textarea
                value={form.answer}
                onChange={(e) => update("answer", e.target.value)}
                placeholder="Type the FAQ answer…"
                rows={6}
                disabled={saving}
              />
            </div>

            <div className="adminfaq-field adminfaq-checkbox">
              <label className="adminfaq-checkbox-row">
                <input
                  type="checkbox"
                  checked={!!form.is_published}
                  onChange={(e) => update("is_published", e.target.checked)}
                  disabled={saving}
                />
                Published
              </label>
              <div className="adminfaq-help">
                Unpublished FAQs remain in the database but are hidden from users.
              </div>
            </div>
          </div>

          <div className="adminfaq-modal-actions">
            <button
              className="adminfaq-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="adminfaq-btn adminfaq-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .adminfaq-modal-backdrop{
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          z-index: 9998;
        }
        .adminfaq-modal-card{
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(860px, 96vw);
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 30px 80px rgba(15, 23, 42, 0.25);
          border: 1px solid rgba(229, 231, 235, 0.9);
          overflow: hidden;
          z-index: 9999;
        }
        .adminfaq-modal-head{
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px 18px;
          border-bottom: 1px solid #eef2f7;
          gap: 12px;
        }
        .adminfaq-modal-title{
          margin: 0;
          font-size: 1.1rem;
        }
        .adminfaq-modal-sub{
          margin: 0.25rem 0 0;
          font-size: 0.85rem;
          color: #6b7280;
        }
        .adminfaq-modal-close{
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          flex: 0 0 auto;
        }
        .adminfaq-modal-body{
          padding: 16px 18px 18px;
        }
        .adminfaq-error{
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 0.9rem;
          margin-bottom: 12px;
          white-space: pre-wrap;
        }
        .adminfaq-grid{
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .adminfaq-field{
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .adminfaq-field-wide{
          grid-column: 1 / -1;
        }
        .adminfaq-field label{
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 700;
          color: #6b7280;
        }
        .adminfaq-field input,
        .adminfaq-field textarea{
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 0.95rem;
          outline: none;
        }
        .adminfaq-field textarea{
          resize: vertical;
        }
        .adminfaq-checkbox{
          grid-column: 1 / -1;
        }
        .adminfaq-checkbox-row{
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: #111827;
          text-transform: none;
          letter-spacing: 0;
          font-size: 0.95rem;
        }
        .adminfaq-help{
          font-size: 0.85rem;
          color: #6b7280;
          margin-top: 6px;
        }
        .adminfaq-modal-actions{
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .adminfaq-btn{
          border-radius: 999px;
          padding: 0.5rem 1rem;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .adminfaq-btn-primary{
          border-color: transparent;
          background: #111827;
          color: #fff;
        }
        .adminfaq-btn:disabled{
          opacity: 0.6;
          cursor: default;
        }
        @media (max-width: 700px){
          .adminfaq-grid{
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
