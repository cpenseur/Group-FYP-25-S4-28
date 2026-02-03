// src/pages/adminFAQManageView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type FAQ = {
  id: number;
  country: string;
  category: string;
  question: string;
  answer: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type FAQForm = {
  country: string;
  category: string;
  question: string;
  answer: string;
  is_published: boolean;
};

const API_ROOT = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";
const API_BASE = `${API_ROOT}/api/f8/destination-faqs/`;

async function getAccessToken() {
  const { data: s1 } = await supabase.auth.getSession();
  if (s1.session?.access_token) return s1.session.access_token;

  const { data: s2 } = await supabase.auth.refreshSession();
  return s2.session?.access_token || null;
}

async function authHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}) {
  const headers = await authHeaders(init.headers);
  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Not authenticated");
  }
  return res;
}

function normalizeApiError(e: unknown) {
  if (e instanceof Error) return e.message;
  return "Unknown error";
}


function FAQModal(props: {
  open: boolean;
  mode: "create" | "edit";
  initial: FAQForm;
  title: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (next: FAQForm) => void;
  onSubmit: () => void;
}) {
  const { open, mode, initial, title, submitting, error, onClose, onChange, onSubmit } = props;

  if (!open) return null;

  const canSubmit =
    initial.country.trim() &&
    initial.category.trim() &&
    initial.question.trim() &&
    initial.answer.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="faq-modal-overlay"
      onMouseDown={(e) => {
        // close when clicking overlay (but not when clicking inside modal)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="faq-modal">
        <div className="faq-modal-header">
          <div>
            <div className="faq-modal-title">{title}</div>
            <div className="faq-modal-subtitle">
              {mode === "create" ? "Add a new community FAQ" : "Update this community FAQ"}
            </div>
          </div>
          <button className="faq-modal-close" onClick={onClose} disabled={submitting} title="Close">
            ✕
          </button>
        </div>

        {error && <div className="faq-modal-error">⚠️ {error}</div>}

        <div className="faq-modal-body">
          <div className="faq-form-grid">
            <label className="faq-form-field">
              <span>Country</span>
              <input
                className="faq-form-input"
                value={initial.country}
                onChange={(e) => onChange({ ...initial, country: e.target.value })}
                placeholder="e.g., Japan"
                disabled={submitting}
              />
            </label>

            <label className="faq-form-field">
              <span>Category</span>
              <input
                className="faq-form-input"
                value={initial.category}
                onChange={(e) => onChange({ ...initial, category: e.target.value })}
                placeholder="e.g., Transport"
                disabled={submitting}
              />
            </label>

            <label className="faq-form-field faq-form-field--full">
              <span>Question</span>
              <input
                className="faq-form-input"
                value={initial.question}
                onChange={(e) => onChange({ ...initial, question: e.target.value })}
                placeholder="e.g., Do I need a JR Pass?"
                disabled={submitting}
              />
            </label>

            <label className="faq-form-field faq-form-field--full">
              <span>Answer</span>
              <textarea
                className="faq-form-textarea"
                value={initial.answer}
                onChange={(e) => onChange({ ...initial, answer: e.target.value })}
                placeholder="Write the answer…"
                disabled={submitting}
                rows={7}
              />
            </label>

            <label className="faq-form-field faq-form-switch">
              <input
                type="checkbox"
                checked={initial.is_published}
                onChange={(e) => onChange({ ...initial, is_published: e.target.checked })}
                disabled={submitting}
              />
              <span>Published</span>
            </label>
          </div>
        </div>

        <div className="faq-modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : mode === "create" ? "Create FAQ" : "Save Changes"}
          </button>
        </div>
      </div>

      <style>{`
        .faq-modal-overlay{
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          z-index: 9999;
        }
        .faq-modal{
          width: min(820px, 100%);
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(15,23,42,0.25);
          overflow: hidden;
        }
        .faq-modal-header{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 1rem;
          padding: 1.1rem 1.25rem;
          border-bottom: 1px solid #eef2f7;
        }
        .faq-modal-title{
          font-size: 1.05rem;
          font-weight: 800;
          color:#0f172a;
        }
        .faq-modal-subtitle{
          margin-top: .25rem;
          font-size: .86rem;
          color:#64748b;
        }
        .faq-modal-close{
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background:#fff;
          cursor:pointer;
        }
        .faq-modal-close:hover{ background:#f8fafc; }
        .faq-modal-error{
          margin: .9rem 1.25rem 0;
          padding: .75rem .9rem;
          border-radius: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color:#991b1b;
          font-size:.88rem;
        }
        .faq-modal-body{ padding: 1rem 1.25rem 1.1rem; }
        .faq-form-grid{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: .9rem 1rem;
        }
        .faq-form-field{
          display:flex;
          flex-direction:column;
          gap:.4rem;
          font-size:.85rem;
          color:#334155;
        }
        .faq-form-field--full{ grid-column: 1 / -1; }
        .faq-form-input{
          padding: .7rem .9rem;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          outline:none;
          font-size:.92rem;
        }
        .faq-form-input:focus{ border-color:#2563eb; }
        .faq-form-textarea{
          padding: .7rem .9rem;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          outline:none;
          font-size:.92rem;
          resize: vertical;
        }
        .faq-form-textarea:focus{ border-color:#2563eb; }
        .faq-form-switch{
          grid-column: 1 / -1;
          display:flex;
          flex-direction:row;
          align-items:center;
          gap:.6rem;
          padding-top: .25rem;
          user-select:none;
        }
        .faq-modal-footer{
          display:flex;
          justify-content:flex-end;
          gap:.75rem;
          padding: 1rem 1.25rem;
          border-top: 1px solid #eef2f7;
          background:#fbfdff;
        }
      `}</style>
    </div>
  );
}

export default function AdminFAQManageView() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FAQForm>({
    country: "",
    category: "",
    question: "",
    answer: "",
    is_published: true,
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchFAQs = async () => {
    setLoading(true);
    try {
      let url = API_BASE;

      if (search.trim()) {
        url += `?search=${encodeURIComponent(search.trim())}`;
      }

      const response = await fetch(url, { headers: { Accept: "application/json" } });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setFaqs(Array.isArray(data) ? data : []);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFAQs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredFAQs = useMemo(() => {
    return faqs.filter((faq) => {
      if (countryFilter !== "all" && faq.country !== countryFilter) return false;
      return true;
    });
  }, [faqs, countryFilter]);

  const countries = useMemo(
    () => Array.from(new Set(faqs.map((f) => f.country).filter(Boolean))),
    [faqs]
  );

  const handleSelectAll = () => {
    if (selectedIds.size === filteredFAQs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFAQs.map((faq) => faq.id)));
    }
  };

  const handleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkPublish = async (isPublished: boolean) => {
    if (selectedIds.size === 0) {
      alert("Please select at least one FAQ");
      return;
    }

    const action = isPublished ? "publish" : "unpublish";
    const confirmed = window.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} ${selectedIds.size} FAQ(s)?`
    );
    if (!confirmed) return;

    setBulkLoading(true);
    try {
      const response = await fetch(`${API_BASE}bulk/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), is_published: isPublished }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      await fetchFAQs();
      alert(`Successfully ${action}ed ${result.updated} FAQ(s)`);
    } catch (error) {
      console.error("Error bulk updating FAQs:", error);
      alert("Failed to update FAQs");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleTogglePublish = async (faq: FAQ) => {
    try {
      const response = await fetch(`${API_BASE}${faq.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ is_published: !faq.is_published }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await fetchFAQs();
    } catch (error) {
      console.error("Error toggling publish status:", error);
      alert("Failed to update FAQ status");
    }
  };

  const handleDelete = async (faq: FAQ) => {
    const confirmed = window.confirm(`Delete FAQ: "${faq.question}"?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}${faq.id}/`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await fetchFAQs();
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      alert("Failed to delete FAQ");
    }
  };

  // ✅ NEW: open create modal
  const openCreate = () => {
    setModalError(null);
    setModalMode("create");
    setEditingId(null);
    setForm({
      country: countryFilter !== "all" ? countryFilter : "",
      category: "",
      question: "",
      answer: "",
      is_published: true,
    });
    setModalOpen(true);
  };

  // ✅ NEW: open edit modal
  const openEdit = (faq: FAQ) => {
    setModalError(null);
    setModalMode("edit");
    setEditingId(faq.id);
    setForm({
      country: faq.country || "",
      category: faq.category || "",
      question: faq.question || "",
      answer: faq.answer || "",
      is_published: !!faq.is_published,
    });
    setModalOpen(true);
  };

  // ✅ NEW: submit create/edit
  const submitModal = async () => {
    setModalSubmitting(true);
    setModalError(null);

    try {
      const payload = {
        country: form.country.trim(),
        category: form.category.trim(),
        question: form.question.trim(),
        answer: form.answer.trim(),
        is_published: form.is_published,
      };

      if (!payload.country || !payload.category || !payload.question || !payload.answer) {
        setModalError("Please fill in Country, Category, Question, and Answer.");
        setModalSubmitting(false);
        return;
      }

      if (modalMode === "create") {
        const res = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      } else {
        if (!editingId) throw new Error("Missing FAQ id for edit.");

        const res = await fetch(`${API_BASE}${editingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      }

      setModalOpen(false);
      await fetchFAQs();
    } catch (e) {
      console.error("Save FAQ failed:", e);
      // DRF often returns JSON; show raw string if possible
      setModalError(normalizeApiError(e));
    } finally {
      setModalSubmitting(false);
    }
  };

  const allSelected = filteredFAQs.length > 0 && selectedIds.size === filteredFAQs.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredFAQs.length;

  return (
    <div className="faq-manage-view">
      <FAQModal
        open={modalOpen}
        mode={modalMode}
        initial={form}
        title={modalMode === "create" ? "New FAQ" : "Edit FAQ"}
        submitting={modalSubmitting}
        error={modalError}
        onClose={() => {
          if (!modalSubmitting) setModalOpen(false);
        }}
        onChange={setForm}
        onSubmit={submitModal}
      />

      <div className="faq-header">
        <div>
          <h1 className="faq-title">FAQ Management</h1>
          <p className="faq-subtitle">Create, edit, publish or hide FAQs</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + New FAQ
        </button>
      </div>

      <div className="faq-toolbar">
        <input
          type="text"
          className="faq-search-input"
          placeholder="Search FAQs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") fetchFAQs();
          }}
        />

        <button className="btn btn-outline" onClick={fetchFAQs} disabled={loading}>
          🔍 {loading ? "Searching..." : "Search"}
        </button>

        <select
          className="faq-filter-select"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
        >
          <option value="all">All Countries</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>

        <button className="btn btn-outline" onClick={fetchFAQs} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="faq-bulk-bar">
          <div className="faq-bulk-info">
            <strong>{selectedIds.size}</strong> FAQ(s) selected
          </div>
          <div className="faq-bulk-actions">
            <button
              className="btn btn-outline faq-bulk-btn"
              onClick={() => handleBulkPublish(true)}
              disabled={bulkLoading}
            >
              ✓ Publish Selected
            </button>
            <button
              className="btn btn-outline faq-bulk-btn"
              onClick={() => handleBulkPublish(false)}
              disabled={bulkLoading}
            >
              👁️‍🗨️ Unpublish Selected
            </button>
            <button
              className="btn btn-outline faq-bulk-btn"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkLoading}
            >
              ✕ Clear Selection
            </button>
          </div>
        </div>
      )}

      <div className="faq-table-wrapper">
        {loading ? (
          <div className="faq-empty">Loading FAQs...</div>
        ) : filteredFAQs.length === 0 ? (
          <div className="faq-empty">
            {faqs.length === 0
              ? "No FAQs found. Create your first FAQ to get started."
              : "No FAQs match your filters."}
          </div>
        ) : (
          <table className="faq-table">
            <thead>
              <tr>
                <th style={{ width: "50px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    className="faq-checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={handleSelectAll}
                    title={allSelected ? "Deselect all" : "Select all"}
                  />
                </th>
                <th style={{ width: "120px" }}>Country</th>
                <th style={{ width: "140px" }}>Category</th>
                <th style={{ minWidth: "300px" }}>Question</th>
                <th style={{ width: "120px", textAlign: "center" }}>Status</th>
                <th style={{ width: "160px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredFAQs.map((faq) => (
                <tr key={faq.id} className={selectedIds.has(faq.id) ? "faq-row-selected" : ""}>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className="faq-checkbox"
                      checked={selectedIds.has(faq.id)}
                      onChange={() => handleSelectOne(faq.id)}
                    />
                  </td>

                  <td>
                    <span className="faq-country-badge">{faq.country || "-"}</span>
                  </td>

                  <td>
                    <span className="faq-category-text">{faq.category || "-"}</span>
                  </td>

                  <td>
                    <div className="faq-question-cell">
                      <div className="faq-question-text">{faq.question}</div>
                      <div className="faq-answer-preview">{faq.answer.slice(0, 100)}...</div>
                    </div>
                  </td>

                  <td style={{ textAlign: "center" }}>
                    <span
                      className={`faq-status-badge ${
                        faq.is_published ? "faq-status-badge--published" : "faq-status-badge--draft"
                      }`}
                    >
                      {faq.is_published ? "Published" : "Draft"}
                    </span>
                  </td>

                  <td>
                    <div className="faq-actions">
                      {/* ✅ EDIT now works */}
                      <button
                        className="faq-action-btn faq-action-btn--edit"
                        title="Edit"
                        onClick={() => openEdit(faq)}
                      >
                        ✏️
                      </button>

                      <button
                        className={`faq-action-btn ${
                          faq.is_published ? "faq-action-btn--hide" : "faq-action-btn--publish"
                        }`}
                        title={faq.is_published ? "Unpublish" : "Publish"}
                        onClick={() => handleTogglePublish(faq)}
                      >
                        {faq.is_published ? "👁️‍🗨️" : "✓"}
                      </button>

                      <button
                        className="faq-action-btn faq-action-btn--delete"
                        title="Delete"
                        onClick={() => handleDelete(faq)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .faq-manage-view { padding: 0; }

        .faq-header {
          display:flex; justify-content:space-between; align-items:flex-start;
          margin-bottom:1.5rem; padding:1.25rem 1.5rem;
          background:white; border-radius:14px;
          box-shadow:0 6px 20px rgba(15,23,42,0.05);
        }
        .faq-title { margin:0; font-size:1.35rem; font-weight:700; color:#111827; }
        .faq-subtitle { margin:.3rem 0 0; font-size:.9rem; color:#6b7280; }

        .faq-toolbar {
          display:flex; gap:.75rem; align-items:center;
          margin-bottom:1.2rem; padding:1rem 1.5rem;
          background:white; border-radius:14px;
          box-shadow:0 6px 20px rgba(15,23,42,0.05);
        }
        .faq-search-input {
          flex:1; min-width:300px; padding:.65rem 1rem;
          border-radius:12px; border:1px solid #e5e7eb;
          font-size:.9rem; outline:none;
        }
        .faq-search-input:focus { border-color:#2563eb; }
        .faq-filter-select {
          padding:.65rem 1rem; border-radius:12px; border:1px solid #e5e7eb;
          font-size:.9rem; background:white; cursor:pointer; outline:none;
        }

        .faq-bulk-bar {
          display:flex; justify-content:space-between; align-items:center;
          padding:1rem 1.5rem; margin-bottom:1.2rem;
          background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px;
          box-shadow:0 2px 8px rgba(37,99,235,0.1);
        }
        .faq-bulk-info { font-size:.9rem; color:#1e40af; }
        .faq-bulk-info strong { font-weight:700; }
        .faq-bulk-actions { display:flex; gap:.75rem; }
        .faq-bulk-btn {
          padding:.5rem 1rem; font-size:.85rem;
          border-color:#93c5fd; background:white; color:#1e40af;
        }
        .faq-bulk-btn:hover:not(:disabled) { background:#dbeafe; border-color:#60a5fa; }
        .faq-bulk-btn:disabled { opacity:.5; cursor:not-allowed; }

        .faq-table-wrapper {
          background:white; border-radius:14px; padding:1.2rem 1.5rem;
          box-shadow:0 6px 20px rgba(15,23,42,0.05);
        }
        .faq-empty {
          text-align:center; padding:3rem 1rem;
          color:#6b7280; font-size:.95rem;
        }

        .faq-table { width:100%; border-collapse:collapse; }
        .faq-table thead { border-bottom:2px solid #e5e7eb; }
        .faq-table th {
          text-align:left; padding:.9rem .6rem; font-size:.85rem;
          font-weight:700; color:#6b7280; text-transform:uppercase;
          letter-spacing:.05em;
        }
        .faq-table td {
          padding:1rem .6rem; border-bottom:1px solid #f3f4f6; vertical-align:top;
        }
        .faq-table tr:last-child td { border-bottom:none; }

        .faq-checkbox { width:18px; height:18px; cursor:pointer; accent-color:#2563eb; }
        .faq-row-selected { background:#f0f9ff; }

        .faq-country-badge {
          display:inline-flex; padding:.35rem .75rem; background:#eff6ff; color:#1e40af;
          border-radius:999px; font-size:.8rem; font-weight:600;
        }
        .faq-category-text { font-size:.85rem; color:#374151; }

        .faq-question-cell { display:flex; flex-direction:column; gap:.4rem; }
        .faq-question-text { font-size:.9rem; font-weight:600; color:#111827; line-height:1.4; }
        .faq-answer-preview { font-size:.8rem; color:#6b7280; line-height:1.4; }

        .faq-status-badge {
          display:inline-flex; padding:.35rem .75rem; border-radius:999px;
          font-size:.78rem; font-weight:600;
        }
        .faq-status-badge--published { background:#d1fae5; color:#065f46; }
        .faq-status-badge--draft { background:#fef3c7; color:#92400e; }

        .faq-actions { display:flex; justify-content:flex-end; gap:.5rem; }
        .faq-action-btn {
          width:36px; height:34px; border-radius:10px; border:1px solid #e5e7eb;
          background:white; cursor:pointer; font-size:.95rem;
          display:inline-flex; align-items:center; justify-content:center;
          transition:all .15s ease;
        }
        .faq-action-btn:hover { border-color:#2563eb; background:#eff6ff; }
        .faq-action-btn--edit:hover { border-color:#2563eb; background:#dbeafe; }

        .faq-action-btn--publish { border-color:#10b981; background:#d1fae5; color:#065f46; }
        .faq-action-btn--publish:hover { background:#a7f3d0; }
        .faq-action-btn--hide { border-color:#f59e0b; background:#fef3c7; color:#92400e; }
        .faq-action-btn--hide:hover { background:#fde68a; }
        .faq-action-btn--delete:hover { border-color:#ef4444; background:#fee2e2; }
      `}</style>
    </div>
  );
}
