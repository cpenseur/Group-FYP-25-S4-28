import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTripId } from "../hooks/useDecodedParams";
import { apiFetch } from "../lib/apiClient";
import {
  ShoppingBag,
  Mountain,
  Leaf,
  Landmark,
  Utensils,
  Camera,
  Waves,
  Snowflake,
  TreePine,
  Building2,
  Plane,
} from "lucide-react";

/* ================= TYPES ================= */

type GroupPreference = {
  username: string;
  preferences: string[];
  isOwner?: boolean;
};

type ItineraryItem = {
  time: string;
  title: string;
  location: string;
  type: string;
  start_time?: string | null;
  end_time?: string | null;
};

type DayItinerary = {
  day: number;
  date: string;
  items: ItineraryItem[];
};

/* ================= HELPERS ================= */

function formatDDMon(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatTime(datetimeStr: string | null | undefined): string {
  if (!datetimeStr) return "—";
  
  try {
    const match = datetimeStr.match(/T(\d{2}:\d{2})/);
    if (match) {
      return match[1];
    }
    return "—";
  } catch (error) {
    console.error("Error formatting time:", error);
    return "—";
  }
}

function getTypeEmoji(itemType: string): string {
  const emojis: Record<string, string> = {
    meal: "🍽️",
    transport: "🚆",
    activity: "🎯",
    sightseeing: "📸",
    food: "🍽️",
  };
  return emojis[itemType?.toLowerCase()] || "📍";
}

/**
 * 🌍 Fetch country/city image from Wikimedia API
 * Uses Wikipedia's REST API to get high-quality images
 */
async function fetchImageFromWikimedia(locationName: string): Promise<string | null> {
  try {
    // Clean and encode location name
    const cleanName = locationName.trim().replace(/ /g, '_');
    const encodedName = encodeURIComponent(cleanName);
    
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedName}`;
    
    console.log(`🔍 Fetching Wikimedia image for: ${locationName}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`⚠️ Wikimedia API returned ${response.status} for ${locationName}`);
      return null;
    }
    
    const data = await response.json();
    
    // Prefer original image for quality, fallback to thumbnail
    const imageUrl = data.originalimage?.source || data.thumbnail?.source;
    
    if (imageUrl) {
      console.log(`✅ Found Wikimedia image for ${locationName}:`, imageUrl);
      return imageUrl;
    }
    
    console.log(`⚠️ No image in Wikimedia response for ${locationName}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching Wikimedia image for ${locationName}:`, error);
    return null;
  }
}

/**
 * 🌍 Get destination image with fallback strategy
 * 1. Try Wikimedia API for country
 * 2. If city provided, try Wikimedia for city
 * 3. Use generic fallback image
 */
