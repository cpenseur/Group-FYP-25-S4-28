import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { apiFetch } from "../lib/apiClient";

// ---------------- Types matching backend detail JSON ----------------

type TripDayItem = {
  id: number;
  title: string;
  start_time: string | null;
  end_time: string | null;
  lat: number | null;
  lon: number | null;
  address: string | null;
  notes_summary: string | null;
  photo_url?: string | null;
};

type TripDay = {
  id: number;
  day_index: number;
  date: string | null;
  note: string | null;
  items: TripDayItem[];
};

type TripDetail = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  description?: string | null;
  travel_type?: string | null;
  owner_name?: string;
  cover_photo_url?: string | null;
  tags?: string[];
  days?: TripDay[];
};

type MapPoint = {
  id: number;
  order: number;
  lat: number;
  lon: number;
  label: string;
};

// -------------------------------------------------------------------

const COMMUNITY_API = "http://127.0.0.1:8000/api/f2/community/";

// numeric pill icon for markers (no PNG files required)
function createNumberIcon(order: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="
        background:#111;
        color:#fff;
        width:26px;
        height:26px;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:600;
        border:2px solid #fff;
        box-shadow:0 0 6px rgba(0,0,0,0.35);
      ">${order}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function safeWeekdayLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString(undefined, { weekday: "short" })
    .toUpperCase();
}

function safeDayMonthLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  // matches look like "20/10"
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function safeMonthDayText(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  // "Oct 20"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatHHMM(dt: string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderTimeOnly(item: TripDayItem): string {
  // Your desired UI shows a single time on the left (10:00, 13:00…)
  // We'll prefer start_time, else end_time.
  return formatHHMM(item.start_time) || formatHHMM(item.end_time) || "";
}

/* -------------------- Copy Itinerary Modal -------------------- */
function CopyItineraryModal({
  isOpen,
  trip,
  onClose,
  onConfirm,
  copying,
}: {
  isOpen: boolean;
  trip: TripDetail | null;
  onClose: () => void;
  onConfirm: () => void;
  copying: boolean;
}) {
  if (!isOpen || !trip) return null;

  // Gather all unique destinations
  const destinations: string[] = [];
  (trip.days || []).forEach((day) => {
    (day.items || []).forEach((item) => {
      if (item.title && !destinations.includes(item.title)) {
        destinations.push(item.title);
      }
    });
  });

  const totalDays = trip.days?.length || 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "480px",
          background: "white",
          borderRadius: "20px",
          padding: "2rem 2rem 1.5rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "transparent",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
            color: "#6b7280",
            padding: "0.25rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Title */}
        <h2
          style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            color: "#111827",
          }}
        >
          {trip.title}
        </h2>

        {/* Location and duration */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            color: "#6b7280",
          }}
        >
          {trip.main_city && (
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>📍</span>
              <span>{trip.main_city}</span>
            </div>
          )}
          {totalDays > 0 && (
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>⏱️</span>
              <span>
                {totalDays} Day{totalDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Destinations */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: 600,
              marginBottom: "0.75rem",
              color: "#111827",
            }}
          >
            Destinations:
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {destinations.slice(0, 8).map((dest, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: "0.875rem",
                  color: "#374151",
                  paddingLeft: "1.25rem",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    color: "#6b7280",
                  }}
                >
                  •
                </span>
                {dest}
              </li>
            ))}
            {destinations.length > 8 && (
              <li
                style={{
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  fontStyle: "italic",
                }}
              >
                +{destinations.length - 8} more destinations
              </li>
            )}
          </ul>
        </div>

        {/* Creator */}
        {trip.owner_name && (
          <div
            style={{
              fontSize: "0.85rem",
              color: "#6b7280",
              marginBottom: "1.5rem",
            }}
          >
            Created by {trip.owner_name}
          </div>
        )}

        {/* Copy button */}
        <button
          onClick={onConfirm}
          disabled={copying}
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            borderRadius: "12px",
            border: "none",
            background: copying ? "#e5e7eb" : "#6366f1",
            color: "white",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: copying ? "not-allowed" : "pointer",
            boxShadow: copying ? "none" : "0 8px 20px rgba(99,102,241,0.35)",
            opacity: copying ? 0.6 : 1,
          }}
        >
          {copying ? "Copying itinerary..." : "Copy itinerary"}
        </button>
      </div>
    </div>
  );
}

