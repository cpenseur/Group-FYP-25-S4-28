// frontend/src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import TripCard, { type TripOverview } from "../components/TripCard";
import planbotSmall from "../assets/planbotSmall.png";
import Onboarding from "../components/onboarding";
import {
  Plus,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Bot,
  Info,
  Check,
} from "lucide-react";


type Collaborator = { id: number; initials: string };

function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

function formatISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isUpcoming(t: TripOverview, today: Date) {
  if (!t.end_date) return true;
  const end = parseISO(t.end_date);
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return end >= dayStart;
}

/** Calendar ---------------------------------------------------- */

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function getMonthGridStart(month: Date) {
  // Monday-based grid
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const day = first.getDay(); // 0 Sun..6 Sat
  const mondayIndex = (day + 6) % 7; // 0 Mon..6 Sun
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex);
  return start;
}

function buildDateTripMap(trips: TripOverview[]) {
  const map = new Map<string, TripOverview[]>();

  for (const t of trips) {
    if (!t.start_date || !t.end_date) continue;

    const start = parseISO(t.start_date);
    const end = parseISO(t.end_date);
    const s = start <= end ? start : end;
    const e = start <= end ? end : start;

    const cur = new Date(s);
    while (cur <= e) {
      const iso = formatISO(cur);
      const arr = map.get(iso) ?? [];
      arr.push(t);
      map.set(iso, arr);
      cur.setDate(cur.getDate() + 1);
    }
  }

  return map;
}

const DOT_PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#a855f7"];

function dotColorForTrip(t: TripOverview) {
  const id = Number(t.id) || 0;
  return DOT_PALETTE[id % DOT_PALETTE.length];
}

