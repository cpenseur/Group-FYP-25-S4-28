// frontend/src/pages/ViewTripPage.tsx
import { useEffect, useState } from "react";
import { useParams , useNavigate} from "react-router-dom";
import { MapPin, Eye, Bed, CalendarDays, FileText, DollarSign, Camera, Lightbulb } from "lucide-react";
import ItineraryMap, { MapItineraryItem } from "../components/ItineraryMap";
import Login from "../components/login"; 

type TripDay = {
  id: number;
  day_index: number;
  date: string | null;
  items: ItineraryItem[];
};

type ItineraryItem = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  thumbnail_url?: string | null;
};

type ViewTripData = {
  id: number;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  owner: {
    name: string;
  };
  days: TripDay[];
  is_view_only: boolean;
};

type ActiveTab = 'itinerary' | 'notes' | 'budget' | 'media' | 'recommendations';

export default function ViewTripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [tripData, setTripData] = useState<ViewTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('itinerary');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  const handleSignupClick = () => {
    setAuthMode("signup");
    setShowAuthModal(true);
  };

  useEffect(() => {
    if (!tripId) return;

    const fetchTripData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/trip/${tripId}/view/`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Trip not found");
          }
          throw new Error(`Failed to load trip`);
        }

        const data = await response.json();
        console.log("Trip data loaded:", data);
        setTripData(data);
        
        if (data.days && data.days.length > 0) {
          setActiveDay(data.days[0].day_index);
        }
      } catch (err) {
        console.error("Error fetching trip:", err);
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, [tripId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "";
    
    try {
      let dateObj: Date;
      
      // Parse different time formats
      if (timeString.includes('T')) {
        // ISO format with T: "2026-02-24T07:00:00"
        dateObj = new Date(timeString);
      } else if (timeString.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)) {
        // Format: "2026-02-24 07:00:00+00:00"
        const cleanTime = timeString.split('+')[0].trim(); // Remove timezone
        dateObj = new Date(cleanTime);
      } else if (timeString.includes(':')) {
        // Time only: "07:00:00" or "07:00"
        const timePart = timeString.split('.')[0]; // Remove milliseconds if present
        dateObj = new Date(`2000-01-01T${timePart}`);
      } else {
        return timeString;
      }

      if (isNaN(dateObj.getTime())) {
        console.warn("Invalid time:", timeString);
        return timeString;
      }

      return dateObj.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (err) {
      console.error("Error formatting time:", timeString, err);
      return timeString;
    }
  };

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const nights = days - 1;
    return `${days} DAYS - ${nights} NIGHTS`;
  };

  const mapItems: MapItineraryItem[] = tripData?.days.flatMap((day) =>
    day.items
      .filter(item => item.lat != null && item.lon != null)
      .map((item, idx) => ({
        id: item.id,
        title: item.title,
        address: item.address || item.location || null,
        lat: item.lat || null,
        lon: item.lon || null,
        sort_order: item.sort_order,
        day_index: day.day_index,
        stop_index: idx + 1,
      }))
  ) || [];

  const renderTabContent = () => {
    if (activeTab !== 'itinerary') {
      const tabIcons: Record<ActiveTab, React.ReactNode> = {
        itinerary: null,
        notes: <FileText size={48} strokeWidth={1.5} />,
        budget: <DollarSign size={48} strokeWidth={1.5} />,
        media: <Camera size={48} strokeWidth={1.5} />,
        recommendations: <Lightbulb size={48} strokeWidth={1.5} />,
      };

      const tabTitles: Record<ActiveTab, string> = {
        itinerary: '',
        notes: 'Notes & Checklists',
        budget: 'Budget',
        media: 'Media Highlights',
        recommendations: 'Recommendations',
      };

      return (
        <div style={emptyTabContent}>
          <div style={emptyIcon}>{tabIcons[activeTab]}</div>
          <h3 style={emptyTitle}>{tabTitles[activeTab]}</h3>
          <p style={emptyText}>
            This content is not available in view-only mode.
          </p>
        </div>
      );
    }
    
    const currentDayData = tripData?.days.find(d => d.day_index === activeDay);
    const currentItems = currentDayData?.items || [];

    return (
      <>
        <div style={itineraryHeader}>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#111827" }}>
            Itinerary Planner
          </h2>
        </div>

        {currentDayData && (
          <div style={daySection}>
            <div style={dayHeader}>
              DAY {currentDayData.day_index} {formatDate(currentDayData.date)}
            </div>

            {currentItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 2rem", color: "#9ca3af" }}>
                No activities planned for this day
              </div>
            ) : (
              <div>
                {currentItems.map((item, index) => (
                  <div key={item.id} style={itemCard}>
                    <div style={itemNumber}>{index + 1}</div>

                    <div style={itemImage}>
                      {item.thumbnail_url ? (
                        <img 
                          src={item.thumbnail_url} 
                          alt={item.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <h4 style={itemTitle}>{item.title}</h4>
                      </div>

                      {(item.start_time || item.end_time) && (
                        <div style={itemTime}>
                          {formatTime(item.start_time)}
                          {item.start_time && item.end_time && " – "}
                          {formatTime(item.end_time)}
                        </div>
                      )}

                      {item.location && (
                        <div style={itemLocation}>
                          <MapPin size={13} strokeWidth={2} />
                          {item.location}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div style={pageContainer}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          color: "#6b7280",
        }}>
          Loading trip...
        </div>
      </div>
    );
  }

  if (error || !tripData) {
    return (
      <div style={pageContainer}>
        <div style={{
          maxWidth: 600,
          margin: "4rem auto",
          background: "white",
          borderRadius: 16,
          padding: "3rem 2rem",
          textAlign: "center",
        }}>
          <h2 style={{ color: "#dc2626", marginBottom: "1rem" }}>
            Oops! {error || "Trip not found"}
          </h2>
          <p style={{ color: "#6b7280" }}>
            {error === "Trip not found"
              ? "This trip doesn't exist or has been removed."
              : "We couldn't load this trip. Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const duration = calculateDuration(tripData.start_date, tripData.end_date);
  const ownerInitial = tripData.owner?.name?.charAt(0)?.toUpperCase() || "P";

  console.log("Map items:", mapItems);

  return (
    <div style={pageContainer}>
      <div style={viewOnlyBanner}>
        <Eye size={16} strokeWidth={2.5} style={{ color: "#92400e" }} />
        <span>View-Only Mode — You're viewing a shared trip itinerary</span>
        <button onClick={handleSignupClick} style={signupBannerButton} > Sign up to create your own </button>
      </div>

      <div style={header}>
        <div style={headerContent}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flex: 1 }}>
            <div style={avatar}>{ownerInitial}</div>
            
            <div style={{ flex: 1 }}>
              <h1 style={tripTitle}>{tripData.title}</h1>
              
              <div style={{ display: "flex", gap: "2rem", alignItems: "center", marginTop: "0.5rem" }}>
                {tripData.destination && (
                  <div>
                    <div style={statLabel}>LOCATION</div>
                    <div style={statValue}>
                      <MapPin size={14} strokeWidth={2.2} style={{ color: "#111827" }} />
                      <span>{tripData.destination.toUpperCase()}</span>
                    </div>
                  </div>
                )}
                
                {duration && (
                  <div>
                    <div style={statLabel}>DURATION</div>
                    <div style={statValue}>
                      <CalendarDays size={14} strokeWidth={2.2} style={{ color: "#111827" }} />
                      <span>{duration}</span>
                    </div>
                  </div>
                )}

                <div>
                  <div style={statLabel}>BUDGET</div>
                  <div style={statValue}>
                    <span style={{ fontSize: "1rem", fontWeight: 600 }}>$</span>
                    <span>90,000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button style={bookButton} onClick={handleSignupClick}>
            <Bed size={16} strokeWidth={2} />
            Book hotels
          </button>
        </div>
      </div>

      <div style={tabsContainer} onClick={handleSignupClick}>
        <button 
          style={{ ...tab, ...(activeTab === 'itinerary' ? activeTabStyle : {}) }}
          onClick={() => setActiveTab('itinerary')}
        >
          Itinerary
        </button>
        <button 
          style={{ ...tab, ...(activeTab === 'notes' ? activeTabStyle : {}) }}
          onClick={() => setActiveTab('notes')}
        >
          Notes & Checklists
        </button>
        <button 
          style={{ ...tab, ...(activeTab === 'budget' ? activeTabStyle : {}) }}
          onClick={() => setActiveTab('budget')}
        >
          Budget
        </button>
        <button 
          style={{ ...tab, ...(activeTab === 'media' ? activeTabStyle : {}) }}
          onClick={() => setActiveTab('media')}
        >
          Media Highlights
        </button>
        <button 
          style={{ ...tab, ...(activeTab === 'recommendations' ? activeTabStyle : {}) }}
          onClick={() => setActiveTab('recommendations')}
        >
          Recommendations
        </button>
      </div>

      {/* FIT MAP TO FULL HEIGHT */}
      <div style={mainGrid}>
        <div style={mapSection}>
          {mapItems.length > 0 ? (
            <ItineraryMap items={mapItems} />
          ) : (
            <div style={mapPlaceholder}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📍</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                {tripData.destination || "Map View"}
              </div>
              <div style={{ fontSize: "0.95rem", opacity: 0.9 }}>
                No location coordinates available
              </div>
            </div>
          )}
        </div>

        <div style={itinerarySection}>
          {renderTabContent()}
        </div>

        {/* IMPROVED SIDEBAR */}
        <div style={daySidebar}>
          <div style={sidebarTitle}>
            Itinerary
          </div>

          {tripData.days.map((day) => {
            const dayDate = new Date(day.date || "");
            const dayOfWeek = dayDate.toLocaleDateString("en-US", { weekday: "short" });
            const monthDay = formatDateShort(day.date);

            return (
              <button
                key={day.id}
                onClick={() => {
                  setActiveDay(day.day_index);
                  setActiveTab('itinerary');
                }}
                style={{
                  ...dayButton,
                  ...(activeDay === day.day_index ? activeDayButton : {}),
                }}
              >
                <div style={{ marginBottom: "0.5rem" }}>
                  <div style={dayOfWeekStyle}>
                    {dayOfWeek}
                  </div>
                  <div style={dayDateStyle}>
                    {monthDay}
                  </div>
                </div>
                <div style={dayMetaStyle}>
                  <div style={dayIndexStyle}>Day {day.day_index}</div>
                  <div style={stopsCountStyle}>
                    {day.items.length} stops · — km
                  </div>
                  <div style={timeStyle}>time n/a</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <Login 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        defaultMode={authMode}
      />
    </div>
  );
}

/* Styles */
const pageContainer: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafb",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const signupBannerButton: React.CSSProperties = {
  marginLeft: "auto",
  marginRight: "1rem",
  padding: "0.5rem 1.2rem",
  borderRadius: 999,
  border: "2px solid #f59e0b",
  background: "#f59e0b",
  color: "white",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
};

const viewOnlyBanner: React.CSSProperties = {
  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
  borderBottom: "2px solid #f59e0b",
  padding: "0.75rem",
  textAlign: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.6rem",
  fontWeight: 600,
  fontSize: "0.9rem",
  color: "#92400e",
};

const header: React.CSSProperties = {
  background: "white",
  borderBottom: "1px solid #e5e7eb",
  padding: "1.25rem 2rem",
};

const headerContent: React.CSSProperties = {
  maxWidth: 1600,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1.5rem",
};

const avatar: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontWeight: 700,
  fontSize: "1.1rem",
  border: "2px solid white",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
};

const tripTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "#111827",
  lineHeight: 1.2,
};

const statLabel: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "0.25rem",
};

const statValue: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#111827",
};

const bookButton: React.CSSProperties = {
  borderRadius: 999,
  padding: "0.65rem 1.2rem",
  border: "1px solid #10b981",
  background: "#ecfdf3",
  color: "#065f46",
  fontSize: "0.9rem",
  fontWeight: 600,
  cursor: "default",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
};

const tabsContainer: React.CSSProperties = {
  background: "white",
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  gap: "2rem",
  padding: "0 2rem",
  maxWidth: 1600,
  margin: "0 auto",
};

const tab: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "1rem 0",
  fontSize: "0.95rem",
  fontWeight: 500,
  color: "#6b7280",
  cursor: "pointer",
  borderBottom: "3px solid transparent",
  position: "relative",
  top: 1,
  transition: "all 0.2s ease",
};

const activeTabStyle: React.CSSProperties = {
  fontWeight: 650,
  color: "#1f2937",
  borderBottom: "3px solid #1f2937",
};

// FIT MAP: Changed height to match full viewport minus header
const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2.5fr) minmax(0, 2fr) minmax(0, 0.35fr)",
  maxWidth: 1600,
  margin: "0 auto",
  alignItems: "flex-start",
  height: "calc(100vh - 230px)", // Added height constraint
};

const mapSection: React.CSSProperties = {
  position: "sticky",
  top: 0,
  height: "calc(100vh - 230px)", // Match parent height
  background: "#e5e7eb",
  overflow: "hidden",
};

const mapPlaceholder: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  textAlign: "center",
  padding: "2rem",
};

const itinerarySection: React.CSSProperties = {
  background: "white",
  minHeight: "calc(100vh - 230px)",
  padding: "1.5rem",
  overflowY: "auto",
  maxHeight: "calc(100vh - 230px)",
};

const itineraryHeader: React.CSSProperties = {
  marginBottom: "1.5rem",
};

const daySection: React.CSSProperties = {
  marginBottom: "1.5rem",
};

const dayHeader: React.CSSProperties = {
  background: "linear-gradient(135deg, #fafbfc 0%, #fff 100%)",
  padding: "0.9rem 1.25rem",
  borderTop: "1px solid #e5e7eb",
  borderLeft: "1px solid #e5e7eb",
  borderRight: "1px solid #e5e7eb",
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  fontSize: "1rem",
  fontWeight: 700,
  color: "#111827",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

const itemCard: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
  padding: "1.25rem",
  borderBottom: "1px solid #e5e7eb",
  borderLeft: "1px solid #e5e7eb",
  borderRight: "1px solid #e5e7eb",
  background: "white",
};

const itemNumber: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#f3f4f6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.85rem",
  fontWeight: 650,
  color: "#6b7280",
  flexShrink: 0,
  marginTop: 2,
};

const itemImage: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 8,
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  flexShrink: 0,
  overflow: "hidden",
};

const itemTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 650,
  color: "#111827",
  lineHeight: 1.3,
};

const itemTime: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#6b7280",
  fontWeight: 500,
  marginBottom: "0.3rem",
};

const itemLocation: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.3rem",
  fontSize: "0.85rem",
  color: "#6b7280",
};

// IMPROVED SIDEBAR STYLES
const daySidebar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  padding: "1.5rem 0.75rem",
  background: "white",
  borderLeft: "1px solid #e5e7eb",
  height: "calc(100vh - 230px)",
  overflowY: "auto",
};

const sidebarTitle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  marginBottom: "1rem",
  color: "#111827",
  paddingLeft: "0.5rem",
};

const dayButton: React.CSSProperties = {
  width: "100%",
  padding: "1rem 0.75rem",
  marginBottom: "0.75rem",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "white",
  cursor: "pointer",
  textAlign: "left",
  transition: "all 0.2s ease",
};

const activeDayButton: React.CSSProperties = {
  background: "#f3f4f6",
  borderColor: "#6366f1",
  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.15)",
};

const dayOfWeekStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "0.95rem",
  color: "#111827",
  lineHeight: 1.3,
};

const dayDateStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#6b7280",
  marginTop: "0.15rem",
};

const dayMetaStyle: React.CSSProperties = {
  borderTop: "1px solid #f3f4f6",
  paddingTop: "0.75rem",
  marginTop: "0.75rem",
};

const dayIndexStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "#6b7280",
  marginBottom: "0.3rem",
};

const stopsCountStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#9ca3af",
  marginBottom: "0.15rem",
};

const timeStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#9ca3af",
};

const emptyTabContent: React.CSSProperties = {
  textAlign: "center",
  padding: "4rem 2rem",
  color: "#9ca3af",
};

const emptyIcon: React.CSSProperties = {
  display: "inline-block",
  marginBottom: "1rem",
  opacity: 0.5,
  color: "#6b7280",
};

const emptyTitle: React.CSSProperties = {
  margin: "0 0 0.5rem 0",
  fontSize: "1.2rem",
  fontWeight: 600,
  color: "#6b7280",
};

const emptyText: React.CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  color: "#9ca3af",
};
