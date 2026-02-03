import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import LandingNavbar from "../components/landingNavbar";
import { supabase } from "../lib/supabaseClient";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
  // We’ll prefer start_time, else end_time.
  return formatHHMM(item.start_time) || formatHHMM(item.end_time) || "";
}

export default function DiscoveryItineraryDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Navigation links for LandingNavbar
  const navLinks = [
    { name: 'Home', path: '/landing-page#hero' },
    { name: 'About Us', path: '/landing-page#about' },
    { name: 'Travel Guides', path: '/Demo' },
    { name: 'FAQ', path: '/guest-faq' },
  ];

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tripId]);

  // Placeholder handlers for navbar (can be connected to actual modals)
  const handleLoginClick = () => {
    navigate('/signin');
  };

  const handleSignupClick = () => {
    navigate('/signin');
  };

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

  const mapCenter: LatLngExpression = useMemo(() => {
    if (mapPoints.length === 0) return [1.3521, 103.8198];
    const avgLat =
      mapPoints.reduce((sum, p) => sum + p.lat, 0) / mapPoints.length;
    const avgLon =
      mapPoints.reduce((sum, p) => sum + p.lon, 0) / mapPoints.length;
    return [avgLat, avgLon];
  }, [mapPoints]);

  const polylinePositions: LatLngExpression[] = useMemo(() => {
    return mapPoints.map((p) => [p.lat, p.lon]) as LatLngExpression[];
  }, [mapPoints]);

  const handleCopyItinerary = () => {
    alert("Copy itinerary feature coming soon ✈️");
  };

  // ---------------- Render states ----------------

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f7" }}>
        {!isLoggedIn && <LandingNavbar navLinks={navLinks} onLoginClick={handleLoginClick} onSignupClick={handleSignupClick} />}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
          <Link to={isLoggedIn ? "/dashboard" : "/landing-page"} style={{ fontSize: "0.85rem", color: "#555", textDecoration: "none" }}>
            ← {isLoggedIn ? "Back to Dashboard" : "Back to Home"}
          </Link>
          <p style={{ marginTop: "1.5rem", color: "#555" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f7" }}>
        {!isLoggedIn && <LandingNavbar navLinks={navLinks} onLoginClick={handleLoginClick} onSignupClick={handleSignupClick} />}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
          <Link to={isLoggedIn ? "/dashboard" : "/landing-page"} style={{ fontSize: "0.85rem", color: "#555", textDecoration: "none" }}>
            ← {isLoggedIn ? "Back to Dashboard" : "Back to Home"}
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
  const activeDay = days.find((d) => d.id === expandedDayId) || days[0] || null;

  return (
    <>
      {!isLoggedIn && <LandingNavbar navLinks={navLinks} onLoginClick={handleLoginClick} onSignupClick={handleSignupClick} />}
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
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {polylinePositions.length > 1 && (
                <Polyline positions={polylinePositions} />
              )}
              {mapPoints.map((p) => (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lon]}
                  icon={createNumberIcon(p.order)}
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
                to={isLoggedIn ? "/dashboard" : "/landing-page"}
                style={{
                  fontSize: "0.85rem",
                  color: "#6b7280",
                  textDecoration: "none",
                }}
              >
                ← {isLoggedIn ? "Back to Dashboard" : "Back to Home"}
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

            <button
              onClick={handleCopyItinerary}
              style={{
                marginLeft: "auto",
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
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1f2937" }}>
                        {dayLabel}
                      </span>
                      {dateLabel && (
                        <span style={{ fontSize: "0.8rem", color: "#374151" }}>{dateLabel}</span>
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
                              <div style={{ fontSize: "0.78rem", color: "#6b7280", paddingTop: "0.15rem" }}>
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
                              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
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
                                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                  ) : null}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>
                                    {item.title}
                                  </div>
                                  {item.notes_summary && (
                                    <div style={{ marginTop: "0.15rem", fontSize: "0.78rem", color: "#6b7280" }}>
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
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: "0.7rem" }}>
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
    </>
  );
}
