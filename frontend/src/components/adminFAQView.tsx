// src/components/adminFAQView.tsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

// Types for different FAQ tables
type CommunityFAQ = {
  id: number;
  country?: string;
  category?: string;
  question: string;
  answer: string;
  is_published: boolean;
  created_at: string;
  updated_at?: string;
};

type GeneralFAQ = {
  id: number;
  question: string;
  answer: string;
  category: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
};

type FAQCategory = "community_faq" | "faqs";

export default function AdminFAQView() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory>("community_faq");
  
  // Community FAQs
  const [communityFaqs, setCommunityFaqs] = useState<CommunityFAQ[]>([]);
  
  // General FAQs (faqs table)
  const [generalFaqs, setGeneralFaqs] = useState<GeneralFAQ[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPublished, setFilterPublished] = useState<"all" | "published" | "unpublished">("all");
  const [filterFaqCategory, setFilterFaqCategory] = useState<string>("all");

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Add modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<any>({});

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  // Fetch Community FAQs via API
  const fetchCommunityFaqs = async () => {
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE}/api/f8/community-faqs/`, { headers });

      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

      const data = await res.json();
      setCommunityFaqs(Array.isArray(data) ? data : data.results || []);
    } catch (e: any) {
      console.error("fetchCommunityFaqs error:", e);
      throw e;
    }
  };

  // Fetch General FAQs (faqs table) via API
  const fetchGeneralFaqs = async () => {
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE}/api/f8/general-faqs/`, { headers });

      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

      const data = await res.json();
      setGeneralFaqs(Array.isArray(data) ? data : data.results || []);
    } catch (e: any) {
      console.error("fetchGeneralFaqs error:", e);
      throw e;
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchCommunityFaqs(),
        fetchGeneralFaqs(),
      ]);
    } catch (e: any) {
      setError(e.message || "Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Get unique categories from general FAQs
  const faqCategories = [...new Set(generalFaqs.map(f => f.category))].filter(Boolean);

  // Filtered items based on active category
  const getFilteredItems = () => {
    const searchLower = search.toLowerCase().trim();

    if (activeCategory === "community_faq") {
      return communityFaqs.filter((faq) => {
        const matchesSearch = !searchLower ||
          faq.question.toLowerCase().includes(searchLower) ||
          faq.answer.toLowerCase().includes(searchLower);
        const matchesPublished = filterPublished === "all" ||
          (filterPublished === "published" && faq.is_published) ||
          (filterPublished === "unpublished" && !faq.is_published);
        return matchesSearch && matchesPublished;
      });
    }

    if (activeCategory === "faqs") {
      return generalFaqs.filter((faq) => {
        const matchesSearch = !searchLower ||
          faq.question.toLowerCase().includes(searchLower) ||
          faq.answer.toLowerCase().includes(searchLower);
        const matchesCategory = filterFaqCategory === "all" || faq.category === filterFaqCategory;
        const matchesPublished = filterPublished === "all" ||
          (filterPublished === "published" && faq.is_active) ||
          (filterPublished === "unpublished" && !faq.is_active);
        return matchesSearch && matchesCategory && matchesPublished;
      });
    }

    return [];
  };

  const filteredItems = getFilteredItems();

  // Handle edit for different FAQ types
  const handleEdit = (item: any) => {
    setEditingItem({ ...item, _category: activeCategory });
    
    if (activeCategory === "community_faq") {
      setEditForm({
        question: item.question,
        answer: item.answer,
        country: item.country || "",
        category: item.category || "",
        is_published: item.is_published,
      });
    } else {
      setEditForm({
        question: item.question,
        answer: item.answer,
        category: item.category,
        display_order: item.display_order,
        is_active: item.is_active,
      });
    }
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const category = editingItem._category as FAQCategory;

      if (category === "community_faq") {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_BASE}/api/f8/community-faqs/${editingItem.id}/`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editForm),
        });

        if (!res.ok) throw new Error(`Failed to update: ${res.status}`);
        await fetchCommunityFaqs();
      } else {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_BASE}/api/f8/general-faqs/${editingItem.id}/`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editForm),
        });

        if (!res.ok) throw new Error(`Failed to update: ${res.status}`);
        await fetchGeneralFaqs();
      }

      setEditModalOpen(false);
      setEditingItem(null);
    } catch (e: any) {
      alert(e.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Delete FAQ: "${item.question.slice(0, 50)}..."?`)) return;

    try {
      if (activeCategory === "community_faq") {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_BASE}/api/f8/community-faqs/${item.id}/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
        await fetchCommunityFaqs();
      } else {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_BASE}/api/f8/general-faqs/${item.id}/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
        await fetchGeneralFaqs();
      }
    } catch (e: any) {
      alert(e.message || "Failed to delete FAQ");
    }
  };

  const handleTogglePublished = async (item: any) => {
    try {
      if (activeCategory === "community_faq") {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_BASE}/api/f8/community-faqs/${item.id}/`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_published: !item.is_published }),
        });

        if (!res.ok) throw new Error(`Failed to update: ${res.status}`);
        await fetchCommunityFaqs();
      } else {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_BASE}/api/f8/general-faqs/${item.id}/`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_active: !item.is_active }),
        });

        if (!res.ok) throw new Error(`Failed to update: ${res.status}`);
        await fetchGeneralFaqs();
      }
    } catch (e: any) {
      alert(e.message || "Failed to toggle status");
    }
  };

  const handleAddNew = () => {
    if (activeCategory === "community_faq") {
      setAddForm({
        question: "",
        answer: "",
        country: "",
        category: "",
        is_published: true,
      });
    } else {
      setAddForm({
        question: "",
        answer: "",
        category: faqCategories[0] || "General",
        display_order: generalFaqs.length + 1,
        is_active: true,
      });
    }
    setAddModalOpen(true);
  };

  const handleSaveNew = async () => {
    if (!addForm.question?.trim() || !addForm.answer?.trim()) {
      alert("Question and answer are required");
      return;
    }

    setSaving(true);
    try {
      if (activeCategory === "community_faq") {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_BASE}/api/f8/community-faqs/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(addForm),
        });

        if (!res.ok) throw new Error(`Failed to create: ${res.status}`);
        await fetchCommunityFaqs();
      } else {
        const token = await getAuthToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_BASE}/api/f8/general-faqs/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(addForm),
        });

        if (!res.ok) throw new Error(`Failed to create: ${res.status}`);
        await fetchGeneralFaqs();
      }

      setAddModalOpen(false);
    } catch (e: any) {
      alert(e.message || "Failed to create FAQ");
    } finally {
      setSaving(false);
    }
  };

  // Get counts for tabs
  const getCounts = () => ({
    community_faq: communityFaqs.length,
    faqs: generalFaqs.length,
  });

  const counts = getCounts();

  // Check if item is published/active
  const isItemActive = (item: any) => {
    if (activeCategory === "community_faq") return item.is_published;
    return item.is_active;
  };

  return (
    <div className="faq-view">
      {/* Header */}
      <div className="faq-header">
        <div>
          <h1 className="faq-title">FAQ Management</h1>
          <p className="faq-subtitle">Manage all FAQ content across categories</p>
        </div>
        <div className="faq-actions">
          <button className="btn btn-primary" onClick={handleAddNew}>
            + Add FAQ
          </button>
          <button className="btn btn-outline" onClick={fetchAllData} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="faq-tabs">
        <button
          className={`faq-tab ${activeCategory === "community_faq" ? "faq-tab--active" : ""}`}
          onClick={() => setActiveCategory("community_faq")}
        >
          <span className="faq-tab-icon">👥</span>
          <span>Community FAQs</span>
          <span className="faq-tab-count">{counts.community_faq}</span>
        </button>
        <button
          className={`faq-tab ${activeCategory === "faqs" ? "faq-tab--active" : ""}`}
          onClick={() => setActiveCategory("faqs")}
        >
          <span className="faq-tab-icon">❓</span>
          <span>General FAQs</span>
          <span className="faq-tab-count">{counts.faqs}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="faq-filters">
        <input
          type="text"
          placeholder="Search questions or answers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="faq-search"
        />

        {activeCategory === "faqs" && (
          <select
            value={filterFaqCategory}
            onChange={(e) => setFilterFaqCategory(e.target.value)}
            className="faq-filter-select"
          >
            <option value="all">All Categories</option>
            {faqCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}

        <select
          value={filterPublished}
          onChange={(e) => setFilterPublished(e.target.value as any)}
          className="faq-filter-select"
        >
          <option value="all">All Status</option>
          <option value="published">Active</option>
          <option value="unpublished">Inactive</option>
        </select>
      </div>

      {/* Error state */}
      {error && <div className="faq-error">{error}</div>}

      {/* Loading state */}
      {loading && <div className="faq-loading">Loading FAQs...</div>}

      {/* FAQ List */}
      {!loading && !error && (
        <div className="faq-list">
          {filteredItems.length === 0 ? (
            <div className="faq-empty">No FAQs found in this category</div>
          ) : (
            filteredItems.map((item: any) => (
              <div key={item.id} className={`faq-item ${!isItemActive(item) ? "faq-item--unpublished" : ""}`}>
                <div className="faq-item-main">
                  <div className="faq-item-header">
                    {activeCategory === "community_faq" && item.category && (
                      <span className="faq-category-tag">{item.category}</span>
                    )}
                    {activeCategory === "faqs" && (
                      <>
                        <span className="faq-category-tag">{item.category}</span>
                        <span className="faq-order-tag">Order: {item.display_order}</span>
                      </>
                    )}
                    <span className={`faq-published-tag ${isItemActive(item) ? "faq-published-tag--yes" : "faq-published-tag--no"}`}>
                      {isItemActive(item) ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h3 className="faq-question">{item.question}</h3>
                  <p className="faq-answer">{item.answer}</p>
                  <div className="faq-meta">
                    {item.upvotes !== undefined && <span>👍 {item.upvotes} upvotes</span>}
                    {item.created_at && (
                      <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="faq-item-actions">
                  <button
                    className="faq-action-btn"
                    onClick={() => handleTogglePublished(item)}
                    title={isItemActive(item) ? "Deactivate" : "Activate"}
                  >
                    {isItemActive(item) ? "👁️" : "👁️‍🗨️"}
                  </button>
                  <button
                    className="faq-action-btn"
                    onClick={() => handleEdit(item)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="faq-action-btn faq-action-btn--danger"
                    onClick={() => handleDelete(item)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Stats */}
      <div className="faq-stats">
        <div className="faq-stat-card">
          <span className="faq-stat-value">{counts.community_faq + counts.faqs}</span>
          <span className="faq-stat-label">Total FAQs</span>
        </div>
        <div className="faq-stat-card">
          <span className="faq-stat-value">{counts.community_faq}</span>
          <span className="faq-stat-label">Community</span>
        </div>
        <div className="faq-stat-card">
          <span className="faq-stat-value">{counts.faqs}</span>
          <span className="faq-stat-label">General</span>
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && editingItem && (
        <div className="modal-backdrop" onClick={() => setEditModalOpen(false)}>
          <div className="modal-card faq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2 className="modal-title">Edit FAQ</h2>
                <p className="modal-sub">Update question and answer</p>
              </div>
              <button className="modal-close" onClick={() => setEditModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="faq-form">
                {(editingItem._category === "community_faq" || editingItem._category === "faqs") && (
                  <label className="faq-form-label">
                    Category
                    <input
                      type="text"
                      value={editForm.category || ""}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="faq-form-input"
                      placeholder="e.g., General, AI Features, Account"
                    />
                  </label>
                )}

                {editingItem._category === "faqs" && (
                  <label className="faq-form-label">
                    Display Order
                    <input
                      type="number"
                      value={editForm.display_order || 0}
                      onChange={(e) => setEditForm({ ...editForm, display_order: Number(e.target.value) })}
                      className="faq-form-input"
                    />
                  </label>
                )}

                <label className="faq-form-label">
                  Question
                  <textarea
                    value={editForm.question}
                    onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                    className="faq-form-textarea"
                    rows={3}
                  />
                </label>
                <label className="faq-form-label">
                  Answer
                  <textarea
                    value={editForm.answer}
                    onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                    className="faq-form-textarea"
                    rows={5}
                  />
                </label>

                <label className="faq-form-checkbox">
                  <input
                    type="checkbox"
                    checked={editingItem._category === "faqs" ? editForm.is_active : editForm.is_published}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      [editingItem._category === "faqs" ? "is_active" : "is_published"]: e.target.checked
                    })}
                  />
                  Active / Published
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModalOpen && (
        <div className="modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div className="modal-card faq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2 className="modal-title">Add New FAQ</h2>
                <p className="modal-sub">
                  {activeCategory === "community_faq" && "Add a community FAQ"}
                  {activeCategory === "faqs" && "Add a general FAQ"}
                </p>
              </div>
              <button className="modal-close" onClick={() => setAddModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="faq-form">
                {(activeCategory === "community_faq" || activeCategory === "faqs") && (
                  <label className="faq-form-label">
                    Category
                    <input
                      type="text"
                      value={addForm.category || ""}
                      onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                      className="faq-form-input"
                      placeholder="e.g., General, AI Features, Account"
                    />
                  </label>
                )}

                {activeCategory === "faqs" && (
                  <label className="faq-form-label">
                    Display Order
                    <input
                      type="number"
                      value={addForm.display_order || 0}
                      onChange={(e) => setAddForm({ ...addForm, display_order: Number(e.target.value) })}
                      className="faq-form-input"
                    />
                  </label>
                )}

                <label className="faq-form-label">
                  Question
                  <textarea
                    value={addForm.question || ""}
                    onChange={(e) => setAddForm({ ...addForm, question: e.target.value })}
                    className="faq-form-textarea"
                    rows={3}
                    placeholder="Enter the FAQ question..."
                  />
                </label>
                <label className="faq-form-label">
                  Answer
                  <textarea
                    value={addForm.answer || ""}
                    onChange={(e) => setAddForm({ ...addForm, answer: e.target.value })}
                    className="faq-form-textarea"
                    rows={5}
                    placeholder="Enter the answer..."
                  />
                </label>

                <label className="faq-form-checkbox">
                  <input
                    type="checkbox"
                    checked={activeCategory === "faqs" ? addForm.is_active : addForm.is_published}
                    onChange={(e) => setAddForm({
                      ...addForm,
                      [activeCategory === "faqs" ? "is_active" : "is_published"]: e.target.checked
                    })}
                  />
                  Active / Published
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveNew} disabled={saving}>
                  {saving ? "Creating..." : "Create FAQ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .faq-view {
          padding: 0;
        }

        .faq-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }

        .faq-title {
          margin: 0;
          font-size: 1.5rem;
          color: #111827;
        }

        .faq-subtitle {
          margin: 0.25rem 0 0;
          color: #6b7280;
          font-size: 0.9rem;
        }

        .faq-actions {
          display: flex;
          gap: 0.75rem;
        }

        .faq-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0;
        }

        .faq-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          border-bottom: 2px solid transparent;
          color: #6b7280;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.15s;
          margin-bottom: -1px;
        }

        .faq-tab:hover {
          color: #111827;
          background: #f9fafb;
        }

        .faq-tab--active {
          color: #2563eb;
          border-bottom-color: #2563eb;
        }

        .faq-tab-icon {
          font-size: 1.1rem;
        }

        .faq-tab-count {
          background: #e5e7eb;
          color: #374151;
          padding: 0.1rem 0.5rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .faq-tab--active .faq-tab-count {
          background: #dbeafe;
          color: #2563eb;
        }

        .faq-filters {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .faq-search {
          flex: 1;
          min-width: 200px;
          padding: 0.6rem 1rem;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          font-size: 0.9rem;
        }

        .faq-filter-select {
          padding: 0.6rem 1rem;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          font-size: 0.9rem;
          background: #fff;
          min-width: 150px;
        }

        .faq-error {
          padding: 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          color: #b91c1c;
          margin-bottom: 1rem;
        }

        .faq-loading {
          padding: 2rem;
          text-align: center;
          color: #6b7280;
        }

        .faq-empty {
          padding: 2rem;
          text-align: center;
          color: #6b7280;
          background: #f9fafb;
          border-radius: 12px;
        }

        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          max-height: 500px;
          overflow-y: auto;
        }

        .faq-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1rem 1.25rem;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          transition: box-shadow 0.15s;
        }

        .faq-item:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .faq-item--unpublished {
          background: #fafafa;
          opacity: 0.8;
        }

        .faq-item-main {
          flex: 1;
          margin-right: 1rem;
        }

        .faq-item-header {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .faq-category-tag {
          padding: 0.15rem 0.5rem;
          background: #fef3c7;
          color: #92400e;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .faq-order-tag {
          padding: 0.15rem 0.5rem;
          background: #e5e7eb;
          color: #374151;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .faq-published-tag {
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .faq-published-tag--yes {
          background: #d1fae5;
          color: #065f46;
        }

        .faq-published-tag--no {
          background: #fee2e2;
          color: #b91c1c;
        }

        .faq-question {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          color: #111827;
          font-weight: 600;
        }

        .faq-answer {
          margin: 0 0 0.5rem;
          font-size: 0.9rem;
          color: #4b5563;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .faq-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.78rem;
          color: #9ca3af;
        }

        .faq-item-actions {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .faq-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          transition: background 0.15s, border-color 0.15s;
        }

        .faq-action-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .faq-action-btn--danger:hover {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .faq-stats {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }

        .faq-stat-card {
          padding: 1rem 1.25rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 90px;
        }

        .faq-stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
        }

        .faq-stat-label {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }

        .faq-modal {
          width: min(600px, 95vw);
        }

        .faq-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .faq-form-label {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: #374151;
        }

        .faq-form-input {
          padding: 0.6rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 0.9rem;
        }

        .faq-form-textarea {
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 0.9rem;
          font-family: inherit;
          resize: vertical;
        }

        .faq-form-select {
          padding: 0.6rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 0.9rem;
          background: #fff;
        }

        .faq-form-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
        }

        .faq-form-checkbox input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
