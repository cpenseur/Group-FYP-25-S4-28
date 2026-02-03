// frontend/src/pages/trips.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import TripCard, { type TripOverview } from "../components/TripCard";
import { Plus, Search, Info, Trash2, X, Check } from "lucide-react";

function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

function isUpcoming(t: TripOverview, today: Date) {
  if (!t.end_date) return true;
  return (
    parseISO(t.end_date) >=
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

function makeInitials(input?: string | null) {
  const s = (input || "").trim();
  if (!s) return "??";
  const base = s.includes("@") ? s.split("@")[0] : s;

  const parts = base
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : (parts[0]?.[1] ?? "");
  return (first + (second || "")).toUpperCase();
}



export default function TripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // NEW: delete mode + confirmation state
  const [deleteMode, setDeleteMode] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [myInitials, setMyInitials] = useState<string>("??");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      const meta: any = user?.user_metadata || {};
      const initials =
        (meta.initials && String(meta.initials).trim()) ||
        makeInitials(meta.full_name) ||
        makeInitials(meta.name) ||
        makeInitials(user?.email);

      setMyInitials(initials || "??");
    })();

    loadTrips().catch(() => setLoading(false));
  }, []);

  function withOwnerFallback(list: TripOverview[]) {
    return list.map((t) => {
      const collabs = Array.isArray(t.collaborators) ? t.collaborators : [];
      if (collabs.length > 0) return { ...t, collaborators: collabs };

      return {
        ...t,
        collaborators: [{ id: -1, initials: myInitials }],
      };
    });
  }

  async function loadTrips() {
    setLoading(true);

    const list = await apiFetch("/f1/trips/", { method: "GET" });
    const baseTrips: TripOverview[] = Array.isArray(list) ? list : list?.results ?? [];

    const needsOverview =
      baseTrips.length > 0 &&
      (baseTrips[0].collaborators === undefined ||
        baseTrips[0].planned_total === undefined ||
        baseTrips[0].location_label === undefined);

    if (!needsOverview) {
      setTrips(withOwnerFallback(baseTrips));
      setLoading(false);
      return;
    }

    const withOverview = await Promise.all(
      baseTrips.map(async (t) => {
        try {
          const ov = await apiFetch(`/f1/trips/${t.id}/overview/`, { method: "GET" });
          return { ...t, ...ov };
        } catch {
          return t;
        }
      })
    );

    setTrips(withOwnerFallback(withOverview));
    setLoading(false);
  }

  useEffect(() => {
    loadTrips().catch(() => setLoading(false));
  }, []);

  // NEW: exit delete mode if user searches (optional but nice UX)
  useEffect(() => {
    if (!deleteMode) setPendingDeleteId(null);
  }, [deleteMode]);

  async function deleteTrip(tripId: number) {
    try {
      setDeletingId(tripId);
      await apiFetch(`/f1/trips/${tripId}/`, { method: "DELETE" });
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      setPendingDeleteId(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete trip. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const today = new Date();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return trips;

    return trips.filter((t) => {
      const city = (t.main_city || "").toLowerCase();
      const country = (t.main_country || "").toLowerCase();
      const loc = (t.location_label || "").toLowerCase();
      return city.includes(needle) || country.includes(needle) || loc.includes(needle);
    });
  }, [q, trips]);

  const upcoming = useMemo(() => filtered.filter((t) => isUpcoming(t, today)), [filtered]);
  const allTrips = filtered;

  // NEW: reusable renderer so both grids behave the same
  const renderTrip = (t: TripOverview) => {
    const isPending = pendingDeleteId === t.id;
    const isDeleting = deletingId === t.id;

    return (
      <div
        key={t.id}
        style={{
          position: "relative",
          borderRadius: 16,
          outline: deleteMode ? "2px solid rgba(239,68,68,0.35)" : "none",
          transition: "outline 160ms ease",
          width: "100%",
          minWidth: 0,
        }}
      >
        <TripCard
          trip={t}
          variant="grid"
          onClick={() => {
            if (deleteMode) return; // prevent accidental navigation in delete mode
            navigate(`/trip/${t.id}/itinerary`);
          }}
        />

        {deleteMode && (
          <>
            {/* top-right trash badge */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPendingDeleteId((prev) => (prev === t.id ? null : t.id));
              }}
              style={trashBadge}
              title="Delete trip"
              aria-label="Delete trip"
            >
              <Trash2 size={16} strokeWidth={2.5} />
            </button>

            {/* confirm overlay */}
            {isPending && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={confirmOverlay}
              >
                <div style={{ fontWeight: 800, color: "#111827" }}>
                  Delete this trip?
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  This can’t be undone.
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(null)}
                    style={cancelBtn}
                    disabled={isDeleting}
                  >
                    <X size={16} strokeWidth={2.5} />
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteTrip(t.id)}
                    style={dangerBtn}
                    disabled={isDeleting}
                  >
                    <Check size={16} strokeWidth={2.5} />
                    {isDeleting ? "Deleting..." : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={pageBg}>
      <div style={container}>
        <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 6 }}>
          Plan your itinerary
        </div>
        <div style={{ fontSize: 44, fontWeight: 500, color: "#111827" }}>Trips</div>

        <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 14 }}>
          <button type="button" onClick={() => navigate("/create-trip")} style={createBtn}>
            <span style={plusCircle}>
              <Plus size={16} strokeWidth={2.5} />
            </span>
            Create a new trip
          </button>

          <div style={{ ...searchPill, maxWidth: 520 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by city or country…"
              style={searchInput}
            />
            <div style={searchIconCircle}><Search size={16} strokeWidth={2.5} /></div>
          </div>

          {/* NEW: delete mode toggle */}
          <button
            type="button"
            onClick={() => {
              setDeleteMode((v) => !v);
              setPendingDeleteId(null);
            }}
            style={{
              ...deleteModeBtn,
              background: deleteMode ? "#ef4444" : "#111827",
            }}
            title={deleteMode ? "Exit delete mode" : "Enter delete mode"}
            aria-pressed={deleteMode}
          >
            <Trash2 size={16} strokeWidth={2.5} />
            {deleteMode ? "Delete mode: ON" : "Delete"}
          </button>
        </div>

        {/* Upcoming Trips */}
        <div style={{ marginTop: 26 }}>
          <div style={{ fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            Upcoming Trips <span style={{ color: "#9ca3af", marginLeft: 8 }}><Info size={14} /></span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, maxWidth: 1240, width: "100%" }}>
            {(loading ? Array.from({ length: 4 }) : upcoming).map((t: any, idx: number) => {
              if (loading) {
                return (
                  <div
                    key={idx}
                    style={{
                      height: 220,
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #f3f4f6, #ffffff)",
                      border: "1px solid rgba(17,24,39,0.06)",
                    }}
                  />
                );
              }
              return renderTrip(t);
            })}
          </div>
        </div>

        {/* All Trips */}
        <div style={{ marginTop: 34 }}>
          <div style={{ fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            All Trips <span style={{ color: "#9ca3af", marginLeft: 8 }}><Info size={14} /></span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, maxWidth: 1240, width: "100%" }}>
            {(loading ? Array.from({ length: 8 }) : allTrips).map((t: any, idx: number) => {
              if (loading) {
                return (
                  <div
                    key={idx}
                    style={{
                      height: 220,
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #f3f4f6, #ffffff)",
                      border: "1px solid rgba(17,24,39,0.06)",
                    }}
                  />
                );
              }
              return renderTrip(t);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f4f6",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const container: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: "26px 26px 60px",
};

const createBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  background: "#0b4a7a",
  color: "white",
  padding: "12px 18px",
  fontWeight: 750,
  fontSize: 18,
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  boxShadow: "0 10px 18px rgba(11,74,122,0.25)",
};

const deleteModeBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  color: "white",
  padding: "12px 14px",
  fontWeight: 800,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  boxShadow: "0 10px 18px rgba(17,24,39,0.18)",
  whiteSpace: "nowrap",
};

const plusCircle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  background: "rgba(255,255,255,0.18)",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
};

const searchPill: React.CSSProperties = {
  flex: "1 1 auto",
  minWidth: 420,
  height: 46,
  borderRadius: 999,
  background: "#efefef",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 10px 0 18px",
};

const searchInput: React.CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  width: "100%",
  color: "#111827",
};

const searchIconCircle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  background: "#6d79ff",
  display: "grid",
  placeItems: "center",
  color: "white",
  fontWeight: 900,
};

// NEW styles
const trashBadge: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(255,255,255,0.92)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  color: "#ef4444",
  boxShadow: "0 10px 18px rgba(239,68,68,0.12)",
};

const confirmOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 10,
  borderRadius: 14,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(239,68,68,0.22)",
  boxShadow: "0 18px 30px rgba(17,24,39,0.14)",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
};

const cancelBtn: React.CSSProperties = {
  flex: "1 1 auto",
  border: "1px solid rgba(17,24,39,0.12)",
  background: "white",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  flex: "1 1 auto",
  border: "none",
  background: "#ef4444",
  color: "white",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
};
