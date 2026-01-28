// frontend/src/components/TripSubHeader.tsx
import { NavLink, useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import styled from "styled-components";
import { MapPin, CalendarDays, Settings, Globe, Lock, BedDouble } from "lucide-react";
import { apiFetch } from "../lib/apiClient";
import ShareTripModal from "./ShareTripModal";

type CollaboratorSummary = {
  id: string;
  full_name: string;
  email: string;
  initials: string; // from TripCollaboratorSummarySerializer
  is_owner: boolean;
  is_current_user?: boolean;
};

type TripOverview = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  start_date: string | null;
  end_date: string | null;
  collaborators: CollaboratorSummary[];
  location_label: string;
  duration_label: string;
  currency_code: string | null;
  currency_symbol: string;
  planned_total: string | null;
  visibility?: "private" | "shared" | "public";
};

/* ============================
   Helpers
============================= */

function fallbackInitials(c: CollaboratorSummary): string {
  if (c.initials && c.initials.trim()) return c.initials;
  if (c.full_name && c.full_name.trim()) {
    const parts = c.full_name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (c.email && c.email.length > 0) return c.email[0].toUpperCase();
  return "U";
}

async function patchTripDates(tripId: number, start: string | null, end: string | null) {
  const updated = await apiFetch(`/f1/trips/${tripId}/`, {
    method: "PATCH",
    body: JSON.stringify({ start_date: start, end_date: end }),
  });

  // let other pages/components know
  window.dispatchEvent(new CustomEvent("trip-updated", { detail: { tripId } }));
  return updated;
}

/* ============================
   Styled Components
============================= */

// Top header (white / light gradient background)
const HeaderContainer = styled.div`
  width: 100%;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(
    90deg,
    rgba(248, 250, 252, 1) 0%,
    rgba(255, 250, 245, 1) 100%
  );
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
`;

const Inner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.85rem 1.5rem 0.25rem;

  @media (max-width: 768px) {
    padding: 0.75rem 1rem 0.25rem;
  }
`;

// Title left, stats right
const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 0.5rem;

  @media (max-width: 900px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
`;

// Left block: title + collaborators + buttons
const LeftBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const TitleAndCollabs = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const TripTitle = styled.h1`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: #111827;
`;

const CollaboratorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
`;

const AvatarWrap = styled.div`
  position: relative;
  display: inline-flex;
`;

const Avatar = styled.div<{ $online?: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: white;
  box-shadow: ${(p) =>
    p.$online
      ? "0 0 0 2px #bbf7d0, 0 0 10px rgba(34, 197, 94, 0.6)"
      : "none"};
`;

const OnlineDot = styled.span`
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  background: #22c55e;
  border: 2px solid #ffffff;
  border-radius: 999px;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.7);
`;

const PillButton = styled.button`
  border-radius: 999px;
  padding: 0.4rem 1rem;
  border: 1px solid #cbd5f5;
  background-color: white;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  color: #1f2933;
  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease;

  &:hover {
    background-color: #eff6ff;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
    transform: translateY(-0.5px);
  }
`;

const InviteButton = styled(PillButton)`
  background-color: #1d4ed8;
  border-color: #1d4ed8;
  color: #f9fafb;

  &:hover {
    background-color: #1e40af;
  }
`;

const ShareButton = styled(PillButton)`
  border-color: #6366f1;
  color: #4f46e5;
`;

const ExportButton = styled(PillButton)`
  background: #6366f1;
  border-color: #6366f1;
  color: #f9fafb;

  &:hover {
    background: #4f46e5;
  }
`;

const BookButton = styled(PillButton)`
  border-color: #10b981;
  color: #065f46;
  background: #ecfdf3;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  &:hover {
    background: #d1fae5;
    border-color: #059669;
  }
`;

const SettingsButton = styled(PillButton)`
  padding: 0.4rem 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-color: #d1d5db;
  color: #6b7280;

  &:hover {
    color: #374151;
    background: #f3f4f6;
  }
`;

const SettingsDropdownWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const SettingsDropdown = styled.div<{ $open: boolean }>`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 220px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
  border: 1px solid #e5e7eb;
  padding: 0.5rem 0;
  z-index: 100;
  display: ${(p) => (p.$open ? "block" : "none")};
`;

const DropdownItem = styled.div`
  padding: 0.65rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: #f8fafc;
  }
`;

const DropdownLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #374151;
  font-weight: 500;
`;

const VisibilityToggle = styled.button<{ $isPublic: boolean }>`
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: ${(p) => (p.$isPublic ? "#10b981" : "#d1d5db")};
  transition: background 0.2s ease;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${(p) => (p.$isPublic ? "22px" : "2px")};
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: left 0.2s ease;
  }