/* -------------------- Flag Itinerary Modal -------------------- */
function FlagItineraryModal({
  isOpen,
  tripTitle,
  onClose,
  onConfirm,
  flagging,
}: {
  isOpen: boolean;
  tripTitle: string;
  onClose: () => void;
  onConfirm: () => void;
  flagging: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "440px",
          background: "white",
          borderRadius: "18px",
          padding: "1.6rem 1.6rem 1.25rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div
            style={{ fontSize: "1.05rem", fontWeight: 800, color: "#111827" }}
          >
            Flag this itinerary?
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.4rem",
              cursor: "pointer",
              color: "#6b7280",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#374151" }}
        >
          You’re about to flag <strong>{tripTitle}</strong> for review.
        </div>

        <div
          style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "#6b7280" }}
        >
          This helps us keep the community safe.
        </div>

        <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.25rem" }}>
          <button
            onClick={onClose}
            disabled={flagging}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#111827",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: flagging ? "not-allowed" : "pointer",
              opacity: flagging ? 0.6 : 1,
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={flagging}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              border: "none",
              background: flagging ? "#f3f4f6" : "#111827",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: flagging ? "not-allowed" : "pointer",
              opacity: flagging ? 0.7 : 1,
            }}
          >
            {flagging ? "Submitting..." : "Flag itinerary"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DiscoveryItineraryDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<number | null>(null);

  const [copying, setCopying] = useState<boolean>(false);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);

  const [flagging, setFlagging] = useState<boolean>(false);
  const [showFlagModal, setShowFlagModal] = useState<boolean>(false);

  // ---------------- Fetch detail ----------------
  useEffect(() => {
    let isMounted = true;

    const fetchDetail = async () => {
      if (!tripId) return;
      try {
        setLoading(true);
        setError(null);

        const res: Response = await fetch(`${COMMUNITY_API}${tripId}/`, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} – ${text.slice(0, 120)}…`);
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error(
            `Expected JSON but got '${contentType}'. First part of response: ${text.slice(
              0,
              120
            )}…`
          );
        }

        const data = (await res.json()) as TripDetail;

        if (isMounted) {
          setTrip(data);
          if (data.days && data.days.length > 0) {
            setExpandedDayId(data.days[0].id);
          } else {
            setExpandedDayId(null);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Something went wrong.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [tripId]);

  // ---------------- Map data preparation ----------------
  const mapPoints: MapPoint[] = useMemo(() => {
    if (!trip || !trip.days) return [];
    const points: MapPoint[] = [];
    let counter = 1;

    for (const day of trip.days) {
      for (const item of day.items || []) {
        if (
          item.lat !== null &&
          item.lat !== undefined &&
          item.lon !== null &&
          item.lon !== undefined
        ) {
          points.push({
            id: item.id,
            order: counter,
            lat: item.lat,
            lon: item.lon,
            label: item.title,
          });
          counter += 1;
        }
      }
    }
    return points;
  }, [trip]);

  const mapCenter: [number, number] = useMemo(() => {
    if (mapPoints.length === 0) return [1.3521, 103.8198];
    const avgLat =
      mapPoints.reduce((sum, p) => sum + p.lat, 0) / mapPoints.length;
    const avgLon =
      mapPoints.reduce((sum, p) => sum + p.lon, 0) / mapPoints.length;
    return [avgLat, avgLon];
  }, [mapPoints]);

  const polylinePositions: [number, number][] = useMemo(() => {
    return mapPoints.map((p) => [p.lat, p.lon] as [number, number]);
  }, [mapPoints]);

  const handleCopyItinerary = async () => {
    if (!trip) return;

    setCopying(true);
    try {
      // Create a new trip by copying the current trip data
      const newTripPayload = {
        title: `${trip.title} (Copy)`,
        main_city: trip.main_city,
        main_country: trip.main_country,
        description: trip.description,
        travel_type: trip.travel_type,
        start_date:
          trip.days && trip.days.length > 0 ? trip.days[0].date : null,
        end_date:
          trip.days && trip.days.length > 0
            ? trip.days[trip.days.length - 1].date
            : null,
      };

      const newTrip = await apiFetch("/f1/trips/", {
        method: "POST",
        body: JSON.stringify(newTripPayload),
      });

      // Copy days
      const dayIdMap = new Map<number, number>(); // old day ID -> new day ID

      for (const day of trip.days || []) {
        const newDay = await apiFetch("/f1/trip-days/", {
          method: "POST",
          body: JSON.stringify({
            trip: newTrip.id,
            day_index: day.day_index,
            date: day.date,
            note: day.note,
          }),
        });
        dayIdMap.set(day.id, newDay.id);
      }

      // Copy items
      for (const day of trip.days || []) {
        const newDayId = dayIdMap.get(day.id);

        for (const item of day.items || []) {
          await apiFetch("/f1/itinerary-items/", {
            method: "POST",
            body: JSON.stringify({
              trip: newTrip.id,
              day: newDayId,
              title: item.title,
              address: item.address,
              lat: item.lat,
              lon: item.lon,
              start_time: item.start_time,
              end_time: item.end_time,
              notes_summary: item.notes_summary,
              sort_order: day.items.indexOf(item) + 1,
              item_type: "place",
            }),
          });
        }
      }

      // Navigate to the editor
      navigate(`/trip/${newTrip.id}/itinerary`);
    } catch (error) {
      console.error("Failed to copy itinerary:", error);
      alert("Failed to copy itinerary. Please try again.");
    } finally {
      setCopying(false);
      setShowCopyModal(false);
    }
  };

  const handleFlagItinerary = async () => {
    if (!tripId) return;

    setFlagging(true);
    try {
      const res = await fetch(`${COMMUNITY_API}${tripId}/flag/`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} – ${text.slice(0, 120)}…`);
      }

      setShowFlagModal(false);
      // Go back to previous page (the page before this)
      navigate(-1);
    } catch (e: any) {
      console.error(e);
      alert("Failed to flag itinerary. Please try again.");
    } finally {
      setFlagging(false);
    }
  };

  // ---------------- Render states ----------------

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f7", padding: "2rem" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <Link
            to="/discovery-local"
            style={{ fontSize: "0.85rem", color: "#555", textDecoration: "none" }}
          >
            ← Back to Discovery
          </Link>
          <p style={{ marginTop: "1.5rem", color: "#555" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f7", padding: "2rem" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <Link
            to="/discovery-local"
            style={{ fontSize: "0.85rem", color: "#555", textDecoration: "none" }}
          >
            ← Back to Discovery
          </Link>
          <p style={{ marginTop: "1.5rem", color: "crimson" }}>
            {error || "Trip not found."}
          </p>
        </div>
      </div>
    );
  }

  const tags = (trip.tags || []).slice(0, 4);
  const locationLabel = trip.main_city
    ? `${trip.main_city}, ${trip.main_country || ""}`.trim()
    : trip.main_country || "";

  const days = trip.days || [];

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#ffffff",
          padding: "1.6rem 2rem",
        }}
      >
        <div
          style={{
            maxWidth: "1320px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "540px minmax(0,1fr) 140px",
            gap: "1.4rem",
            alignItems: "start",
          }}
        >
          {/* LEFT: rounded map card */}
          <div
            style={{
              borderRadius: "22px",
              overflow: "hidden",
              background: "#cfe0ff",
              height: "420px",
            }}
          >
            {mapPoints.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#555",
                  fontSize: "0.9rem",
                }}
              >
                Map view coming soon
              </div>
            ) : (
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: "420px", width: "100%" }}
                scrollWheelZoom={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {polylinePositions.length > 1 && (
                  <Polyline positions={polylinePositions as any} />
                )}
                {mapPoints.map((p) => (
                  <Marker
                    key={p.id}
                    position={[p.lat, p.lon] as any}
                    icon={createNumberIcon(p.order) as any}
                  >
                    <Popup>{p.label}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>

          {/* MIDDLE: content (compact, like screenshot) */}
          <div>
            {/* top row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <div>
                <Link
                  to="/discovery-local"
                  style={{
                    fontSize: "0.85rem",
                    color: "#6b7280",
                    textDecoration: "none",
                  }}
                >
                  ← Back to Discovery
                </Link>

                <div style={{ marginTop: "0.45rem", fontSize: "1rem", fontWeight: 600 }}>
                  {trip.title}
                </div>

                {locationLabel && (
                  <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.1rem" }}>
                    {locationLabel}
                  </div>
                )}
              </div>

              {/* Copy + Flag buttons */}
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                }}
              >
                <button
                  onClick={() => setShowCopyModal(true)}
                  style={{
                    padding: "0.6rem 1.05rem",
                    borderRadius: "16px",
                    border: "1px solid #6366f1",
                    background: "#d7d8ff",
                    color: "#1f2937",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    boxShadow: "0 8px 22px rgba(79,70,229,0.18)",
                  }}
                >
                  Copy itinerary
                </button>

                <button
                  onClick={() => setShowFlagModal(true)}
                  style={{
                    padding: "0.6rem 1.05rem",
                    borderRadius: "16px",
                    border: "1px solid #e5e7eb",
                    background: "#ffffff",
                    color: "#111827",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    boxShadow: "0 8px 22px rgba(17,24,39,0.08)",
                  }}
                >
                  Flag itinerary
                </button>
              </div>
            </div>

            {/* tags row */}
            {tags.length > 0 && (
              <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.75rem" }}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "0.35rem 0.95rem",
                      borderRadius: "999px",
                      background: "#2f2f2f",
                      color: "#fff",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {trip.owner_name && (
              <div style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "#6b7280" }}>
                by {trip.owner_name}
              </div>
            )}

            {/* Accordion days */}
            <div style={{ marginTop: "1.15rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {days.length === 0 && (
                <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                  No detailed day-by-day itinerary is available yet for this trip.
                </div>
              )}

              {days.map((day) => {
                const isOpen = day.id === expandedDayId;
                const dayLabel = `DAY ${day.day_index}`;
                const dateLabel = safeMonthDayText(day.date);

                return (
                  <div
                    key={day.id}
                    style={{
                      borderRadius: "12px",
                      background: "#eef0ff",
                      overflow: "hidden",
                    }}
                  >
                    {/* header bar */}
                    <button
                      onClick={() => setExpandedDayId(isOpen ? null : day.id)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "#bfc2ff",
                        padding: "0.65rem 0.9rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "#1f2937",
                          }}
                        >
                          {dayLabel}
                        </span>
                        {dateLabel && (
                          <span style={{ fontSize: "0.8rem", color: "#374151" }}>
                            {dateLabel}
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "999px",
                          background: "#e7e8ff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.85rem",
                          color: "#111827",
                        }}
                      >
                        {isOpen ? "▴" : "▾"}
                      </span>
                    </button>

                    {/* body */}
                    <div
                      style={{
                        maxHeight: isOpen ? "520px" : "0px",
                        overflow: "hidden",
                        transition: "max-height 0.25s ease",
                        background: "#f7f7ff",
                      }}
                    >
                      <div style={{ padding: "0.85rem 0.95rem 0.95rem" }}>
                        {/* timeline list */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.9rem",
                          }}
                        >
                          {(day.items || []).map((item) => {
                            const t = renderTimeOnly(item);
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "52px 10px minmax(0, 1fr)",
                                  columnGap: "0.8rem",
                                  alignItems: "start",
                                }}
                              >
                                {/* time */}
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "#6b7280",
                                    paddingTop: "0.15rem",
                                  }}
                                >
                                  {t}
                                </div>

                                {/* dot */}
                                <div style={{ paddingTop: "0.45rem" }}>
                                  <div
                                    style={{
                                      width: "7px",
                                      height: "7px",
                                      borderRadius: "999px",
                                      background: "#4f46e5",
                                    }}
                                  />
                                </div>

                                {/* item row (flat, like screenshot) */}
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "0.75rem",
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "52px",
                                      height: "52px",
                                      borderRadius: "12px",
                                      background: "#e9e9ff",
                                      overflow: "hidden",
                                      flex: "0 0 52px",
                                    }}
                                  >
                                    {item.photo_url ? (
                                      <img
                                        src={item.photo_url}
                                        alt={item.title}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                    ) : null}
                                  </div>

                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        color: "#111827",
                                      }}
                                    >
                                      {item.title}
                                    </div>
                                    {item.notes_summary && (
                                      <div
                                        style={{
                                          marginTop: "0.15rem",
                                          fontSize: "0.78rem",
                                          color: "#6b7280",
                                        }}
                                      >
                                        {item.notes_summary}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {(day.items || []).length === 0 && (
                            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                              No stops added for this day.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: small itinerary sidebar */}
          <aside
            style={{
              borderRadius: "16px",
              background: "#eaf0ff",
              padding: "0.9rem 0.75rem",
              height: "fit-content",
            }}
          >
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#374151",
                marginBottom: "0.7rem",
              }}
            >
              Itinerary
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {days.map((day) => {
                const isActive = day.id === expandedDayId;
                const dow = safeWeekdayLabel(day.date);
                const dm = safeDayMonthLabel(day.date);

                return (
                  <button
                    key={day.id}
                    onClick={() => setExpandedDayId(day.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: "0.25rem 0.15rem",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: "0.15rem",
                        color: isActive ? "#4f46e5" : "#374151",
                      }}
                    >
                      <div style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                        {dow} {dm}
                      </div>
                      <div style={{ fontSize: "0.72rem", opacity: 0.9 }}>
                        Day {day.day_index}
                      </div>

                      {/* active indicator */}
                      <div
                        style={{
                          height: "2px",
                          width: isActive ? "42px" : "0px",
                          background: "#4f46e5",
                          borderRadius: "999px",
                          transition: "width 0.2s ease",
                          marginTop: "0.2rem",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      {/* Copy Itinerary Modal */}
      <CopyItineraryModal
        isOpen={showCopyModal}
        trip={trip}
        onClose={() => setShowCopyModal(false)}
        onConfirm={handleCopyItinerary}
        copying={copying}
      />

      {/* Flag Itinerary Modal */}
      <FlagItineraryModal
        isOpen={showFlagModal}
        tripTitle={trip.title}
        onClose={() => setShowFlagModal(false)}
        onConfirm={handleFlagItinerary}
        flagging={flagging}
      />
    </>
  );
}
