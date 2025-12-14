import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";

type Collaborator = { id: number; initials: string };
type TripOverview = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  start_date: string | null;
  end_date: string | null;
  collaborators?: Collaborator[];
  planned_total?: string | null;
  currency_symbol?: string;
  location_label?: string;
};

function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

function isUpcoming(t: TripOverview, today: Date) {
  if (!t.end_date) return true;
  return parseISO(t.end_date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function getTripImageUrl(t: TripOverview) {
  const key = `${(t.main_city || "").toLowerCase()} ${(t.main_country || "").toLowerCase()}`.trim();
  if (key.includes("rome") || key.includes("italy")) return "/trip-covers/italy.jpg";
  if (key.includes("tokyo") || key.includes("japan")) return "/trip-covers/japan.jpg";
  if (key.includes("seoul") || key.includes("korea")) return "/trip-covers/korea.jpg";
  if (key.includes("usa") || key.includes("chicago")) return "/trip-covers/usa.jpg";
  return "/trip-covers/default.jpg";
}

function AvatarPills({ collabs = [] }: { collabs?: Collaborator[] }) {
  const shown = collabs.slice(0, 4);
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {shown.map((c) => (
        <div
          key={c.id}
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "#111827",
            background: "#e5e7eb",
            border: "1px solid rgba(17,24,39,0.10)",
          }}
        >
          {c.initials}
        </div>
      ))}
    </div>
  );
}

function TripCard({ trip, onClick }: { trip: TripOverview; onClick: () => void }) {
  const cityLabel = trip.location_label || trip.main_city || "—";
  const countryLabel = trip.main_country || "—";
  const budget =
    trip.planned_total && trip.currency_symbol
      ? `${trip.currency_symbol}${trip.planned_total}`
      : trip.planned_total
      ? `${trip.planned_total}`
      : "$—";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
          border: "1px solid rgba(17,24,39,0.06)",
        }}
      >
        <div style={{ height: 120, background: "#e5e7eb" }}>
          <img
            src={getTripImageUrl(trip)}
            alt={trip.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/trip-covers/default.jpg")}
          />
        </div>

        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontWeight: 650, color: "#111827", fontSize: 13, lineHeight: 1.2 }}>
            {cityLabel}
          </div>
          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{countryLabel}</div>

          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid rgba(17,24,39,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Budget: <span style={{ color: "#111827", fontWeight: 700 }}>{budget}</span>
            </div>
            <AvatarPills collabs={trip.collaborators} />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function TripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function loadTrips() {
    setLoading(true);

    const list = await apiFetch("/f1/trips/", { method: "GET" });
    const baseTrips: TripOverview[] = Array.isArray(list) ? list : list?.results ?? [];

    const needsOverview =
      baseTrips.length > 0 && (baseTrips[0].collaborators === undefined || baseTrips[0].planned_total === undefined);

    if (!needsOverview) {
      setTrips(baseTrips);
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

    setTrips(withOverview);
    setLoading(false);
  }

  useEffect(() => {
    loadTrips().catch(() => setLoading(false));
  }, []);

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

  return (
    <div style={pageBg}>
      <div style={container}>
        <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 6 }}>Plan your itinerary</div>
        <div style={{ fontSize: 44, fontWeight: 500, color: "#111827" }}>Trips</div>

        <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 14 }}>
          <button type="button" onClick={() => navigate("/create-trip")} style={createBtn}>
            <span style={plusCircle}>+</span>
            Create a new trip
          </button>

          <div style={{ ...searchPill, maxWidth: 520 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Searching..."
              style={searchInput}
            />
            <div style={searchIconCircle}>🔎</div>
          </div>
        </div>

        {/* Upcoming Trips */}
        <div style={{ marginTop: 26 }}>
          <div style={{ fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            Upcoming Trips <span style={{ color: "#9ca3af", marginLeft: 8 }}>ⓘ</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
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
              return (
                <TripCard
                  key={t.id}
                  trip={t}
                  onClick={() => navigate(`/trip/${t.id}/itinerary`)}
                />
              );
            })}
          </div>
        </div>

        {/* All Trips */}
        <div style={{ marginTop: 34 }}>
          <div style={{ fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            All Trips <span style={{ color: "#9ca3af", marginLeft: 8 }}>ⓘ</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
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
              return (
                <TripCard
                  key={t.id}
                  trip={t}
                  onClick={() => navigate(`/trip/${t.id}/itinerary`)}
                />
              );
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