`;

type StayProvider = {
  name: string;
  url: string;
  accent: string;
  textColor: string;
};

// Right block: location / duration / currency
const RightStats = styled.div`
  display: flex;
  align-items: center;
  gap: 1.75rem;
  color: #6b7280;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  flex-wrap: nowrap;

  @media (max-width: 900px) {
    align-self: stretch;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const StatLabel = styled.span``;

const StatValueRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: #111827;
`;

const StatDivider = styled.div`
  width: 1px;
  height: 32px;
  background-color: #e5e7eb;
  align-self: center;

  @media (max-width: 900px) {
    display: none;
  }
`;

// Tabs gradient bar (full-width)
const TabsContainer = styled.div`
  width: 100%;
  background: linear-gradient(
    90deg,
    rgba(239, 246, 255, 1) 0%,
    rgba(250, 245, 255, 1) 100%
  );
  border-bottom: 1px solid #e5e7eb;
  /* match TopBar / header font */
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
`;

// Tabs centered within content width
const TabsInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.5rem 1.5rem 0.75rem;
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    padding: 0.35rem 1rem 0.75rem;
  }
`;

// Tab link
const TabLink = styled(NavLink)<{ $active?: boolean }>`
  font-size: 0.9rem;
  padding: ${(p) => (p.$active ? "0.35rem 1.1rem" : "0.35rem 0.4rem")};
  border-radius: 999px;
  border: none;
  background: ${(p) => (p.$active ? "#111827" : "transparent")};
  color: ${(p) => (p.$active ? "#f9fafb" : "#4b5563")};
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${(p) => (p.$active ? "#111827" : "rgba(17,24,39,0.06)")};
    color: ${(p) => (p.$active ? "#f9fafb" : "#111827")};
  }
`;

/* ============================
   Component
============================= */

type TripSubHeaderProps = {
  onExport?: () => void;
};

function HotelBookingModal({
  open,
  onClose,
  stayLabel,
}: {
  open: boolean;
  onClose: () => void;
  stayLabel: string;
}) {
  if (!open) return null;

  const providers: StayProvider[] = [
    { name: "Booking.com", url: "https://www.booking.com", accent: "#0b63c5", textColor: "#0b63c5" },
    { name: "airbnb", url: "https://www.airbnb.com", accent: "#ff5a60", textColor: "#d11f4d" },
    { name: "HOSTELWORLD", url: "https://www.hostelworld.com", accent: "#f97316", textColor: "#c2410c" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 94%)",
          background: "white",
          borderRadius: 22,
          padding: "1.4rem 1.5rem",
          boxShadow: "0 22px 50px rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>
          Find a place to stay
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {providers.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.9rem 1rem",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                textDecoration: "none",
                background: "#f8fafc",
                boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: p.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                  }}
                >
                  {p.name.charAt(0)}
                </div>
                <div style={{ fontWeight: 700, color: p.textColor, fontSize: "1rem", width: 120 }}>{p.name}</div>
              </div>
              <div style={{ color: "#475569", fontWeight: 500, fontSize: "0.9rem", flex: 1, textAlign: "right", paddingRight: 12 }}>
                {stayLabel || "Select dates"}
              </div>
              <div style={{ color: "#94a3b8", flex: "0 0 auto" }}>›</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TripSubHeader({ onExport }: TripSubHeaderProps) {
  const { tripId } = useParams<{ tripId: string }>();
  const location = useLocation();
  const [trip, setTrip] = useState<TripOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [hotelsModalOpen, setHotelsModalOpen] = useState(false);

  const [editingDates, setEditingDates] = useState(false);
  const [startDraft, setStartDraft] = useState<string>("");
  const [endDraft, setEndDraft] = useState<string>("");

  // Settings dropdown state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // Track the original non-public visibility (private or shared) to restore when toggling back from public
  const originalPrivateVisibilityRef = useRef<"private" | "shared">("private");

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update the original private visibility when trip loads (only if not public)
  useEffect(() => {
    if (trip?.visibility && trip.visibility !== "public") {
      originalPrivateVisibilityRef.current = trip.visibility as "private" | "shared";
    }
  }, [trip?.visibility]);

  const handleToggleVisibility = async () => {
    if (!trip || !tripId) return;
    
    const currentVisibility = trip.visibility || "private";
    
    let newVisibility: "private" | "shared" | "public";
    
    if (currentVisibility === "public") {
      // Toggling from public to non-public
      // Check if there are collaborators (other than owner) - if so, use "shared"
      const hasCollaborators = trip.collaborators.some(c => !c.is_owner);
      newVisibility = hasCollaborators ? "shared" : originalPrivateVisibilityRef.current;
    } else {
      // Toggling from private/shared to public
      newVisibility = "public";
    }
    
    // Optimistic update - update UI immediately
    setTrip((prev) => prev ? { ...prev, visibility: newVisibility } : prev);
    
    try {
      await apiFetch(`/f1/trips/${tripId}/`, {
        method: "PATCH",
        body: JSON.stringify({ visibility: newVisibility }),
      });
      // Don't dispatch trip-updated here to avoid refetch overwriting our state
    } catch (err) {
      console.error("Failed to update visibility:", err);
      // Revert on error
      setTrip((prev) => prev ? { ...prev, visibility: currentVisibility } : prev);
    }
  };
  const [shareModalOpen, setShareModalOpen] = useState(false); 

  useEffect(() => {
    if (!tripId) return;

    const handler = async (e: any) => {
      if (Number(e?.detail?.tripId) !== Number(tripId)) return;

      try {
        const data = await apiFetch(`/f1/trips/${tripId}/overview/`);
        setTrip(data);
        setStartDraft(data.start_date ?? "");
        setEndDraft(data.end_date ?? "");
      } catch (err) {
        console.error("Failed to refresh trip overview:", err);
      }
    };

    window.addEventListener("trip-updated", handler);
    return () => window.removeEventListener("trip-updated", handler);
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;

    async function loadTrip() {
      setLoading(true);
      try {
        const data = await apiFetch(`/f1/trips/${tripId}/overview/`);
        setTrip(data);
        setStartDraft(data.start_date ?? "");
        setEndDraft(data.end_date ?? "");
      } catch (err) {
        console.error("Failed to load trip overview:", err);
        setTrip(null);
      } finally {
        setLoading(false);
      }
    }

    loadTrip();
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;

    let cancelled = false;

    const pollPresence = async () => {
      try {
        const res = await apiFetch(`/f2/trips/${tripId}/presence/`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        if (!cancelled) {
          setOnlineUserIds(res?.online_user_ids || []);
        }
      } catch (err) {
        console.warn("Presence poll failed:", err);
      }
    };

    pollPresence();
    const intervalId = window.setInterval(pollPresence, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [tripId]);

  if (!tripId) return null;

  const basePath = `/trip/${tripId}`;
  const isActiveTab = (suffix: string) =>
    location.pathname === `${basePath}${suffix}`;

  if (loading || !trip) {
    const title = loading ? "Loading trip..." : "Trip not found";
    return (
      <>
        <HeaderContainer>
          <Inner>
            <TitleRow>
              <LeftBlock>
                <TripTitle>{title}</TripTitle>
              </LeftBlock>
            </TitleRow>
          </Inner>
        </HeaderContainer>
        <TabsContainer>
          <TabsInner />
        </TabsContainer>
      </>
    );
  }

  // sort collaborators: current user first, then owner, then by name
  const collaboratorsSorted = [...trip.collaborators].sort((a, b) => {
    const aCur = a.is_current_user ? 0 : 1;
    const bCur = b.is_current_user ? 0 : 1;
    if (aCur !== bCur) return aCur - bCur;

    if (a.is_owner && !b.is_owner) return -1;
    if (!a.is_owner && b.is_owner) return 1;

    return (a.full_name || "").localeCompare(b.full_name || "");
  });

  const plannedDisplay =
    trip.planned_total != null
      ? Number(trip.planned_total).toLocaleString()
      : "-";

  const stayLabel = (() => {
    const loc = trip.main_city || trip.location_label || "Your trip";
    if (trip.start_date && trip.end_date) {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
      return `${loc}, ${start.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, opts)}`;
    }
    return loc;
  })();

  return (
    <>
      {/* Header (title, avatars, buttons, stats) */}
      <HeaderContainer>
        <Inner>
          <TitleRow>
            {/* LEFT: title + collaborators + buttons */}
            <LeftBlock>
              <TitleAndCollabs>
                <TripTitle>{trip.title}</TripTitle>

                <CollaboratorRow>
                  {collaboratorsSorted.map((c, index) => {
                    const isOnline = onlineUserIds.includes(String(c.id));
                    return (
                      <AvatarWrap key={`${c.id}-${index}`}>
                        <Avatar
                          $online={isOnline}
                          style={{
                            backgroundColor: [
                              "#f97316",
                              "#22c55e",
                              "#6366f1",
                              "#ec4899",
                            ][index % 4],
                          }}
                        >
                          {fallbackInitials(c)}
                        </Avatar>
                        {isOnline && <OnlineDot />}
                      </AvatarWrap>
                    );
                  })}

                  <InviteButton>+ invite collaborators</InviteButton>
                  <ShareButton onClick={() => setShareModalOpen(true)}>Share</ShareButton>
                  <ExportButton onClick={onExport}>Export</ExportButton>
                  
                  {/* Settings dropdown */}
                  <SettingsDropdownWrapper ref={settingsRef}>
                    <SettingsButton
                      onClick={() => setSettingsOpen((prev) => !prev)}
                      title="Trip settings"
                    >
                      <Settings size={16} strokeWidth={2} />
                    </SettingsButton>
                    
                    <SettingsDropdown $open={settingsOpen}>
                      <DropdownItem onClick={handleToggleVisibility}>
                        <DropdownLabel>
                          {trip.visibility === "public" ? (
                            <Globe size={16} strokeWidth={2} color="#10b981" />
                          ) : (
                            <Lock size={16} strokeWidth={2} color="#6b7280" />
                          )}
                          <span>
                            {trip.visibility === "public" ? "Public" : "Private"}
                          </span>
                        </DropdownLabel>
                        <VisibilityToggle
                          $isPublic={trip.visibility === "public"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleVisibility();
                          }}
                        />
                      </DropdownItem>
                    </SettingsDropdown>
                  </SettingsDropdownWrapper>
                </CollaboratorRow>
              </TitleAndCollabs>
            </LeftBlock>

            {/* RIGHT: location / duration / currency */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <RightStats>
                <StatItem>
                  <StatLabel>Location</StatLabel>
                  <StatValueRow>
                    <MapPin size={16} strokeWidth={2.1} />
                    <span>{trip.location_label || "--"}</span>
                  </StatValueRow>
                </StatItem>

                <StatDivider />

                <StatItem>
                  <StatLabel>Duration</StatLabel>
                  <StatValueRow>
                    <CalendarDays size={16} strokeWidth={2.1} />

                    {!editingDates ? (
                      <span
                        style={{ cursor: "pointer" }}
                        title="Click to edit dates"
                        onClick={() => setEditingDates(true)}
                      >
                        {trip.duration_label || "--"}
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="date"
                          value={startDraft}
                          onChange={(e) => setStartDraft(e.target.value)}
                          style={{
                            border: "1px solid #d1d5db",
                            borderRadius: 8,
                            padding: "0.25rem 0.4rem",
                            fontSize: "0.85rem",
                          }}
                        />
                        <span style={{ color: "#9ca3af" }}>--</span>
                        <input
                          type="date"
                          value={endDraft}
                          onChange={(e) => setEndDraft(e.target.value)}
                          style={{
                            border: "1px solid #d1d5db",
                            borderRadius: 8,
                            padding: "0.25rem 0.4rem",
                            fontSize: "0.85rem",
                          }}
                        />

                        <button
                          onClick={async () => {
                            const updated = await patchTripDates(
                              Number(tripId),
                              startDraft || null,
                              endDraft || null
                            );

                            // keep this component in sync immediately
                            setTrip((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    start_date: updated.start_date,
                                    end_date: updated.end_date,
                                    duration_label: updated.duration_label ?? prev.duration_label,
                                  }
                                : prev
                            );

                            setEditingDates(false);
                          }}
                          style={{
                            marginLeft: 6,
                            borderRadius: 999,
                            border: "none",
                            background: "#111827",
                            color: "white",
                            padding: "0.25rem 0.7rem",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                          }}
                        >
                          Save
                        </button>

                        <button
                          onClick={() => {
                            setStartDraft(trip.start_date ?? "");
                            setEndDraft(trip.end_date ?? "");
                            setEditingDates(false);
                          }}
                          style={{
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            background: "white",
                            padding: "0.25rem 0.7rem",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </StatValueRow>
                </StatItem>

                <StatDivider />

                <StatItem>
                  <StatLabel>Budget</StatLabel>
                  <StatValueRow>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        lineHeight: "16px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      {trip.currency_symbol}
                    </span>

                    <span style={{ marginLeft: 6, whiteSpace: "nowrap" }}>
                      {plannedDisplay}
                    </span>
                  </StatValueRow>
                </StatItem>
              </RightStats>
              <BookButton onClick={() => setHotelsModalOpen(true)}>
                <BedDouble size={16} strokeWidth={2} />
                Book hotels
              </BookButton>
            </div>
          </TitleRow>
        </Inner>
      </HeaderContainer>

      {/* Tabs gradient bar (full-width, centered tabs) */}
      <TabsContainer>
        <TabsInner>
          <TabLink
            to={`${basePath}/itinerary`}
            $active={isActiveTab("/itinerary")}
            end
          >
            Itinerary
          </TabLink>

          <TabLink
            to={`${basePath}/notes`}
            $active={isActiveTab("/notes")}
          >
            Notes &amp; Checklists
          </TabLink>

          <TabLink
            to={`${basePath}/budget`}
            $active={isActiveTab("/budget")}
          >
            Budget
          </TabLink>

          <TabLink
            to={`${basePath}/media`}
            $active={isActiveTab("/media")}
          >
            Media Highlights
          </TabLink>

          <TabLink
            to={`${basePath}/recommendations`}
            $active={isActiveTab("/recommendations")}
          >
            Recommendations
          </TabLink>
        </TabsInner>
      </TabsContainer>

      <HotelBookingModal
        open={hotelsModalOpen}
        onClose={() => setHotelsModalOpen(false)}
        stayLabel={stayLabel}
      />

      <ShareTripModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        tripId={tripId || ""}
        tripTitle={trip.title}
      />      
    </>
  );
}

