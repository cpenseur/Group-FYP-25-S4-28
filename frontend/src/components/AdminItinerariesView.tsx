import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

type ItineraryRow = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  visibility: string;
  is_demo: boolean;
  owner_email: string | null;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
};

export default function AdminItinerariesView() {
  const [itineraries, setItineraries] = useState<ItineraryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "displayed" | "hidden">("all");
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const fetchItineraries = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;

      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
      const response = await fetch(`${API_BASE}/f8/trips/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const mapped: ItineraryRow[] = (data.results || data || []).map((trip: any) => ({
          id: trip.id,
          title: trip.title || "Untitled",
          main_city: trip.main_city,
          main_country: trip.main_country,
          visibility: trip.visibility || "private",
          is_demo: trip.is_demo ?? false,
          owner_email: trip.owner_email || trip.owner?.email || null,
          created_at: trip.created_at,
          start_date: trip.start_date,
          end_date: trip.end_date,
        }));
        setItineraries(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch itineraries:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItineraries();
  }, []);

  const toggleDisplay = async (id: number, currentStatus: boolean) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;

      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
      const response = await fetch(`${API_BASE}/f8/trips/${id}/toggle_display/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_demo: !currentStatus }),
      });

      if (response.ok) {
        setItineraries((prev) =>
          prev.map((it) => (it.id === id ? { ...it, is_demo: !currentStatus } : it))
        );
      } else {
        alert("Failed to update display status");
      }
    } catch (e) {
      console.error("Toggle display error:", e);
      alert("Failed to update display status");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const updateVisibility = async (id: number, newVisibility: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;

      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
      const response = await fetch(`${API_BASE}/f8/trips/${id}/update_visibility/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (response.ok) {
        setItineraries((prev) =>
          prev.map((it) => (it.id === id ? { ...it, visibility: newVisibility } : it))
        );
      } else {
        alert("Failed to update visibility");
      }
    } catch (e) {
      console.error("Update visibility error:", e);
      alert("Failed to update visibility");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const filteredItineraries = useMemo(() => {
    let result = itineraries;

    // Filter by display status
    if (filter === "displayed") {
      result = result.filter((it) => it.is_demo);
    } else if (filter === "hidden") {
      result = result.filter((it) => !it.is_demo);
    }

    // Search filter
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (it) =>
          it.title.toLowerCase().includes(s) ||
          (it.main_city && it.main_city.toLowerCase().includes(s)) ||
          (it.main_country && it.main_country.toLowerCase().includes(s)) ||
          (it.owner_email && it.owner_email.toLowerCase().includes(s))
      );
    }

    return result;
  }, [itineraries, filter, search]);

  const displayedCount = itineraries.filter((it) => it.is_demo).length;
  const hiddenCount = itineraries.filter((it) => !it.is_demo).length;

  return (
    <div className="admin-itineraries">
      <div className="itineraries-header">
        <div>
          <h2 className="itineraries-title">Itineraries Management</h2>
          <p className="itineraries-subtitle">
            Control which itineraries are displayed on the landing page
          </p>
        </div>
        <button className="btn btn-primary" onClick={fetchItineraries} disabled={loading}>
          ↻ {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="itineraries-stats">
        <div className="stat-badge stat-badge--displayed">
          <span className="stat-badge-icon">✓</span>
          <span>{displayedCount} Displayed</span>
        </div>
        <div className="stat-badge stat-badge--hidden">
          <span className="stat-badge-icon">○</span>
          <span>{hiddenCount} Hidden</span>
        </div>
      </div>

      <div className="itineraries-toolbar">
        <input
          type="text"
          placeholder="Search by title, city, country, or owner..."
          className="itineraries-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-buttons">
          <button
            className={`btn btn-small ${filter === "all" ? "btn-filter-active" : "btn-outline"}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`btn btn-small ${filter === "displayed" ? "btn-filter-active" : "btn-outline"}`}
            onClick={() => setFilter("displayed")}
          >
            Displayed
          </button>
          <button
            className={`btn btn-small ${filter === "hidden" ? "btn-filter-active" : "btn-outline"}`}
            onClick={() => setFilter("hidden")}
          >
            Hidden
          </button>
        </div>
      </div>

      <div className="itineraries-table-wrap">
        <table className="itineraries-table">
          <thead>
            <tr>
              <th>Itinerary</th>
              <th>Location</th>
              <th>Visibility</th>
              <th>Created</th>
              <th>Display Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="itineraries-empty">
                  Loading itineraries...
                </td>
              </tr>
            ) : filteredItineraries.length === 0 ? (
              <tr>
                <td colSpan={6} className="itineraries-empty">
                  No itineraries found
                </td>
              </tr>
            ) : (
              filteredItineraries.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div className="itinerary-cell">
                      <div className="itinerary-icon">🗺️</div>
                      <div>
                        <div className="itinerary-title">{it.title}</div>
                        {it.owner_email && (
                          <div className="itinerary-owner">{it.owner_email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="itinerary-location">
                      {it.main_city && it.main_country
                        ? `${it.main_city}, ${it.main_country}`
                        : it.main_city || it.main_country || "-"}
                    </div>
                  </td>
                  <td>
                    <select
                      className={`visibility-select visibility-select--${it.visibility}`}
                      value={it.visibility}
                      onChange={(e) => updateVisibility(it.id, e.target.value)}
                      disabled={!!actionLoading[it.id]}
                    >
                      <option value="private">Private</option>
                      <option value="shared">Shared</option>
                      <option value="public">Public</option>
                    </select>
                  </td>
                  <td>
                    <div className="itinerary-date">
                      {new Date(it.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`display-status ${
                        it.is_demo ? "display-status--displayed" : "display-status--hidden"
                      }`}
                    >
                      {it.is_demo ? "Displayed" : "Hidden"}
                    </span>
                  </td>
                  <td>
                    <div className="itinerary-actions">
                      <button
                        className={`btn btn-small ${
                          it.is_demo ? "btn-hide" : "btn-display"
                        }`}
                        onClick={() => toggleDisplay(it.id, it.is_demo)}
                        disabled={!!actionLoading[it.id]}
                        title={it.is_demo ? "Hide from landing page" : "Show on landing page"}
                      >
                        {actionLoading[it.id]
                          ? "..."
                          : it.is_demo
                          ? "Hide"
                          : "Display"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .admin-itineraries {
          padding: 0;
        }

        .itineraries-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }

        .itineraries-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
        }

        .itineraries-subtitle {
          margin: 0.25rem 0 0;
          font-size: 0.9rem;
          color: #6b7280;
        }

        .itineraries-stats {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.85rem;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .stat-badge--displayed {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
        }

        .stat-badge--hidden {
          background: rgba(107, 114, 128, 0.12);
          color: #4b5563;
        }

        .stat-badge-icon {
          font-size: 0.9rem;
        }

        .itineraries-toolbar {
          display: flex;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
        }

        .itineraries-search {
          flex: 1;
          padding: 0.65rem 1rem;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          font-size: 0.9rem;
          background: #fff;
          outline: none;
        }

        .itineraries-search:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .filter-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .itineraries-table-wrap {
          overflow-x: auto;
        }

        .itineraries-table {
          width: 100%;
          border-collapse: collapse;
        }

        .itineraries-table th {
          font-size: 0.8rem;
          font-weight: 600;
          color: #6b7280;
          text-align: left;
          padding: 0.75rem 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .itineraries-table td {
          padding: 0.9rem 0.5rem;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }

        .itineraries-empty {
          text-align: center;
          color: #6b7280;
          padding: 2rem 0.5rem;
        }

        .itinerary-cell {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .itinerary-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
        }

        .itinerary-title {
          font-weight: 600;
          color: #111827;
          font-size: 0.95rem;
        }

        .itinerary-owner {
          font-size: 0.8rem;
          color: #6b7280;
          margin-top: 0.1rem;
        }

        .itinerary-location {
          color: #374151;
          font-size: 0.9rem;
        }

        .itinerary-date {
          color: #374151;
          font-size: 0.9rem;
        }

        .visibility-select {
          padding: 0.35rem 0.6rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: capitalize;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          outline: none;
          transition: all 0.15s ease;
        }

        .visibility-select:hover:not(:disabled) {
          border-color: #2563eb;
        }

        .visibility-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .visibility-select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .visibility-select--public {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
          border-color: rgba(16, 185, 129, 0.3);
        }

        .visibility-select--shared {
          background: rgba(37, 99, 235, 0.12);
          color: #2563eb;
          border-color: rgba(37, 99, 235, 0.3);
        }

        .visibility-select--private {
          background: rgba(107, 114, 128, 0.12);
          color: #4b5563;
          border-color: rgba(107, 114, 128, 0.3);
        }

        .visibility-badge {
          display: inline-flex;
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .visibility-badge--public {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
        }

        .visibility-badge--shared {
          background: rgba(37, 99, 235, 0.12);
          color: #2563eb;
        }

        .visibility-badge--private {
          background: rgba(107, 114, 128, 0.12);
          color: #4b5563;
        }

        .display-status {
          display: inline-flex;
          padding: 0.3rem 0.7rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .display-status--displayed {
          background: rgba(16, 185, 129, 0.14);
          color: #059669;
        }

        .display-status--hidden {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .itinerary-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .btn-display {
          background: #10b981;
          color: #fff;
          border-color: transparent;
        }

        .btn-display:hover:not(:disabled) {
          background: #059669;
        }

        .btn-hide {
          background: #f59e0b;
          color: #fff;
          border-color: transparent;
        }

        .btn-hide:hover:not(:disabled) {
          background: #d97706;
        }
      `}</style>
    </div>
  );
}