async function getDestinationImage(destination: string): Promise<string> {
  console.log("🖼️ Getting image for destination:", destination);

  // Handle empty/default destination
  if (!destination || destination.trim() === "" || destination === "Your Dream Destination") {
    console.log("⚠️ Using default travel image");
    return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=900&fit=crop";
  }

  // Extract country and city from "City, Country" format
  let countryName = destination.trim();
  let cityName = "";
  
  if (destination.includes(',')) {
    const parts = destination.split(',').map(s => s.trim());
    cityName = parts[0];
    countryName = parts[parts.length - 1];
    console.log(`📍 Parsed: City="${cityName}", Country="${countryName}"`);
  }

  // Try to get country image first (more reliable)
  if (countryName) {
    const countryImage = await fetchImageFromWikimedia(countryName);
    if (countryImage) {
      return countryImage;
    }
  }

  // If country failed and we have a city, try city image
  if (cityName) {
    const cityImage = await fetchImageFromWikimedia(cityName);
    if (cityImage) {
      return cityImage;
    }
  }

  // Final fallback: generic travel image
  console.log(`🔄 No image found for "${destination}", using fallback`);
  return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=900&fit=crop";
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function getKeywordVisual(keyword: string) {
  const map: Record<string, { Icon: React.ElementType; emoji: string }> = {
    "Luxury/Shopping": { Icon: ShoppingBag, emoji: "🛍️" },
    Adventure: { Icon: Mountain, emoji: "🧗" },
    Wellness: { Icon: Leaf, emoji: "🌿" },
    "Cultural Immersion": { Icon: Landmark, emoji: "🏛️" },
    Culinary: { Icon: Utensils, emoji: "🍜" },
    Sightseeing: { Icon: Camera, emoji: "📸" },
    Tropical: { Icon: Waves, emoji: "🌴" },
    Mountains: { Icon: Mountain, emoji: "⛰️" },
    "Cold/Winter": { Icon: Snowflake, emoji: "❄️" },
    Countryside: { Icon: TreePine, emoji: "🌾" },
    Urban: { Icon: Building2, emoji: "🏙️" },
  };

  return map[keyword] || { Icon: Camera, emoji: "✨" };
}

/* ================= COMPONENT ================= */

export default function GroupItinerarySummary() {
  const navigate = useNavigate();
  const tripId = useTripId();

  const [tripDays, setTripDays] = useState(3);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [groupPreferences, setGroupPreferences] = useState<GroupPreference[]>([]);
  const [destination, setDestination] = useState("Your Dream Destination");
  const [destinationImage, setDestinationImage] = useState<string>(
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=900&fit=crop"
  );

  const ownerUsername = useMemo(
    () => groupPreferences.find((u) => u.isOwner)?.username ?? groupPreferences[0]?.username ?? "owner",
    [groupPreferences]
  );

  const [itinerary, setItinerary] = useState<DayItinerary[]>([]);
  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const seeded = useRef<number>(Math.floor(Math.random() * 1e9));
  const userExpandedDayRef = useRef<number | null>(null);

  // Stars animation
  const stars = useMemo(() => {
    return Array.from({ length: 90 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 2.2 + 0.9,
      delay: Math.random() * 8,
      duration: Math.random() * 6 + 6,
    }));
  }, []);

  // Flight paths animation
  const flights = useMemo(
    () => [
      {
        id: "f1",
        d: "M -200 160 C 120 40, 420 40, 820 160 S 1380 300, 1900 130",
        top: "16%",
        height: 220,
        dur: 14,
        delay: 1,
        size: 20,
      },
      {
        id: "f2",
        d: "M -260 150 C 120 260, 520 40, 900 150 S 1500 260, 2000 120",
        top: "68%",
        height: 210,
        dur: 19,
        delay: 7,
        size: 19,
      },
    ],
    []
  );

  // Floaters animation
  const floaters = useMemo(() => {
    const seed = seeded.current;
    const keywords = groupPreferences.flatMap(p => p.preferences).slice(0, 20);

    function rand(i: number) {
      const x = Math.sin(seed + i * 999) * 10000;
      return x - Math.floor(x);
    }

    return keywords.map((k, i) => {
      const top = rand(i) * 70 + 12;
      const baseStagger = (i % 10) * 0.55;
      const jitter = rand(i + 7) * 0.25;
      const delay = baseStagger + jitter;
      const duration = clamp(12 + rand(i + 13) * 10, 12, 20);
      const scale = clamp(0.9 + rand(i + 23) * 0.55, 0.9, 1.45);
      const opacity = clamp(0.55 + rand(i + 31) * 0.35, 0.55, 0.9);
      const { Icon, emoji } = getKeywordVisual(k);
      const direction: "leftToRight" | "rightToLeft" = i % 2 === 0 ? "leftToRight" : "rightToLeft";

      return {
        k,
        i,
        top,
        delay,
        duration,
        scale,
        opacity,
        Icon,
        emoji,
        direction,
      };
    });
  }, [groupPreferences]);

  const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const removeUser = (username: string) => {
    if (username === ownerUsername) return;
    setGroupPreferences((prev) => prev.filter((u) => u.username !== username));
  };

  /* ================= LOAD TRIP DATA ================= */

  const loadTripData = async (preserveExpandedDay = false) => {
    if (!tripId) {
      setErrorMsg("No trip ID found in URL");
      setIsLoading(false);
      return;
    }

    try {
      if (!preserveExpandedDay) {
        setIsLoading(true);
      }

      const tripData = await apiFetch(`/f1/trips/${tripId}/`, { 
        method: "GET" 
      });

      console.log("📦 Trip data received:", {
        main_city: tripData.main_city,
        main_country: tripData.main_country,
      });

      if (tripData.start_date) {
        setStartDate(new Date(tripData.start_date));
      }
      
      if (tripData.days) {
        setTripDays(tripData.days.length);
      }

      // Set destination and fetch image from Wikimedia
      if (tripData.main_city || tripData.main_country) {
        const dest = tripData.main_city || tripData.main_country || "Your Dream Destination";
        console.log("🎯 Setting destination to:", dest);
        setDestination(dest);
        
        // Fetch image asynchronously from Wikimedia
        getDestinationImage(dest).then(imageUrl => {
          console.log("🖼️ Setting destination image:", imageUrl);
          setDestinationImage(imageUrl);
        });
      }

      if (tripData.days && tripData.items) {
        const convertedDays: DayItinerary[] = tripData.days
          .sort((a: any, b: any) => a.day_index - b.day_index)
          .map((day: any) => {
            const dayItems = tripData.items
              .filter((item: any) => item.day === day.id)
              .sort((a: any, b: any) => a.sort_order - b.sort_order)
              .map((item: any) => ({
                time: formatTime(item.start_time),
                start_time: item.start_time,
                end_time: item.end_time,
                title: item.title || "Unnamed activity",
                location: item.address || "Location not specified",
                type: item.item_type || "activity",
              }));

            return {
              day: day.day_index,
              date: day.date ? formatDDMon(new Date(day.date)) : `Day ${day.day_index}`,
              items: dayItems,
            };
          });

        setItinerary(convertedDays);
        
        if (!preserveExpandedDay) {
          const firstDayWithItems = convertedDays.find(d => d.items.length > 0);
          if (firstDayWithItems) {
            setExpandedDay(firstDayWithItems.day);
            userExpandedDayRef.current = firstDayWithItems.day;
          }
        } else if (userExpandedDayRef.current !== null) {
          setExpandedDay(userExpandedDayRef.current);
        }
      }

      setErrorMsg("");
    } catch (err: any) {
      console.error("❌ Failed to load trip data:", err);
      if (!preserveExpandedDay) {
        setErrorMsg("Failed to load trip data.");
      }
    } finally {
      if (!preserveExpandedDay) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadTripData(false);
  }, [tripId]);

  /* ================= POLLING ================= */

  useEffect(() => {
    if (!tripId || isLoading) return;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    let pollCount = 0;
    const maxPolls = 36;

    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      
      if (pollCount > maxPolls) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      try {
        const tripData = await apiFetch(`/f1/trips/${tripId}/`, {
          method: "GET",
        });

        if (tripData.travel_type === "group_generating") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          navigate(`/group-ai-wait/${tripId}`);
          return;
        }

        if (tripData.items) {
          const currentItemCount = itinerary.reduce((sum, d) => sum + d.items.length, 0);
          const newItemCount = tripData.items.length;

          if (currentItemCount > 0 && currentItemCount !== newItemCount) {
            await loadTripData(true);
            pollCount = 0;
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 10000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [tripId, isLoading, navigate, itinerary]);

  /* ================= LOAD GROUP PREFERENCES ================= */

  useEffect(() => {
    const fetchGroupPreferences = async () => {
      if (!tripId) return;

      try {
        const data = await apiFetch(`/f2/trips/${tripId}/preferences/`, { 
          method: "GET" 
        });

        if (Array.isArray(data) && data.length) {
          setGroupPreferences(
            data.map((u: any) => {
              let displayPrefs: string[] = [];
              
              if (u.preferences) {
                if (typeof u.preferences === 'object' && !Array.isArray(u.preferences)) {
                  const prefs = u.preferences;
                  
                  if (prefs.country) {
                    displayPrefs.push(prefs.country);
                  }
                  
                  if (Array.isArray(prefs.activities)) {
                    displayPrefs.push(...prefs.activities);
                  }
                  
                  if (Array.isArray(prefs.destination_types)) {
                    displayPrefs.push(...prefs.destination_types);
                  }
                } 
                else if (Array.isArray(u.preferences)) {
                  displayPrefs = u.preferences;
                }
              }
              
              return {
                username: u.username,
                preferences: displayPrefs,
                isOwner: u.is_owner,
              };
            })
          );
        } else {
          setGroupPreferences([
            { username: "You", preferences: ["Adventure", "Cultural Immersion"], isOwner: true },
          ]);
        }
      } catch (err) {
        console.error("Failed to load group preferences", err);
        setGroupPreferences([
          { username: "You", preferences: ["Adventure", "Cultural Immersion"], isOwner: true },
        ]);
      }
    };

    fetchGroupPreferences();
  }, [tripId]);

  /* ================= AI REGENERATION ================= */

  const generateAnotherPlan = () => {
    if (!tripId) return;
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    navigate(`/group-ai-wait/${tripId}`);
  };

  /* ================= ADD CSS ANIMATIONS ================= */

  React.useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes fadeInUp {
        from { 
          opacity: 0; 
          transform: translateY(30px);
        }
        to { 
          opacity: 1; 
          transform: translateY(0);
        }
      }

      @keyframes flyUp {
        0% { 
          opacity: 0; 
          transform: translateY(50px) scale(0.95);
        }
        100% { 
          opacity: 1; 
          transform: translateY(0) scale(1);
        }
      }

      @keyframes slideDown {
        from { 
          opacity: 0; 
          max-height: 0; 
        }
        to { 
          opacity: 1; 
          max-height: 2000px; 
        }
      }

      @keyframes shimmer {
        0% { background-position: -1000px 0; }
        100% { background-position: 1000px 0; }
      }

      @keyframes glow {
        0%, 100% { 
          box-shadow: 0 0 25px rgba(139, 92, 246, 0.3),
                      0 0 50px rgba(139, 92, 246, 0.15),
                      0 10px 40px rgba(0, 0, 0, 0.1);
        }
        50% { 
          box-shadow: 0 0 35px rgba(139, 92, 246, 0.5),
                      0 0 70px rgba(139, 92, 246, 0.25),
                      0 15px 50px rgba(0, 0, 0, 0.15);
        }
      }

      @keyframes borderGlow {
        0%, 100% { 
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.2);
        }
        50% { 
          border-color: rgba(139, 92, 246, 0.8);
          box-shadow: 0 0 25px rgba(139, 92, 246, 0.4);
        }
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.03); }
      }

      @keyframes tmAurora {
        0%   { transform: translateY(0) scale(1); opacity: 0.85; }
        50%  { transform: translateY(-40px) scale(1.06); opacity: 1; }
        100% { transform: translateY(20px) scale(1); opacity: 0.9; }
      }

      @keyframes tmMist {
        0%   { transform: translateX(-10%); }
        100% { transform: translateX(10%); }
      }

      @keyframes tmTwinkle {
        0%, 100% { opacity: 0.15; transform: scale(0.95); }
        50%      { opacity: 0.95; transform: scale(1.15); }
      }

      @keyframes tmRouteDash {
        0%   { stroke-dashoffset: 0; opacity: 0; }
        15%  { opacity: 0.55; }
        60%  { opacity: 0.25; }
        100% { stroke-dashoffset: -380; opacity: 0; }
      }

      @keyframes tmPlaneAlong {
        0%   { offset-distance: 0%; opacity: 0; }
        8%   { opacity: 0.95; }
        90%  { opacity: 0.2; }
        100% { offset-distance: 100%; opacity: 0; }
      }

      @keyframes tmGlowPulse {
        0%, 100% { box-shadow: 0 10px 28px rgba(0,0,0,0.22), 0 0 22px rgba(255,255,255,0.18); }
        50%      { box-shadow: 0 12px 32px rgba(0,0,0,0.25), 0 0 34px rgba(255,255,255,0.30); }
      }

      @keyframes tmDriftLTR {
        0%   { transform: translateX(-25vw); }
        100% { transform: translateX(125vw); }
      }

      @keyframes tmDriftRTL {
        0%   { transform: translateX(125vw); }
        100% { transform: translateX(-25vw); }
      }

      @keyframes tmFloat {
        0%   { transform: translateY(0px) rotate(-1.2deg); }
        50%  { transform: translateY(-3px) rotate(1.2deg); }
        100% { transform: translateY(0px) rotate(-1.2deg); }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  /* ================= CALCULATE STATS ================= */

  const totalActivities = itinerary.reduce((sum, day) => sum + day.items.length, 0);
  const aiMatchScore = Math.min(95, 75 + groupPreferences.length * 5);

  /* ================= STYLES ================= */

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% 45%, rgba(44, 24, 82, 0.35), rgba(19, 14, 36, 0.92) 68%), linear-gradient(180deg, #19112f 0%, #22163f 55%, #120c22 100%)",
      fontFamily: "Inter, sans-serif",
      paddingBottom: "80px",
      position: "relative",
      overflow: "hidden",
    },

    container: {
      width: "1200px",
      margin: "0 auto",
      padding: "60px 0",
      position: "relative",
      zIndex: 5,
    },

    aiBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      padding: "12px 24px",
      background: "rgba(246, 244, 255, 0.15)",
      border: "1px solid rgba(176, 165, 230, 0.35)",
      borderRadius: "999px",
      color: "#ffffff",
      fontSize: "15px",
      fontWeight: 700,
      backdropFilter: "blur(10px)",
      animation: "borderGlow 2s ease-in-out infinite",
      marginBottom: "24px",
      boxShadow: "0 4px 15px rgba(139, 92, 246, 0.2)",
    },

    heroSection: {
      position: "relative",
      width: "100%",
      height: "500px",
      borderRadius: "32px",
      overflow: "hidden",
      marginBottom: "40px",
      boxShadow: "0 25px 80px rgba(139, 92, 246, 0.25)",
      animation: "fadeInUp 0.8s ease, glow 3s ease-in-out infinite",
      border: "3px solid transparent",
      backgroundImage: "linear-gradient(white, white), linear-gradient(90deg, #a78bfa, #c084fc, #e879f9, #a78bfa)",
      backgroundOrigin: "border-box",
      backgroundClip: "padding-box, border-box",
    },

    heroImage: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },

    heroOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.5) 100%)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      padding: "50px",
    },

    heroTitle: {
      fontSize: "64px",
      fontWeight: 800,
      color: "#ffffff",
      marginBottom: "12px",
      textShadow: "0 4px 30px rgba(0, 0, 0, 0.5)",
      animation: "flyUp 1.2s ease 0.2s backwards",
    },

    heroSubtitle: {
      fontSize: "20px",
      color: "#ffffff",
      opacity: 0.95,
      textShadow: "0 2px 20px rgba(0,0,0,0.5)",
      animation: "fadeInUp 1s ease 0.4s backwards",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    statsBar: {
      display: "flex",
      gap: "24px",
      marginTop: "20px",
      animation: "fadeInUp 1s ease 0.6s backwards",
    },

    statItem: {
      background: "rgba(255, 255, 255, 0.2)",
      backdropFilter: "blur(10px)",
      padding: "12px 20px",
      borderRadius: "12px",
      border: "1px solid rgba(255, 255, 255, 0.3)",
    },

    statValue: {
      fontSize: "24px",
      fontWeight: 700,
      color: "#ffffff",
    },

    statLabel: {
      fontSize: "12px",
      color: "#ffffff",
      opacity: 0.9,
      marginTop: "2px",
    },

    card: {
      background: "rgba(246, 244, 255, 0.45)",
      backdropFilter: "blur(20px)",
      borderRadius: "24px",
      padding: "36px",
      border: "1px solid rgba(176, 165, 230, 0.35)",
      boxShadow: "0px 18px 50px rgba(0,0,0,0.15)",
      marginBottom: "28px",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      animation: "fadeInUp 0.6s ease backwards",
      position: "relative",
      overflow: "hidden",
    },

    cardGlow: {
      position: "absolute",
      top: 0,
      left: "-100%",
      width: "100%",
      height: "100%",
      background: "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.08), transparent)",
      animation: "shimmer 3s infinite",
      pointerEvents: "none",
    },

    sectionTitle: {
      fontSize: "28px",
      fontWeight: 700,
      marginBottom: "24px",
      color: "#1e1e2f",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    preferenceRow: {
      display: "flex",
      alignItems: "center",
      padding: "18px 24px",
      background: "rgba(246, 244, 255, 0.95)",
      borderRadius: "16px",
      marginBottom: "14px",
      justifyContent: "space-between",
      fontSize: "15px",
      transition: "all 0.3s ease",
      border: "1px solid rgba(139, 92, 246, 0.15)",
    },

    prefRight: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    removeBtn: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      border: "none",
      background: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      fontWeight: 600,
      transition: "all 0.2s ease",
    },

    itineraryHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "28px",
    },

    generateBtn: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "15px",
      fontWeight: 700,
      color: "#ffffff",
      cursor: "pointer",
      userSelect: "none",
      padding: "0",
      background: "transparent",
      borderRadius: "0",
      transition: "all 0.3s ease",
      boxShadow: "none",
      border: "none",
    },

    dayHeader: {
      background: "rgba(246, 244, 255, 0.95)",
      borderRadius: "18px",
      padding: "20px 28px",
      fontSize: "17px",
      fontWeight: 700,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer",
      marginBottom: "16px",
      border: "2px solid rgba(139, 92, 246, 0.2)",
      transition: "all 0.3s ease",
      color: "#1e1e2f",
    },

    expandButton: {
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      background: "linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(192, 132, 252, 0.2))",
      border: "2px solid rgba(139, 92, 246, 0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      fontWeight: 700,
      color: "#1e1e2f",
      transition: "all 0.3s ease",
    },

    row: {
      display: "flex",
      alignItems: "flex-start",
      gap: "24px",
      padding: "20px 24px",
      marginBottom: "10px",
      borderRadius: "14px",
      transition: "all 0.3s ease",
      border: "1px solid transparent",
    },

    time: {
      width: "90px",
      fontSize: "16px",
      fontWeight: 700,
      color: "#1e1e2f",
      flexShrink: 0,
    },

    itemTitle: {
      fontSize: "17px",
      fontWeight: 700,
      color: "#1e1b4b",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "6px",
    },

    itemSub: {
      fontSize: "14px",
      color: "#1e1e2f",
    },

    actionRow: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "20px",
      marginTop: "40px",
    },

    btnPrimary: {
      padding: "18px 48px",
      borderRadius: "999px",
      background: "linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)",
      color: "#ffffff",
      fontSize: "18px",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 8px 30px rgba(167, 139, 250, 0.4)",
      transition: "all 0.3s ease",
      border: "2px solid rgba(139, 92, 246, 0.4)",
      animation: "pulse 2s ease-in-out infinite",
    },

    magicBg: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      overflow: "hidden",
      pointerEvents: "none",
    },

    aurora: {
      position: "absolute",
      inset: "-20%",
      background: `
        radial-gradient(40% 30% at 20% 30%, rgba(124,92,255,0.25), transparent 60%),
        radial-gradient(35% 25% at 80% 40%, rgba(72,209,204,0.22), transparent 60%),
        radial-gradient(45% 35% at 50% 80%, rgba(255,182,193,0.18), transparent 60%)
      `,
      filter: "blur(60px)",
      animation: "tmAurora 22s ease-in-out infinite alternate",
    },

    mist: {
      position: "absolute",
      inset: "-10%",
      background:
        "linear-gradient(120deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02), rgba(255,255,255,0.12))",
      opacity: 0.35,
      filter: "blur(40px)",
      animation: "tmMist 30s linear infinite",
    },

    star: {
      position: "absolute",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.95)",
      boxShadow: "0 0 10px rgba(255,255,255,0.75), 0 0 26px rgba(255,255,255,0.35)",
      opacity: 0.85,
      mixBlendMode: "screen",
    },

    routeLayer: {
      position: "absolute",
      inset: 0,
      zIndex: 1,
      pointerEvents: "none",
    },

    routePath: {
      fill: "none",
      stroke: "rgba(255,255,255,0.6)",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeDasharray: "12 300",
      filter: "drop-shadow(0 0 6px rgba(255,255,255,0.35))",
    },

    plane: {
      position: "absolute",
      left: 0,
      top: 0,
      zIndex: 2,
      color: "rgba(255,255,255,0.92)",
      filter: "drop-shadow(0 0 10px rgba(255,255,255,0.55))",
      pointerEvents: "none",
      willChange: "offset-distance, transform",
    },

    floater: {
      position: "absolute",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 14px",
      borderRadius: "16px",
      background: "rgba(255,255,255,0.10)",
      border: "1px solid rgba(255,255,255,0.26)",
      boxShadow: "0 10px 28px rgba(0,0,0,0.22), 0 0 26px rgba(255,255,255,0.20)",
      backdropFilter: "blur(12px)",
      color: "rgba(255,255,255,0.92)",
      fontSize: "13px",
      whiteSpace: "nowrap",
      zIndex: 3,
      userSelect: "none",
      pointerEvents: "none",
    },

    floaterIconWrap: {
      width: "30px",
      height: "30px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.14)",
      border: "1px solid rgba(255,255,255,0.28)",
      boxShadow: "0 0 14px rgba(255,255,255,0.35)",
    },

    floaterText: {
      fontWeight: 650,
      letterSpacing: "0.1px",
      color: "rgba(255,255,255,0.92)",
    },

    loading: {
      textAlign: "center",
      padding: "80px",
      fontSize: "18px",
      color: "#ffffff",
      animation: "pulse 2s ease-in-out infinite",
    },
  };

  /* ================= RENDER ================= */

  if (isLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loading}>
            <div style={{ fontSize: "48px", marginBottom: "20px" }}>✨</div>
            <div>AI is crafting your perfect journey...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* BACKGROUND ANIMATIONS */}
      <div style={styles.magicBg}>
        <div style={styles.aurora} />
        <div style={styles.mist} />
        
        {/* Stars */}
        {stars.map((s) => (
          <div
            key={s.id}
            style={{
              ...styles.star,
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              animation: `tmTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}

        {/* Flight paths */}
        <div style={styles.routeLayer}>
          {flights.map((f) => (
            <svg 
              key={f.id} 
              viewBox={`0 0 1920 ${f.height}`} 
              style={{
                position: "absolute",
                left: 0,
                top: f.top,
                width: "100%",
                height: f.height,
                overflow: "visible",
                pointerEvents: "none",
              }}
            >
              <path
                d={f.d}
                style={{
                  ...styles.routePath,
                  animation: `tmRouteDash ${f.dur}s linear ${f.delay}s infinite`,
                }}
              />
              <Plane
                size={f.size}
                style={
                  {
                    ...styles.plane,
                    offsetPath: `path("${f.d}")`,
                    offsetRotate: "auto 45deg",
                    animation: `tmPlaneAlong ${f.dur}s linear ${f.delay}s infinite`,
                  } as React.CSSProperties
                }
              />
            </svg>
          ))}
        </div>

        {/* Floating keywords */}
        {floaters.map((f) => {
          const DriftAnim = f.direction === "leftToRight" ? "tmDriftLTR" : "tmDriftRTL";
          
          return (
            <div
              key={f.i}
              style={{
                ...styles.floater,
                top: `${f.top}%`,
                opacity: f.opacity,
                transform: `scale(${f.scale})`,
                animation: `${DriftAnim} ${f.duration}s linear ${f.delay}s infinite, tmGlowPulse 6s ease-in-out infinite`,
                left: f.direction === "leftToRight" ? "-25vw" : "auto",
                right: f.direction === "rightToLeft" ? "-25vw" : "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  animation: `tmFloat ${clamp(4 + (f.i % 5), 4, 8)}s ease-in-out ${f.delay}s infinite`,
                }}
              >
                <div style={styles.floaterIconWrap}>
                  <f.Icon size={18} />
                </div>
                <div style={styles.floaterText}>{f.k}</div>
                <div
                  style={{
                    fontSize: "16px",
                    opacity: 0.95,
                    filter: "drop-shadow(0 0 6px rgba(255,255,255,0.9))",
                  }}
                >
                  {f.emoji}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.container}>
        {/* AI BADGE */}
        <div style={styles.aiBadge}>
          <span style={{ fontSize: "20px" }}>✨</span>
          <span>AI-GENERATED ITINERARY</span>
        </div>

        {/* HERO SECTION */}
        <div style={styles.heroSection}>
          <img 
            src={destinationImage} 
            alt={destination}
            style={styles.heroImage}
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=900&fit=crop";
            }}
          />
          <div style={styles.heroOverlay}>
            <div style={styles.heroTitle}>{destination}</div>
            <div style={styles.heroSubtitle}>
              <span>🤖</span>
              <span>Personalized {tripDays}-day adventure powered by AI</span>
            </div>

            {/* STATS BAR */}
            <div style={styles.statsBar}>
              <div style={styles.statItem}>
                <div style={styles.statValue}>{tripDays}</div>
                <div style={styles.statLabel}>Days</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statValue}>{totalActivities}</div>
                <div style={styles.statLabel}>Activities</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statValue}>{aiMatchScore}%</div>
                <div style={styles.statLabel}>AI Match</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statValue}>{groupPreferences.length}</div>
                <div style={styles.statLabel}>Travelers</div>
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div style={{ 
            color: "#ef4444", 
            background: "rgba(239, 68, 68, 0.1)",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "20px",
            border: "1px solid rgba(239, 68, 68, 0.3)"
          }}>
            {errorMsg}
          </div>
        )}

        {/* GROUP PREFERENCES */}
        <div 
          style={{
            ...styles.card,
            animationDelay: "0.2s",
            ...(hoveredCard === 'preferences' ? { 
              transform: 'translateY(-8px) scale(1.02)', 
              boxShadow: '0 20px 60px rgba(139, 92, 246, 0.3)',
              borderColor: 'rgba(139, 92, 246, 0.5)',
            } : {})
          }}
          onMouseEnter={() => setHoveredCard('preferences')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={styles.cardGlow} />
          <div style={styles.sectionTitle}>
            <span>👥</span>
            Group Preferences
          </div>

          {groupPreferences.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "14px", padding: "10px" }}>
              No preferences loaded yet.
            </div>
          ) : (
            groupPreferences.map((p, idx) => (
              <div 
                key={p.username} 
                style={{
                  ...styles.preferenceRow,
                  animationDelay: `${0.3 + idx * 0.1}s`,
                  animation: "fadeInUp 0.5s ease backwards",
                  ...(hoveredCard === `pref-${p.username}` ? {
                    transform: 'translateX(8px) scale(1.02)',
                    background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(192, 132, 252, 0.15))',
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                  } : {})
                }}
                onMouseEnter={() => setHoveredCard(`pref-${p.username}`)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <strong style={{ fontSize: "16px", color: "#1e1e2f" }}>{p.username}</strong>

                <div style={styles.prefRight}>
                  <span style={{ color: "#1e1e2f" }}>{p.preferences.join(", ")}</span>

                  {p.username !== ownerUsername && (
                    <button
                      title="Remove user"
                      style={{
                        ...styles.removeBtn,
                        ...(hoveredCard === `remove-${p.username}` ? {
                          background: 'rgba(239, 68, 68, 0.3)',
                          transform: 'scale(1.15) rotate(90deg)',
                        } : {})
                      }}
                      onClick={() => removeUser(p.username)}
                      onMouseEnter={() => setHoveredCard(`remove-${p.username}`)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* DAILY ITINERARY */}
        <div 
          style={{
            ...styles.card,
            animationDelay: "0.4s",
            ...(hoveredCard === 'itinerary' ? { 
              transform: 'translateY(-8px) scale(1.02)', 
              boxShadow: '0 20px 60px rgba(139, 92, 246, 0.3)',
              borderColor: 'rgba(139, 92, 246, 0.5)',
            } : {})
          }}
          onMouseEnter={() => setHoveredCard('itinerary')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={styles.cardGlow} />
          <div style={styles.itineraryHeader}>
            <div style={styles.sectionTitle}>
              Your AI-Crafted Itinerary
            </div>

            <div
              style={{
                ...styles.generateBtn,
                ...(hoveredCard === 'generate' ? {
                  color: 'rgba(255, 255, 255, 0.8)',
                } : {})
              }}
              onClick={generateAnotherPlan}
              onMouseEnter={() => setHoveredCard('generate')}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <span>✨</span>
              Regenerate with AI
            </div>
          </div>

          {itinerary.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "14px", padding: "10px" }}>
              No itinerary data available yet.
            </div>
          ) : (
            itinerary.map((day, dayIdx) => {
              const isOpen = expandedDay === day.day;

              return (
                <div key={day.day} style={{ 
                  marginBottom: "20px",
                  animation: "fadeInUp 0.5s ease backwards",
                  animationDelay: `${0.5 + dayIdx * 0.1}s`
                }}>
                  <div
                    style={{
                      ...styles.dayHeader,
                      ...(hoveredCard === `day-${day.day}` ? {
                        borderColor: 'rgba(139, 92, 246, 0.5)',
                        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(192, 132, 252, 0.2))',
                        transform: 'translateX(8px)',
                      } : {})
                    }}
                    onClick={() => {
                      const newDay = isOpen ? 0 : day.day;
                      setExpandedDay(newDay);
                      userExpandedDayRef.current = newDay;
                    }}
                    onMouseEnter={() => setHoveredCard(`day-${day.day}`)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <span>
                      DAY {day.day} · {day.date}
                    </span>
                    
                    <div 
                      style={{
                        ...styles.expandButton,
                        ...(hoveredCard === `day-${day.day}` ? {
                          transform: 'scale(1.15)',
                          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.3), rgba(192, 132, 252, 0.3))',
                        } : {})
                      }}
                    >
                      {isOpen ? '−' : '+'}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ 
                      paddingLeft: "12px", 
                      animation: "slideDown 0.4s ease"
                    }}>
                      {day.items.length === 0 ? (
                        <div style={{ color: "#94a3b8", fontSize: "14px", padding: "20px" }}>
                          No activities scheduled for this day yet.
                        </div>
                      ) : (
                        day.items.map((item, idx) => (
                          <div 
                            key={idx} 
                            style={{
                              ...styles.row,
                              background: idx % 2 === 0 
                                ? 'rgba(246, 244, 255, 0.95)' 
                                : 'rgba(235, 230, 250, 0.85)',
                              ...(hoveredCard === `item-${day.day}-${idx}` ? {
                                background: 'rgba(255, 255, 255, 0.98)',
                                transform: 'translateX(12px)',
                                borderColor: 'rgba(139, 92, 246, 0.25)',
                              } : {})
                            }}
                            onMouseEnter={() => setHoveredCard(`item-${day.day}-${idx}`)}
                            onMouseLeave={() => setHoveredCard(null)}
                          >
                            <div style={styles.time}>
                              {formatTime(item.start_time)}
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={styles.itemTitle}>
                                <span>{getTypeEmoji(item.type)}</span>
                                <span>{item.title}</span>
                              </div>
                              <div style={styles.itemSub}>{item.location}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div style={styles.actionRow}>
          <button
            style={{
              ...styles.btnPrimary,
              ...(hoveredCard === 'confirm' ? {
                transform: 'translateY(-4px) scale(1.05)',
                boxShadow: '0 12px 40px rgba(167, 139, 250, 0.6)',
              } : {})
            }}
            onClick={() => {
              if (tripId) {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                navigate(`/trip/${tripId}/itinerary`);
              } else {
                setErrorMsg("No trip ID available. Cannot edit itinerary.");
              }
            }}
            onMouseEnter={() => setHoveredCard('confirm')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            🚀 Confirm & Start Adventure
          </button>
        </div>
      </div>
    </div>
  );
}