function TripsCalendar({
  trips,
  loading,
}: {
  trips: TripOverview[];
  loading: boolean;
}) {
  const [month, setMonth] = useState(() => new Date());

  const dateTripMap = useMemo(() => buildDateTripMap(trips), [trips]);
  const start = useMemo(() => getMonthGridStart(month), [month]);

  const days = useMemo(() => {
    const out: Date[] = [];
    const cur = new Date(start);
    for (let i = 0; i < 42; i++) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [start]);

  const monthIdx = month.getMonth();
  const todayIso = formatISO(new Date());

  return (
    <div style={calendarCard}>
      <div style={calendarHeader}>
        <span>{monthLabel(month)}</span>
        <span style={{ display: "inline-flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            style={calNavBtn}
            aria-label="Previous month"
          >
            <ChevronUp size={16} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            style={calNavBtn}
            aria-label="Next month"
          >
            <ChevronDown size={16} strokeWidth={2.5} />
          </button>
        </span>
      </div>

      <div style={calendarWeekRow}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} style={calDow}>
            {d}
          </div>
        ))}
      </div>

      {/* skeleton overlay feel while loading (no layout shift) */}
      <div style={{ opacity: loading ? 0.6 : 1 }}>
        <div style={calendarGrid}>
          {days.map((d) => {
            const iso = formatISO(d);
            const inMonth = d.getMonth() === monthIdx;
            const isToday = iso === todayIso;

            const tripsForDay = dateTripMap.get(iso) ?? [];
            const dotTrips = tripsForDay.slice(0, 3);
            const extra = Math.max(tripsForDay.length - dotTrips.length, 0);

            const tooltip =
              tripsForDay.length
                ? tripsForDay
                    .map((t) => {
                      const city = t.main_city || t.location_label || "Unknown city";
                      const country = t.main_country || "Unknown country";
                      return `${city}, ${country}`;
                    })
                    .join("\n")
                : undefined;

            return (
              <div
                key={iso}
                style={{
                  height: 40,
                  borderRadius: 12,
                  display: "grid",
                  gridTemplateRows: "1fr auto",
                  placeItems: "center",
                  paddingTop: 6,
                  paddingBottom: 6,
                  color: inMonth ? "#111827" : "#9ca3af",
                  outline: isToday ? "2px solid rgba(99,102,241,0.30)" : "none",
                  background: tripsForDay.length ? "rgba(17,24,39,0.02)" : "transparent",
                  border: tripsForDay.length ? "1px solid rgba(17,24,39,0.06)" : "1px solid transparent",
                  cursor: tripsForDay.length ? "pointer" : "default",
                }}
                title={tooltip}
              >
                <div style={{ fontSize: 13, fontWeight: 650, lineHeight: "14px" }}>{d.getDate()}</div>

                {/* dots row */}
                <div style={{ display: "flex", gap: 3, alignItems: "center", height: 10 }}>
                  {dotTrips.map((t) => (
                    <span
                      key={t.id}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: dotColorForTrip(t),
                        display: "inline-block",
                      }}
                    />
                  ))}

                  {extra > 0 ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginLeft: 2 }}>
                      +{extra}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const calNavBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 18,
  lineHeight: "18px",
  color: "#111827",
};

/** Page -------------------------------------------------------- */

export default function DashboardPage() {
  const navigate = useNavigate();

  const [trips, setTrips] = useState<TripOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Pending invitation overlay state
  const [showInvitationOverlay, setShowInvitationOverlay] = useState(false);
  const [invitationProgress, setInvitationProgress] = useState(0);
  const [invitationTripTitle, setInvitationTripTitle] = useState("");

  // Check for pending invitation from TripInvitationPage
  useEffect(() => {
    const processPendingInvitation = async () => {
      const pendingData = sessionStorage.getItem('pendingInvitation');
      if (!pendingData) return;
      
      try {
        const { token, tripTitle } = JSON.parse(pendingData);
        if (!token) return;
        
        // Clear it immediately to prevent re-processing
        sessionStorage.removeItem('pendingInvitation');
        
        // Show the overlay
        setShowInvitationOverlay(true);
        setInvitationTripTitle(tripTitle || 'your trip');
        setInvitationProgress(10);
        
        // Wait for auth to be fully established - check repeatedly
        let authReady = false;
        for (let i = 0; i < 10; i++) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            authReady = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          setInvitationProgress(10 + i * 3);
        }
        
        if (!authReady) {
          console.error('Auth not ready after waiting');
          setShowInvitationOverlay(false);
          return;
        }
        
        setInvitationProgress(40);
        
        // Additional delay to ensure backend session is synced
        await new Promise(resolve => setTimeout(resolve, 500));
        setInvitationProgress(50);
        
        // Accept the invitation
        console.log('Accepting invitation with token:', token);
        const response = await apiFetch(`/f1/trip-invitation/${token}/accept/`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        // Only show overlay and redirect if invitation is valid
        const tripId = response.trip_id;
        if (tripId) {
          setInvitationTripTitle(response.trip_title || tripTitle || 'your trip');
          setInvitationProgress(70);
          setShowInvitationOverlay(true);
          setInvitationProgress(90);
          await new Promise(resolve => setTimeout(resolve, 600));
          setInvitationProgress(100);
          await new Promise(resolve => setTimeout(resolve, 300));
          navigate(`/trip/${tripId}/itinerary`);
        } else {
          setShowInvitationOverlay(false);
          return;
        }
      } catch (err: any) {
        console.error('Failed to process pending invitation:', err);
        
        // Check if it's an "already accepted" case with trip_id
        const errorData = err.data || err;
        const tripIdFromError = errorData?.trip_id;
        // If we have a tripId from error, show overlay and redirect
        if ((err.message?.includes('already') || tripIdFromError)) {
          if (tripIdFromError) {
            setInvitationTripTitle(errorData?.trip_title || tripTitle || 'your trip');
            setInvitationProgress(90);
            setShowInvitationOverlay(true);
            setInvitationProgress(100);
            await new Promise(resolve => setTimeout(resolve, 300));
            navigate(`/trip/${tripIdFromError}/itinerary`);
            return;
          } else {
            // Already accepted but no tripId, do NOT show overlay or route
            setShowInvitationOverlay(false);
            return;
          }
        }
        setShowInvitationOverlay(false);
      }
    };
    
    processPendingInvitation();
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        setShowOnboarding(true);
      }
    })();
  }, []);

  async function loadTrips() {
    setLoading(true);

    const list = await apiFetch("/f1/trips/", { method: "GET" });
    const baseTrips: TripOverview[] = Array.isArray(list) ? list : list?.results ?? [];

    // ensure we have collaborators/budget/location_label (from overview endpoint)
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
    let wasLoggedIn = false;
    supabase.auth.getSession().then(({ data }) => {
      wasLoggedIn = !!data.session;
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && !wasLoggedIn) {
        loadTrips();
        wasLoggedIn = true;
      }
      if (event === "SIGNED_OUT") {
        wasLoggedIn = false;
      }
    });
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const today = new Date();

  const upcomingTrips = useMemo(() => {
    const arr = trips.filter((t) => isUpcoming(t, today) && t.travel_type !== "group_ai_pending");
    return arr.sort((a, b) => {
      const ad = a.start_date ? parseISO(a.start_date).getTime() : 0;
      const bd = b.start_date ? parseISO(b.start_date).getTime() : 0;
      return ad - bd;
    });
  }, [trips]);

  const planbotTripId = upcomingTrips[0]?.id;

  // TripCard expects its own TripOverview type; ours is compatible
  const upcomingForCards = upcomingTrips as unknown as TripOverview[];

  return (
    <div style={pageBg}>
    {/* Only show onboarding if not processing invitation */}
    {!showInvitationOverlay && (
      <Onboarding
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    )}
      <div style={container}>
        {/* Header */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 6 }}>Plan your itinerary</div>
          <div style={pageTitle}>Welcome back!</div>
        </div>

        {/* Top row: left column + calendar */}
        <div style={topGrid}>
          {/* Left column */}
          <div>
            {/* Action row */}
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <button type="button" onClick={() => navigate("/create-trip")} style={createBtn}>
                <span style={plusCircle}>
                  <Plus size={16} strokeWidth={2.5} />
                </span>
                Create a new trip
              </button>

              {/* Search (goes to /trips) */}
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  placeholder="Search..."
                  onFocus={() => navigate("/trips")}
                  onClick={() => navigate("/trips")}
                  readOnly
                  style={searchPillInput}
                />
                <div style={searchIconCircle}>
                  <Search size={16} strokeWidth={2.5} />
                </div>
              </div>

              {/* Planbot */}
              <button
                type="button"
                onClick={() => {
                  if (planbotTripId) navigate(`/trip/${planbotTripId}/chatbot`);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  border: "none",
                  borderRadius: 999,
                  padding: "12px 18px",
                  background: "linear-gradient(90deg,#f7b267,#f79d65)",
                  color: "white",
                  fontWeight: 700,
                }}
                title={planbotTripId ? "Open Planbot" : "Create a trip first"}
              >
                <img
                  src={planbotSmall}
                  alt="Planbot"
                  style={{
                    width: 18,
                    height: 18,
                    objectFit: "contain",
                  }}
                />
                Planbot
              </button>
            </div>

            {/* Upcoming Trips card */}
            <div style={panelCard}>
              <div style={panelHeaderRow}>
                <div style={{ fontSize: 16, color: "#111827", fontWeight: 600 }}>
                  Upcoming Trips <span style={{ marginLeft: 10, color: "#9ca3af" }}><Info size={14} /></span>
                </div>

                <button type="button" onClick={() => navigate("/trips")} style={seeMoreBtn}>
                  See More
                </button>
              </div>

              <div style={upcomingBody}>
                  <div style={upcomingRow}>
                    <div style={upcomingCards}>
                      {(loading ? Array.from({ length: 3 }) : upcomingForCards.slice(0, 3)).map((t: any, idx: number) => {
                        if (loading) return <div key={idx} style={tripSkeleton} />;
                        return (
                          <TripCard
                            key={t.id}
                            trip={t}
                            variant="mini"
                            onClick={() => navigate(`/trip/${t.id}/itinerary`)}
                          />
                        );
                      })}
                    </div>

                    <button type="button" onClick={() => navigate("/trips")} style={arrowBtn} aria-label="See trips">
                      <ChevronRight size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
            </div>
          </div>

          {/* Right: Calendar */}
          <TripsCalendar trips={trips} loading={loading} />
        </div>

        {/* Bottom row: AI Generator (left) + Discover (right) */}
        <div style={bottomGrid}>
          {/* AI Trip Generator */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Try our AI Trip Generator</div>

            <button
              type="button"
              onClick={() => {
                navigate("/ai-trip-generator-step-1")
              }}
              style={aiCardBtn}
            >
              <div style={aiBadge}>
                <Bot size={14} />
                Generate with AI
              </div>

              <div style={aiInnerBox}>Try it out now!</div>

              <div style={{ marginTop: 14 }}>
                <span style={aiCta}><Sparkles size={14} /> Generate itinerary</span>
              </div>
            </button>
          </div>

          {/* Discover More */}
          <div>
            <div style={discoverHeader}>
              <span>Discover More</span>
              <button
                type="button"
                onClick={() => navigate("/discovery-local")}
                style={discoverArrowInline}
                aria-label="Discover more"
                title="Discover more"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>


            <div style={discoverCardsGrid}>
              <button type="button" onClick={() => navigate("/discovery-international")} style={discoverCardBtn}>
                <div style={discoverCard}>
                  <img
                    src="/trip-covers/scandinavia.png"
                    alt="Scandinavia"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/trip-covers/default.jpg";
                    }}
                  />
                  <div style={discoverCardLabel}>
                    Scandinavia
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>↻ 213km</div>
                  </div>
                </div>
              </button>

              <button type="button" onClick={() => navigate("/discovery-international")} style={discoverCardBtn}>
                <div style={discoverCard}>
                  <img
                    src="/trip-covers/grenadines.png"
                    alt="Grenadines"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/trip-covers/default.jpg";
                    }}
                  />
                  <div style={discoverCardLabel}>
                    Grenadines
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>↻ 123km</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Invitation acceptance overlay */}
      {showInvitationOverlay && (
        <div style={invitationOverlayStyle}>
          <div style={invitationModalStyle}>
            <div style={invitationIconStyle}>
              <Check size={40} color="#10b981" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Welcome Aboard! 🎉
            </div>
            <div style={{ fontSize: 16, color: '#6b7280', marginBottom: 24 }}>
              Taking you to "{invitationTripTitle}"...
            </div>
            <div style={invitationSpinnerStyle} />
            <div style={invitationProgressBarStyle}>
              <div style={{ ...invitationProgressFillStyle, width: `${invitationProgress}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Styles (match wireframe vibe) -------------------------------- */

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f4f6",
  paddingTop: "22px",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const container: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "0 28px 48px",
};

const pageTitle: React.CSSProperties = {
  fontSize: 44,
  fontWeight: 500,
  letterSpacing: "-0.02em",
  color: "#111827",
  marginBottom: 16,
  lineHeight: 1.05,
};

const topGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 420px",
  gap: 26,
  alignItems: "start",
};

const bottomGrid: React.CSSProperties = {
  marginTop: 22,
  display: "grid",
  gridTemplateColumns: "1fr 420px",
  gap: 26,
  alignItems: "start",
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

const searchPillInput: React.CSSProperties = {
  width: "85%",
  borderRadius: 999,
  border: "none",
  background: "#efefef",
  padding: "14px 54px 14px 18px",
  outline: "none",
  cursor: "pointer",
};

const searchIconCircle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  width: 34,
  height: 34,
  borderRadius: 999,
  background: "#6d79ff",
  display: "grid",
  placeItems: "center",
  color: "white",
  fontWeight: 900,
  pointerEvents: "none",
};

const panelCard: React.CSSProperties = {
  marginTop: 18,
  background: "white",
  borderRadius: 18,
  padding: 18,
  height: 344,
  border: "1px solid rgba(17,24,39,0.06)",
  boxShadow: "0 10px 22px rgba(15,23,42,0.08)",
  display: "flex",
  flexDirection: "column",
};


const panelHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};

const seeMoreBtn: React.CSSProperties = {
  border: "none",
  background: "#fde7d6",
  color: "#c2410c",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};

const arrowBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(15,23,42,0.08)",
  fontSize: 22,
  lineHeight: "22px",
  display: "grid",
  placeItems: "center",
};

const tripSkeleton: React.CSSProperties = {
  width: 240,
  height: 220,
  borderRadius: 16,
  background: "linear-gradient(135deg, #f3f4f6, #ffffff)",
  border: "1px solid rgba(17,24,39,0.06)",
};


const aiCardBtn: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(17,24,39,0.06)",
  background: "linear-gradient(135deg,#dbeafe 0%,#e9d5ff 35%,#cffafe 100%)",
  borderRadius: 18,
  padding: 18,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(15,23,42,0.08)",
  textAlign: "left",
};

const aiBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(99,102,241,0.25)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 650,
  color: "#ffffffff",
};

const aiInnerBox: React.CSSProperties = {
  marginTop: 12,
  background: "rgba(255,255,255,0.55)",
  borderRadius: 14,
  height: 120,
  padding: 14,
  color: "#724dc9ff",
};

const aiCta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "white",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 650,
  boxShadow: "0 10px 22px rgba(15,23,42,0.10)",
};

const discoverArrow: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#111827",
  fontWeight: 700,
  fontSize: 18,
};

const discoverCardBtn: React.CSSProperties = {
  border: "none",
  padding: 0,
  background: "transparent",
  cursor: "pointer",
  width: 255,
};

const discoverCard: React.CSSProperties = {
  height: 265,
  borderRadius: 18,
  overflow: "hidden",
  position: "relative",
  boxShadow: "0 10px 22px rgba(15,23,42,0.10)",
};

const discoverCardLabel: React.CSSProperties = {
  position: "absolute",
  left: 14,
  bottom: 14,
  color: "white",
  fontWeight: 750,
  fontSize: 20,
  textShadow: "0 2px 14px rgba(0,0,0,0.35)",
};

const discoverCardsGrid: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
};

const discoverHeader: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 16,
  fontWeight: 600,
  color: "#111827",
};

const discoverArrowInline: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  padding: 0,
};

const calendarCard: React.CSSProperties = {
  background: "white",
  borderRadius: 18,
  padding: 18,
  border: "1px solid rgba(17,24,39,0.06)",
  boxShadow: "0 10px 22px rgba(15,23,42,0.08)",
};

const calendarHeader: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 650,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
  color: "#111827",
};

const calendarWeekRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 6,
  marginBottom: 8,
};

const calDow: React.CSSProperties = {
  fontSize: 12,
  color: "#111827",
  fontWeight: 600,
  textAlign: "center",
};

const calendarGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 6,
};

const upcomingBody: React.CSSProperties = {
  flex: 1,
  display: "flex",
  minHeight: 0,
};

const upcomingRow: React.CSSProperties = {
  flex: 1,
  display: "flex",
  gap: 20,
  alignItems: "center",
  minHeight: 0,
};

const upcomingCards: React.CSSProperties = {
  flex: 1,
  display: "flex",
  gap: 22,
  overflow: "hidden",
  alignItems: "center",
};

// Invitation overlay styles
const invitationOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const invitationModalStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 24,
  padding: "3rem",
  maxWidth: 420,
  width: "90%",
  textAlign: "center",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
};

const invitationIconStyle: React.CSSProperties = {
  width: 80,
  height: 80,
  borderRadius: "50%",
  background: "rgba(16, 185, 129, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 1.5rem",
};

const invitationSpinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "3px solid #e5e7eb",
  borderTop: "3px solid #4f46e5",
  borderRadius: "50%",
  margin: "0 auto 1rem",
  animation: "spin 1s linear infinite",
};

const invitationProgressBarStyle: React.CSSProperties = {
  width: "100%",
  height: 6,
  background: "#e5e7eb",
  borderRadius: 3,
  overflow: "hidden",
};

const invitationProgressFillStyle: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #4f46e5, #6366f1)",
  borderRadius: 3,
  transition: "width 0.3s ease",
};

// Helper function to show overlay and redirect
function setInvitationOverlayAndRedirect(tripIdToUse) {
  setShowInvitationOverlay(true);
  setInvitationProgress(90);
  setTimeout(() => {
    setInvitationProgress(100);
    setTimeout(() => {
      navigate(`/trip/${tripIdToUse || tripId}/itinerary`);
    }, 300);
  }, 600);
}