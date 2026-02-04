// discoveryItineraryDetail.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTripId } from "../hooks/useDecodedParams";
import { encodeId } from "../lib/urlObfuscation";

import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { apiFetch } from "../lib/apiClient";
import { CopyItineraryModal } from "../components/CopyItinerary";
import { FlagItineraryModal, FlagCategory } from "../components/FlagItinerary";

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
  thumbnail_url?: string | null;
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

// TripDay list response from backend
type TripDayApi = {
  id: number;
  trip: number;
  date: string | null;
  day_index: number;
  note: string | null;
};

// -------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const COMMUNITY_API = `${API_BASE}/f2/community/`;
const COMMUNITY_BASE = new URL(API_BASE).origin;

// ---------------- Helpers ----------------

function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, COMMUNITY_BASE).toString();
  } catch {
    return null;
  }
}

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
  return d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
}

function safeDayMonthLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function safeMonthDayText(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Parse an ISO string but keep the wall-clock time the user entered
function parseWallClockDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  if (!datePart || !timePart) return null;
  const d = new Date(`${datePart}T${timePart}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTimeRange(item: TripDayItem): string {
  if (!item.start_time && !item.end_time) return "";

  const fmt = (t: string | null | undefined) => {
    const d = parseWallClockDate(t);
    return d ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
  };

  const start = fmt(item.start_time);
  const end = fmt(item.end_time);

  if (start && !end) return start;
  if (!start && end) return end;
  if (start && end) return `${start} – ${end}`;
  return "";
}

function toISODateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------- Multi-source Image Fetching (Openverse) ----------------

type ImageResult = {
  thumbnail: string;
  url: string;
  source: string;
  creator?: string;
};

/**
 * Try Openverse API with improved error handling and CORS support
 */
async function fetchOpenverseImage(query: string, signal?: AbortSignal): Promise<ImageResult | null> {
  const q = query.trim();
  if (!q) return null;

  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", "5");
  url.searchParams.set("license_type", "all");

  try {
    const res = await fetch(url.toString(), { 
      method: "GET", 
      signal,
      mode: 'cors'
    });
    
    if (!res.ok) {
      console.warn("Openverse fetch failed:", res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    const results = data?.results || [];

    // Find first result with a valid image
    for (const item of results) {
      const imgUrl = item.thumbnail || item.url;
      if (imgUrl && typeof imgUrl === 'string') {
        // Validate it's a proper URL
        try {
          new URL(imgUrl);
          return {
            thumbnail: imgUrl,
            url: item.url || imgUrl,
            source: "Openverse",
            creator: item.creator,
          };
        } catch {
          continue;
        }
      }
    }

    return null;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.log("Fetch aborted for:", q);
    } else {
      console.warn("Openverse error:", err);
    }
    return null;
  }
}

/**
 * Module-level cache with expiry
 */
const imageCache = new Map<string, { result: ImageResult | null; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

function buildImageQuery(placeTitle: string, city?: string | null, country?: string | null): string {
  const parts = [placeTitle, city || ""].map((s) => s.trim()).filter(Boolean);
  return parts.join(" ");
}

/**
 * Try Openverse with caching
 */
async function fetchPlaceImage(query: string, signal?: AbortSignal): Promise<ImageResult | null> {
  const q = query.trim();
  if (!q) return null;

  // Check cache
  const cached = imageCache.get(q);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log("Using cached result for:", q);
    return cached.result;
  }

  console.log("Fetching image for:", q);

  const result = await fetchOpenverseImage(q, signal);
  
  if (result) {
    console.log("✓ Found image via Openverse:", result.thumbnail);
  } else {
    console.log("✗ No image found for:", q);
  }
  
  imageCache.set(q, { result, timestamp: Date.now() });
  return result;
}

/**
 * Generate a placeholder image using a service
 */
function generatePlaceholderImage(text: string, width: number, height: number): string {
  const encoded = encodeURIComponent(text.slice(0, 30));
  return `https://via.placeholder.com/${width}x${height}/e0e7ff/6366f1?text=${encoded}`;
}

function PlaceThumb({
  query,
  alt,
  width = 110,
  height = 64,
  radius = 12,
}: {
  query: string;
  alt: string;
  width?: number;
  height?: number;
  radius?: number;
}) {
  const [img, setImg] = useState<ImageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Cancel any ongoing fetch
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setImg(null);
    setLoading(true);
    setImgError(false);

    const q = query.trim();
    if (!q) {
      setLoading(false);
      return;
    }

    fetchPlaceImage(q, abortRef.current.signal)
      .then((res) => {
        if (!mountedRef.current) return;
        setImg(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        if (err.name !== 'AbortError') {
          console.error("Image fetch error:", err);
        }
        setLoading(false);
      });

    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [query]);

  const displayUrl = img?.thumbnail;
  const usePlaceholder = !loading && (!displayUrl || imgError);

  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        background: "linear-gradient(135deg,#e0e7ff,#c7d2fe)",
        border: "1px solid rgba(0,0,0,0.06)",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      title={
        img
          ? `Photo via ${img.source}${img.creator ? ` • ${img.creator}` : ""}`
          : loading
          ? "Loading photo..."
          : "Searching for photo..."
      }
    >
      {loading ? (
        <div
          style={{
            fontSize: 10,
            color: "rgba(99,102,241,0.6)",
            fontWeight: 600,
            textAlign: "center",
            padding: "0.5rem",
          }}
        >
          Loading...
        </div>
      ) : displayUrl && !imgError ? (
        <img
          src={displayUrl}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
          onError={(e) => {
            console.error("Image failed to load:", displayUrl);
            setImgError(true);
          }}
          crossOrigin="anonymous"
        />
      ) : usePlaceholder ? (
        <img
          src={generatePlaceholderImage(alt, width, height)}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            fontSize: 9,
            color: "rgba(99,102,241,0.5)",
            fontWeight: 600,
            textAlign: "center",
            padding: "0.5rem",
            lineHeight: 1.3,
          }}
        >
          No photo
          <br />
          available
        </div>
      )}
    </div>
  );
}

