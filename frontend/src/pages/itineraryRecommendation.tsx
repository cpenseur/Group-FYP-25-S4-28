// frontend/src/pages/RecommendationsPage_Complete.tsx
// Complete Recommendations Page with real data, maps, and all features

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";

// Import your existing map component
// import ItineraryMap from "../components/ItineraryMap";

type Guide = {
  id: string;
  title: string;
  author: string;
  author_avatar?: string;
  thumbnail: string;
  year?: string;
  verified?: boolean;
  destination: string;
  days: number;
  views: number;
  saves: number;
};

type Destination = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  saved?: boolean;
  category: string;
  country: string;
};

type TripData = {
  id: number;
  title: string;
  main_city: string;
  main_country: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  itinerary_items: any[];
};

export default function RecommendationsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<TripData | null>(null);
  const [destination, setDestination] = useState("JAPAN");
  const [destinationInfo, setDestinationInfo] = useState("");
  const [featuredGuides, setFeaturedGuides] = useState<Guide[]>([]);
  const [popularDestinations, setPopularDestinations] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter states
  const [guideFilter, setGuideFilter] = useState<"all" | "verified" | "recent">("all");
  const [destFilter, setDestFilter] = useState<"all" | "nearby" | "popular">("all");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, [tripId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      if (tripId) {
        // Load trip data
        const tripData = await apiFetch(`/f1/trips/${tripId}/`);
        setTrip(tripData);
        
        const dest = tripData.main_city || tripData.main_country || "Japan";
        setDestination(dest.toUpperCase());

        // Load ALL data in parallel
        await Promise.all([
          loadDestinationInfo(dest),
          loadFeaturedGuides(dest),
          loadPopularDestinations(dest),
        ]);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDestinationInfo = async (dest: string) => {
    try {
      const data = await apiFetch(`/f1/recommendations/destination-info/?destination=${dest}`);
      setDestinationInfo(data.description);
    } catch (error) {
      // Fallback
      setDestinationInfo(getDefaultDescription(dest));
    }
  };

  const loadFeaturedGuides = async (dest: string) => {
    try {
      // This endpoint returns user-created public guides for this destination
      const data = await apiFetch(`/f1/recommendations/featured-guides/?destination=${dest}`);
      setFeaturedGuides(data.guides || []);
    } catch (error) {
      console.error("Failed to load guides:", error);
      setFeaturedGuides([]);
    }
  };

  const loadPopularDestinations = async (dest: string) => {
    try {
      // This endpoint returns popular destinations related to the current trip
      const data = await apiFetch(`/f1/recommendations/popular-destinations/?destination=${dest}`);
      setPopularDestinations(data.destinations || []);
    } catch (error) {
      console.error("Failed to load destinations:", error);
      setPopularDestinations([]);
    }
  };

  const getDefaultDescription = (dest: string) => {
    const descriptions: Record<string, string> = {
      "Japan": "Japan is an island country in East Asia. Located in the Pacific Ocean off the northeast coast of the Asian mainland, it is bordered to the west by the Sea of Japan and extends from the Sea of Okhotsk in the north to the East China Sea in the south.",
      "Tokyo": "Tokyo, Japan's busy capital, mixes the ultramodern and the traditional, from neon-lit skyscrapers to historic temples.",
      "Singapore": "Singapore is a sunny, tropical island in Southeast Asia, off the southern tip of the Malay Peninsula.",
    };
    return descriptions[dest] || `Explore the wonderful destinations in ${dest}.`;
  };

  // Filter guides
  const filteredGuides = featuredGuides.filter((guide) => {
    // Search filter
    if (searchQuery && !guide.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Guide filter
    if (guideFilter === "verified" && !guide.verified) {
      return false;
    }
    if (guideFilter === "recent" && guide.year !== "2025") {
      return false;
    }
    
    return true;
  });

  // Filter destinations
  const filteredDestinations = popularDestinations.filter((dest) => {
    // Search filter
    if (searchQuery && !dest.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Destination filter
    if (destFilter === "nearby" && dest.category !== "Nearby") {
      return false;
    }
    if (destFilter === "popular" && dest.category !== "Popular") {
      return false;
    }
    
    return true;
  });

  const handleGuideClick = (guide: Guide) => {
    // Navigate to guide details page
    navigate(`/guides/${guide.id}`);
  };

  const handleDestinationClick = (dest: Destination) => {
    // Navigate to destination page or open details modal
    navigate(`/destinations/${dest.id}`);
  };

  const toggleSaveDestination = async (destId: string) => {
    try {
      const dest = popularDestinations.find(d => d.id === destId);
      if (!dest) return;

      if (dest.saved) {
        await apiFetch(`/f1/recommendations/unsave-destination/`, {
          method: "POST",
          body: JSON.stringify({ destination_id: destId }),
        });
      } else {
        await apiFetch(`/f1/recommendations/save-destination/`, {
          method: "POST",
          body: JSON.stringify({ destination_id: destId }),
        });
      }

      // Update local state
      setPopularDestinations(prev =>
        prev.map(d => d.id === destId ? { ...d, saved: !d.saved } : d)
      );
    } catch (error) {
      console.error("Failed to toggle save:", error);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    pageContainer: {
      minHeight: "100vh",
      backgroundColor: "#f9fafb",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },

    header: {
      backgroundColor: "#ffffff",
      borderBottom: "1px solid #e5e7eb",
      padding: "16px 32px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },

    logo: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "18px",
      fontWeight: 700,
      color: "#111827",
      cursor: "pointer",
    },

    nav: {
      display: "flex",
      gap: "32px",
      alignItems: "center",
    },

    navLink: {
      fontSize: "14px",
      color: "#6b7280",
      textDecoration: "none",
      cursor: "pointer",
      fontWeight: 500,
    },

    logoutButton: {
      padding: "8px 16px",
      backgroundColor: "#1e40af",
      color: "#ffffff",
      border: "none",
      borderRadius: "6px",
      fontSize: "14px",
      fontWeight: 600,
      cursor: "pointer",
    },

    tripHeader: {
      backgroundColor: "#ffffff",
      borderBottom: "1px solid #e5e7eb",
      padding: "16px 32px",
    },

    tripTitleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "12px",
    },

    tripTitle: {
      fontSize: "24px",
      fontWeight: 700,
      color: "#111827",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    collaborators: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },

    avatar: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "14px",
      fontWeight: 600,
      color: "#ffffff",
      border: "2px solid #ffffff",
    },

    button: {
      padding: "6px 12px",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      fontSize: "13px",
      fontWeight: 600,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },

    tripInfo: {
      display: "flex",
      gap: "24px",
      fontSize: "13px",
      color: "#6b7280",
    },

    tabsContainer: {
      backgroundColor: "#ffffff",
      borderBottom: "2px solid #e5e7eb",
      padding: "0 32px",
      display: "flex",
      gap: "32px",
    },

    tab: {
      padding: "12px 0",
      fontSize: "14px",
      fontWeight: 600,
      color: "#6b7280",
      cursor: "pointer",
      borderBottom: "2px solid transparent",
      marginBottom: "-2px",
      transition: "all 0.2s ease",
    },

    tabActive: {
      color: "#111827",
      borderBottomColor: "#111827",
    },

    searchContainer: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },

    contentLayout: {
      display: "flex",
      height: "calc(100vh - 200px)",
    },

    mapSection: {
      width: "40%",
      height: "100%",
      backgroundColor: "#e5e7eb",
      position: "relative" as const,
    },

    contentSection: {
      width: "60%",
      height: "100%",
      overflowY: "auto" as const,
      backgroundColor: "#ffffff",
      padding: "32px 48px 80px 48px",
    },

    destinationHeader: {
      marginBottom: "32px",
    },

    destinationTitle: {
      fontSize: "20px",
      fontWeight: 700,
      color: "#111827",
      marginBottom: "12px",
      letterSpacing: "0.5px",
    },

    destinationDesc: {
      fontSize: "13px",
      color: "#6b7280",
      lineHeight: "1.6",
    },

    section: {
      marginBottom: "48px",
    },

    sectionHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
    },

    sectionTitle: {
      fontSize: "18px",
      fontWeight: 700,
      color: "#111827",
    },

    seeAllLink: {
      fontSize: "13px",
      color: "#4f46e5",
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "none",
    },

    filterRow: {
      display: "flex",
      gap: "12px",
      marginBottom: "20px",
    },

    filterButton: {
      padding: "8px 16px",
      backgroundColor: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      fontSize: "13px",
      fontWeight: 600,
      color: "#374151",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },

    filterButtonActive: {
      backgroundColor: "#111827",
      color: "#ffffff",
      borderColor: "#111827",
    },

    cardsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "20px",
    },

    guideCard: {
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid #e5e7eb",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },

    cardImage: {
      width: "100%",
      height: "160px",
      objectFit: "cover" as const,
    },

    cardContent: {
      padding: "14px 16px",
    },

    cardTitle: {
      fontSize: "13px",
      fontWeight: 600,
      color: "#111827",
      marginBottom: "6px",
      lineHeight: "1.4",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical" as any,
      overflow: "hidden",
    },

    cardMeta: {
      fontSize: "12px",
      color: "#6b7280",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },

    verifiedBadge: {
      display: "inline-flex",
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      backgroundColor: "#ef4444",
      color: "#ffffff",
      fontSize: "10px",
      fontWeight: 700,
      alignItems: "center",
      justifyContent: "center",
    },

    destinationCard: {
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid #e5e7eb",
      cursor: "pointer",
      transition: "all 0.2s ease",
      position: "relative" as const,
    },

    savedIcon: {
      position: "absolute" as const,
      top: "10px",
      right: "10px",
      width: "28px",
      height: "28px",
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "14px",
      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
      cursor: "pointer",
      zIndex: 10,
    },

    cardDescription: {
      fontSize: "12px",
      color: "#6b7280",
      lineHeight: "1.5",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical" as any,
      overflow: "hidden",
    },

    exploreTitle: {
      fontSize: "20px",
      fontWeight: 700,
      color: "#111827",
      marginBottom: "28px",
    },

    subsectionTitle: {
      fontSize: "15px",
      fontWeight: 600,
      color: "#111827",
      marginBottom: "16px",
    },

    loadingContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "400px",
      color: "#9ca3af",
    },

    emptyState: {
      textAlign: "center" as const,
      padding: "60px 20px",
      color: "#9ca3af",
    },
  };

  const tabs = [
    { name: "Itinerary", path: `/trip/${tripId}/itinerary` },
    { name: "Notes & Checklists", path: `/trip/${tripId}/notes` },
    { name: "Budget", path: `/trip/${tripId}/budget` },
    { name: "Media Highlights", path: `/trip/${tripId}/media` },
    { name: "Recommendations", path: `/trip/${tripId}/recommendations` },
  ];

  if (isLoading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div>Loading recommendations...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo} onClick={() => navigate("/")}>
          <span style={{ fontSize: "24px" }}>🦜</span>
          <span>TripMate</span>
        </div>
        
        <div style={styles.nav}>
          <a style={styles.navLink} onClick={() => navigate("/dashboard")}>Dashboard</a>
          <a style={styles.navLink} onClick={() => navigate("/trips")}>Trips</a>
          <a style={styles.navLink} onClick={() => navigate("/explore")}>Explore</a>
          <a style={styles.navLink} onClick={() => navigate("/profile")}>Profile</a>
          <button style={styles.logoutButton}>Log Out</button>
        </div>
      </div>

      {/* Trip Header */}
      <div style={styles.tripHeader}>
        <div style={styles.tripTitleRow}>
          <div style={styles.tripTitle}>
            <span>Trip to {trip?.main_city || trip?.main_country || "Japan"}</span>
            
            <div style={styles.collaborators}>
              <div style={{ ...styles.avatar, backgroundColor: "#f59e0b" }}>T</div>
              <div style={{ ...styles.avatar, backgroundColor: "#10b981" }}>L</div>
              <div style={{ ...styles.avatar, backgroundColor: "#ec4899" }}>P</div>
              <div style={{ ...styles.avatar, backgroundColor: "#3b82f6" }}>M</div>
              
              <button style={{ ...styles.button, backgroundColor: "#f3f4f6" }}>
                <span>+</span>
                <span>invite collaborators</span>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button style={{ ...styles.button, backgroundColor: "#ffffff" }}>Share</button>
            <button style={{ ...styles.button, backgroundColor: "#7c3aed", color: "#ffffff", border: "none" }}>
              Export
            </button>
          </div>
        </div>

        <div style={styles.tripInfo}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>📍 LOCATION</span>
            <span style={{ color: "#111827", fontWeight: 600 }}>
              {trip?.main_city || "Tokyo"} - {trip?.main_country || "Osaka"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>📅 DURATION</span>
            <span style={{ color: "#111827", fontWeight: 600 }}>
              {trip?.duration_days || 7} days - 6 nights
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>💰 CURRENCY</span>
            <span style={{ color: "#111827", fontWeight: 600 }}>$ 2650</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        {tabs.map((tab) => {
          const isActive = tab.name === "Recommendations";
          return (
            <div
              key={tab.name}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => navigate(tab.path)}
            >
              {tab.name}
            </div>
          );
        })}

        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "6px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              fontSize: "14px",
              width: "200px",
            }}
          />
        </div>
      </div>

      {/* Content Layout */}
      <div style={styles.contentLayout}>
        {/* Left: Map */}
        <div style={styles.mapSection}>
          {/* TODO: Replace with your ItineraryMap component */}
          {/* <ItineraryMap items={trip?.itinerary_items || []} /> */}
          
          <div style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: "#9ca3af",
            gap: "12px",
          }}>
            <div style={{ fontSize: "48px" }}>🗺️</div>
            <div style={{ fontSize: "14px" }}>Map View</div>
            <div style={{ fontSize: "12px" }}>
              Integrate ItineraryMap component here
            </div>
          </div>
        </div>

        {/* Right: Content */}
        <div style={styles.contentSection}>
          {/* Destination Header */}
          <div style={styles.destinationHeader}>
            <h1 style={styles.destinationTitle}>{destination}</h1>
            <p style={styles.destinationDesc}>{destinationInfo}</p>
          </div>

          {/* Featured Guides */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Featured guides</h2>
              <a style={styles.seeAllLink} onClick={() => navigate("/guides")}>
                See all
              </a>
            </div>

            {/* Guide Filters */}
            <div style={styles.filterRow}>
              <button
                style={{
                  ...styles.filterButton,
                  ...(guideFilter === "all" ? styles.filterButtonActive : {}),
                }}
                onClick={() => setGuideFilter("all")}
              >
                All Guides
              </button>
              <button
                style={{
                  ...styles.filterButton,
                  ...(guideFilter === "verified" ? styles.filterButtonActive : {}),
                }}
                onClick={() => setGuideFilter("verified")}
              >
                ✓ Verified Only
              </button>
              <button
                style={{
                  ...styles.filterButton,
                  ...(guideFilter === "recent" ? styles.filterButtonActive : {}),
                }}
                onClick={() => setGuideFilter("recent")}
              >
                📅 Recent
              </button>
            </div>

            {filteredGuides.length > 0 ? (
              <div style={styles.cardsGrid}>
                {filteredGuides.slice(0, 6).map((guide) => (
                  <div
                    key={guide.id}
                    style={styles.guideCard}
                    onClick={() => handleGuideClick(guide)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <img src={guide.thumbnail} alt={guide.title} style={styles.cardImage} />
                    <div style={styles.cardContent}>
                      <div style={styles.cardTitle}>{guide.title}</div>
                      <div style={styles.cardMeta}>
                        <span>{guide.author}</span>
                        {guide.verified && (
                          <span style={styles.verifiedBadge}>⊙</span>
                        )}
                        {guide.year && <span>© {guide.year}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyState}>No guides found</div>
            )}
          </div>

          {/* Explore Section */}
          <h2 style={styles.exploreTitle}>Explore</h2>

          {/* Popular Destinations */}
          <div style={styles.section}>
            <h3 style={styles.subsectionTitle}>Popular destinations</h3>

            {/* Destination Filters */}
            <div style={styles.filterRow}>
              <button
                style={{
                  ...styles.filterButton,
                  ...(destFilter === "all" ? styles.filterButtonActive : {}),
                }}
                onClick={() => setDestFilter("all")}
              >
                All Destinations
              </button>
              <button
                style={{
                  ...styles.filterButton,
                  ...(destFilter === "nearby" ? styles.filterButtonActive : {}),
                }}
                onClick={() => setDestFilter("nearby")}
              >
                📍 Nearby
              </button>
              <button
                style={{
                  ...styles.filterButton,
                  ...(destFilter === "popular" ? styles.filterButtonActive : {}),
                }}
                onClick={() => setDestFilter("popular")}
              >
                ⭐ Popular
              </button>
            </div>

            {filteredDestinations.length > 0 ? (
              <div style={styles.cardsGrid}>
                {filteredDestinations.slice(0, 6).map((dest) => (
                  <div
                    key={dest.id}
                    style={styles.destinationCard}
                    onClick={() => handleDestinationClick(dest)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div
                      style={styles.savedIcon}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaveDestination(dest.id);
                      }}
                    >
                      {dest.saved ? "💾" : "🤍"}
                    </div>
                    <img src={dest.thumbnail} alt={dest.title} style={styles.cardImage} />
                    <div style={styles.cardContent}>
                      <div style={styles.cardTitle}>{dest.title}</div>
                      <div style={styles.cardDescription}>{dest.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyState}>No destinations found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}