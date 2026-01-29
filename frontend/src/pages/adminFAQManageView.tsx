import React, { useEffect, useMemo, useState } from "react";
import AdminFAQModal, { AdminFAQFormData } from "../components/adminFAQModal";
import AdminFAQConfirmDeleteModal from "../components/adminFAQConfirmDeleteModal";

type FAQRow = AdminFAQFormData & { id: number };

const API = "/api/f8/destination-faqs/";

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  if (contentType.includes("text/html")) {
    throw new Error("API returned HTML instead of JSON.");
  }
  return JSON.parse(text) as T;
}

export default function AdminFAQManageView() {
  const [rows, setRows] = useState<FAQRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"country" | "category">("country");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FAQRow | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FAQRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(API, { headers: { Accept: "application/json" } });
      const data = await safeJson<FAQRow[]>(res);
      setRows(data);
    } catch (e: any) {
      setError(e.message || "Failed to load FAQs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter((r) =>
          [r.country, r.category, r.question, r.answer]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : rows;

    return [...base].sort((a, b) => {
      const av = (a[sortKey] || "").toLowerCase();
      const bv = (b[sortKey] || "").toLowerCase();
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir]);

  const saveFAQ = async (data: AdminFAQFormData) => {
    const isEdit = !!editing;
    const url = isEdit ? `${API}${editing!.id}/` : API;
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(await res.text());
    await load();
  };

  const togglePublish = async (row: FAQRow) => {
    const res = await fetch(`${API}${row.id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, is_published: !row.is_published }),
    });

    if (!res.ok) {
      alert("Failed to update publish status.");
      return;
    }

    await load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`${API}${deleteTarget.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      await load();
      setDeleteTarget(null);
    } catch {
      alert("Failed to delete FAQ.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1>FAQ Management</h1>
          <p style={{ color: "#6b7280" }}>Create, edit, publish or hide FAQs</p>
        </div>
        <button onClick={() => setModalOpen(true)} style={primaryBtn}>
          + New FAQ
        </button>
      </header>

      <div style={{ display: "flex", gap: 10, margin: "1rem 0" }}>
        <input
          placeholder="Search FAQs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={input}
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}>
          <option value="country">Country</option>
          <option value="category">Category</option>
        </select>
        <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {!loading && (
        <table style={{ width: "100%", background: "#fff", borderRadius: 12 }}>
          <thead>
            <tr>
              <th>Country</th>
              <th>Category</th>
              <th>Question</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.country}</td>
                <td>{r.category}</td>
                <td>
                  <strong>{r.question}</strong>
                  <div style={{ color: "#6b7280" }}>
                    {r.answer.slice(0, 120)}…
                  </div>
                </td>
                <td>
                  <button
                    onClick={() => togglePublish(r)}
                    style={{
                      ...pill,
                      background: r.is_published ? "#dcfce7" : "#fef3c7",
                    }}
                  >
                    {r.is_published ? "Published" : "Hidden"}
                  </button>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => setEditing(r)}>Edit</button>
                  <button
                    style={{ color: "crimson", marginLeft: 8 }}
                    onClick={() => setDeleteTarget(r)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AdminFAQModal
        open={modalOpen || !!editing}
        initialData={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={saveFAQ}
      />

      <AdminFAQConfirmDeleteModal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
      />
    </div>
  );
}

/* styles */
const primaryBtn: React.CSSProperties = {
  borderRadius: 999,
  padding: "0.5rem 1rem",
  background: "#111827",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

const input: React.CSSProperties = {
  flex: 1,
  padding: "0.6rem 0.9rem",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
};

const pill: React.CSSProperties = {
  padding: "0.3rem 0.7rem",
  borderRadius: 999,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};