export default function DiscoveryItineraryDetail() {
  const tripId = useTripId();
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
          throw new Error(`Expected JSON but got '${contentType}'. First part of response: ${text.slice(0, 120)}…`);
        }

        const data = (await res.json()) as TripDetail;

        if (isMounted) {
          setTrip(data);
          if (data.days && data.days.length > 0) setExpandedDayId(data.days[0].id);
          else setExpandedDayId(null);
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
        if (item.lat != null && item.lon != null) {
          points.push({ id: item.id, order: counter, lat: item.lat, lon: item.lon, label: item.title });
          counter += 1;
        }
      }
    }
    return points;
  }, [trip]);

  const mapCenter: [number, number] = useMemo(() => {
    if (mapPoints.length === 0) return [1.3521, 103.8198];
    const avgLat = mapPoints.reduce((sum, p) => sum + p.lat, 0) / mapPoints.length;
    const avgLon = mapPoints.reduce((sum, p) => sum + p.lon, 0) / mapPoints.length;
    return [avgLat, avgLon];
  }, [mapPoints]);

  const polylinePositions: [number, number][] = useMemo(() => {
    return mapPoints.map((p) => [p.lat, p.lon] as [number, number]);
  }, [mapPoints]);

  // COPY (unchanged)
  const handleCopyItinerary = async () => {
    if (!trip) return;

    const sourceDays = trip.days || [];
    if (sourceDays.length === 0) {
      alert("This itinerary has no days to copy.");
      setShowCopyModal(false);
      return;
    }

    setCopying(true);
    try {
      const totalDays = Math.max(sourceDays.length, 1);

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() + 7);

      const end = new Date(start);
      end.setDate(end.getDate() + (totalDays - 1));

      const newStart = toISODateOnly(start);
      const newEnd = toISODateOnly(end);

      const newTripPayload = {
        title: `${trip.title} (Copy)`,
        main_city: trip.main_city,
        main_country: trip.main_country,
        travel_type: trip.travel_type ?? null,
        start_date: newStart,
        end_date: newEnd,
      };

      const newTrip = await apiFetch("/f1/trips/", {
        method: "POST",
        body: JSON.stringify(newTripPayload),
      });

      const createdDays = (await apiFetch(`/f1/trip-days/?trip=${newTrip.id}`, {
        method: "GET",
      })) as TripDayApi[];

      const dayIndexToNewDayId = new Map<number, number>();
      for (const d of createdDays) dayIndexToNewDayId.set(d.day_index, d.id);

      for (const srcDay of sourceDays) {
        const newDayId = dayIndexToNewDayId.get(srcDay.day_index);
        if (!newDayId) continue;

        const items = srcDay.items || [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];

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
              sort_order: i + 1,
              item_type: "place",
            }),
          });
        }
      }

      navigate(`/v/${encodeId(newTrip.id)}/i`);
    } catch (err) {
      console.error("Failed to copy itinerary:", err);
      alert("Failed to copy itinerary. Please make sure you are logged in and try again.");
    } finally {
      setCopying(false);
      setShowCopyModal(false);
    }
  };

  // FLAG (unchanged)
  const handleFlagItinerary = async (payload: { flag_category: FlagCategory; flag_reason: string }) => {
    if (!tripId) return;

    setFlagging(true);
    try {
      const res = await fetch(`${COMMUNITY_API}${tripId}/flag/`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} – ${text.slice(0, 120)}…`);
      }

      setShowFlagModal(false);
      navigate(-1);
    } catch (e: any) {
      console.error(e);
      alert("Failed to flag itinerary. Please try again.");
    } finally {
      setFlagging(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f7", padding: "2rem" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              fontSize: "0.85rem",
              color: "#555",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            ← Back to Discovery
          </button>
          <p style={{ marginTop: "1.5rem", color: "#555" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f7", padding: "2rem" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              fontSize: "0.85rem",
              color: "#555",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            ← Back to Discovery
          </button>
          <p style={{ marginTop: "1.5rem", color: "crimson" }}>
            {error || "Trip not found."}
          </p>
        </div>
      </div>
    );
  }


  const tags = (trip.tags || []).slice(0, 4);
  const locationLabel = trip.main_city ? `${trip.main_city}, ${trip.main_country || ""}`.trim() : trip.main_country || "";
  const days = trip.days || [];

  const dayColorPalette = ["#746ee5ff", "#b13171ff", "#2fa57eff", "#eb904eff", "#56acd4ff", "#bc78fbff"];
  const getDayColor = (dayIndex: number | null | undefined): string => {
    if (!dayIndex || dayIndex <= 0) return "#6b7280";
    const idx = ((dayIndex - 1) % dayColorPalette.length + dayColorPalette.length) % dayColorPalette.length;
    return dayColorPalette[idx];
  };

  return (
    <>
      <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", padding: "1.6rem 2rem" }}>
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
          <div style={{ borderRadius: "22px", overflow: "hidden", background: "#cfe0ff", height: "420px" }}>
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
              <MapContainer center={mapCenter} zoom={13} style={{ height: "420px", width: "100%" }} scrollWheelZoom={false}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                {polylinePositions.length > 1 && <Polyline positions={polylinePositions as any} />}
                {mapPoints.map((p) => (
                  <Marker key={p.id} position={[p.lat, p.lon] as any} icon={createNumberIcon(p.order) as any}>
                    <Popup>{p.label}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <div>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  style={{
                    fontSize: "0.85rem",
                    color: "#6b7280",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  ← Back to Discovery
                </button>


                <div style={{ marginTop: "0.45rem", fontSize: "1rem", fontWeight: 600 }}>{trip.title}</div>

                {locationLabel && <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.1rem" }}>{locationLabel}</div>}
              </div>

              <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
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

            {trip.owner_name && <div style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "#6b7280" }}>by {trip.owner_name}</div>}

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

                const baseColor = getDayColor(day.day_index);
                const hex7 = baseColor.slice(0, 7);
                const bubbleBg = hex7 + "22";
                const bubbleBorder = hex7 + "55";
                const bubbleText = hex7;

                return (
                  <div key={day.id} style={{ borderRadius: "12px", background: "#eef0ff", overflow: "hidden" }}>
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
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1f2937" }}>{dayLabel}</span>
                        {dateLabel && <span style={{ fontSize: "0.8rem", color: "#374151" }}>{dateLabel}</span>}
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

                    <div
                      style={{
                        maxHeight: isOpen ? "900px" : "0px",
                        overflow: "hidden",
                        transition: "max-height 0.25s ease",
                        background: "#f7f7ff",
                      }}
                    >
                      <div style={{ padding: "0.9rem 0.95rem 1rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {(day.items || []).map((item, idx) => {
                            const timeLabel = formatTimeRange(item);
                            const seq = idx + 1;

                            // Build image search query from location title + city context
                            const imgQuery = buildImageQuery(item.title, trip.main_city, trip.main_country);

                            return (
                              <div
                                key={item.id}
                                style={{
                                  borderRadius: "12px",
                                  border: "1px solid #e5e7eb",
                                  background: "white",
                                  padding: "0.6rem 0.8rem",
                                  display: "grid",
                                  gridTemplateColumns: "auto 110px minmax(0, 1fr) auto",
                                  columnGap: "0.75rem",
                                  alignItems: "center",
                                }}
                              >
                                {/* Sequence bubble */}
                                <div
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: "999px",
                                    backgroundColor: bubbleBg,
                                    color: bubbleText,
                                    border: `1px solid ${bubbleBorder}`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                  }}
                                  title={`Stop ${seq}`}
                                >
                                  {seq}
                                </div>

                                {/* Place photo thumbnail */}
                                <PlaceThumb query={imgQuery} alt={item.title} width={110} height={64} radius={12} />

                                {/* Text content */}
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      marginBottom: 2,
                                      gap: 8,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "0.9rem",
                                        fontWeight: 600,
                                        color: "#111827",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                      title={item.title}
                                    >
                                      {item.title}
                                    </div>

                                    {timeLabel && (
                                      <div style={{ fontSize: "0.75rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                                        {timeLabel}
                                      </div>
                                    )}
                                  </div>

                                  {item.address && (
                                    <div
                                      style={{
                                        fontSize: "0.8rem",
                                        color: "#6b7280",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                      title={item.address}
                                    >
                                      {item.address}
                                    </div>
                                  )}

                                  {item.notes_summary && (
                                    <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#4b5563", lineHeight: 1.35 }}>
                                      {item.notes_summary}
                                    </div>
                                  )}
                                </div>

                                {/* Right spacer */}
                                <div style={{ width: 1, height: 1 }} />
                              </div>
                            );
                          })}

                          {(day.items || []).length === 0 && (
                            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>No stops added for this day.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside style={{ borderRadius: "16px", background: "#eaf0ff", padding: "0.9rem 0.75rem", height: "fit-content" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "0.7rem" }}>Itinerary</div>

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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.15rem", color: isActive ? "#4f46e5" : "#374151" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                        {dow} {dm}
                      </div>
                      <div style={{ fontSize: "0.72rem", opacity: 0.9 }}>Day {day.day_index}</div>

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

      <CopyItineraryModal
        isOpen={showCopyModal}
        trip={trip}
        onClose={() => setShowCopyModal(false)}
        onConfirm={handleCopyItinerary}
        copying={copying}
      />

      <FlagItineraryModal
        isOpen={showFlagModal}
        tripTitle={trip.title}
        onClose={() => setShowFlagModal(false)}
        onSubmit={handleFlagItinerary}
        flagging={flagging}
      />
    </>
  );
}
