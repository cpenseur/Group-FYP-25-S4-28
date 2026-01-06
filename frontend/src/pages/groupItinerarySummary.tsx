import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

function getDestinationImage(destination: string): string {
  console.log("getDestinationImage called with:", destination);
  
  // Comprehensive image map for popular worldwide destinations
  const imageMap: Record<string, string> = {
    // Asia - East Asia
    "Japan": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&h=900&fit=crop",
    "Tokyo": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&h=900&fit=crop",
    "Kyoto": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1600&h=900&fit=crop",
    "Osaka": "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=1600&h=900&fit=crop",
    "China": "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1600&h=900&fit=crop",
    "Beijing": "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1600&h=900&fit=crop",
    "Shanghai": "https://images.unsplash.com/photo-1548919973-5cef591cdbc9?w=1600&h=900&fit=crop",
    "Hong Kong": "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=1600&h=900&fit=crop",
    "South Korea": "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1600&h=900&fit=crop",
    "Seoul": "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1600&h=900&fit=crop",
    "Taiwan": "https://images.unsplash.com/photo-1544473244-f6895e69ad8b?w=1600&h=900&fit=crop",
    "Taipei": "https://images.unsplash.com/photo-1544473244-f6895e69ad8b?w=1600&h=900&fit=crop",
    
    // Asia - Southeast Asia
    "Thailand": "https://images.unsplash.com/photo-1528181304800-259b08848526?w=1600&h=900&fit=crop",
    "Bangkok": "https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1600&h=900&fit=crop",
    "Phuket": "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1600&h=900&fit=crop",
    "Singapore": "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1600&h=900&fit=crop",
    "Indonesia": "https://images.unsplash.com/photo-1555400082-c7c96e4bd30b?w=1600&h=900&fit=crop",
    "Bali": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&h=900&fit=crop",
    "Vietnam": "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1600&h=900&fit=crop",
    "Hanoi": "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1600&h=900&fit=crop",
    "Ho Chi Minh": "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1600&h=900&fit=crop",
    "Malaysia": "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1600&h=900&fit=crop",
    "Kuala Lumpur": "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1600&h=900&fit=crop",
    "KL": "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1600&h=900&fit=crop",
    "Penang": "https://images.unsplash.com/photo-1559564484-e48bf7aa3d39?w=1600&h=900&fit=crop",
    "Malacca": "https://images.unsplash.com/photo-1542401886-65d6c61db217?w=1600&h=900&fit=crop",
    "Langkawi": "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=1600&h=900&fit=crop",
    "Philippines": "https://images.unsplash.com/photo-1542259009477-d625272157b7?w=1600&h=900&fit=crop",
    "Manila": "https://images.unsplash.com/photo-1542259009477-d625272157b7?w=1600&h=900&fit=crop",
    "Cambodia": "https://images.unsplash.com/photo-1557128398-9583d2a72334?w=1600&h=900&fit=crop",
    "Myanmar": "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1600&h=900&fit=crop",
    
    // Asia - South Asia
    "India": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1600&h=900&fit=crop",
    "Delhi": "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1600&h=900&fit=crop",
    "Mumbai": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1600&h=900&fit=crop",
    "Jaipur": "https://images.unsplash.com/photo-1548013146-72479768bada?w=1600&h=900&fit=crop",
    "Nepal": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&h=900&fit=crop",
    "Sri Lanka": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&h=900&fit=crop",
    "Maldives": "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1600&h=900&fit=crop",
    
    // Asia - Middle East
    "UAE": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&h=900&fit=crop",
    "Dubai": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&h=900&fit=crop",
    "Abu Dhabi": "https://images.unsplash.com/photo-1582672060674-bc2bd808a8b5?w=1600&h=900&fit=crop",
    "Turkey": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1600&h=900&fit=crop",
    "Istanbul": "https://images.unsplash.com/photo-1527838832700-5059252407fa?w=1600&h=900&fit=crop",
    "Israel": "https://images.unsplash.com/photo-1544783950-c61c77b6c3a4?w=1600&h=900&fit=crop",
    "Jordan": "https://images.unsplash.com/photo-1570939274717-7eda259b50ed?w=1600&h=900&fit=crop",
    "Qatar": "https://images.unsplash.com/photo-1548041347-390a7b1c858d?w=1600&h=900&fit=crop",
    "Saudi Arabia": "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1600&h=900&fit=crop",
    
    // Europe - Western Europe
    "France": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1600&h=900&fit=crop",
    "Paris": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1600&h=900&fit=crop",
    "Lyon": "https://images.unsplash.com/photo-1524168272322-bf73616d9cb5?w=1600&h=900&fit=crop",
    "Nice": "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1600&h=900&fit=crop",
    "UK": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&h=900&fit=crop",
    "London": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&h=900&fit=crop",
    "Scotland": "https://images.unsplash.com/photo-1551652361-5a6c2c2f9b9e?w=1600&h=900&fit=crop",
    "Edinburgh": "https://images.unsplash.com/photo-1549918864-48ac978761a4?w=1600&h=900&fit=crop",
    "Ireland": "https://images.unsplash.com/photo-1519832064555-7e7dc80a5c38?w=1600&h=900&fit=crop",
    "Dublin": "https://images.unsplash.com/photo-1549918864-48ac978761a4?w=1600&h=900&fit=crop",
    "Germany": "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1600&h=900&fit=crop",
    "Berlin": "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=1600&h=900&fit=crop",
    "Munich": "https://images.unsplash.com/photo-1595867818082-083862f3d630?w=1600&h=900&fit=crop",
    "Netherlands": "https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=1600&h=900&fit=crop",
    "Amsterdam": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1600&h=900&fit=crop",
    "Belgium": "https://images.unsplash.com/photo-1559564484-e48bf7aa3d39?w=1600&h=900&fit=crop",
    "Brussels": "https://images.unsplash.com/photo-1559564484-e48bf7aa3d39?w=1600&h=900&fit=crop",
    "Switzerland": "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=1600&h=900&fit=crop",
    "Zurich": "https://images.unsplash.com/photo-1516397281156-ca07cf9746fc?w=1600&h=900&fit=crop",
    "Austria": "https://images.unsplash.com/photo-1508962914676-134849a727f0?w=1600&h=900&fit=crop",
    "Vienna": "https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1600&h=900&fit=crop",
    
    // Europe - Southern Europe
    "Italy": "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1600&h=900&fit=crop",
    "Rome": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1600&h=900&fit=crop",
    "Venice": "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=1600&h=900&fit=crop",
    "Florence": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1600&h=900&fit=crop",
    "Milan": "https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=1600&h=900&fit=crop",
    "Spain": "https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1600&h=900&fit=crop",
    "Barcelona": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1600&h=900&fit=crop",
    "Madrid": "https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1600&h=900&fit=crop",
    "Seville": "https://images.unsplash.com/photo-1612783082656-8ad8d3dbf7bc?w=1600&h=900&fit=crop",
    "Portugal": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600&h=900&fit=crop",
    "Lisbon": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600&h=900&fit=crop",
    "Porto": "https://images.unsplash.com/photo-1555881400-69d86e828f37?w=1600&h=900&fit=crop",
    "Greece": "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1600&h=900&fit=crop",
    "Athens": "https://images.unsplash.com/photo-1555993539-1732b0258235?w=1600&h=900&fit=crop",
    "Santorini": "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1600&h=900&fit=crop",
    "Croatia": "https://images.unsplash.com/photo-1555990793-da11153b2473?w=1600&h=900&fit=crop",
    "Dubrovnik": "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=1600&h=900&fit=crop",
    
    // Europe - Northern Europe
    "Norway": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1600&h=900&fit=crop",
    "Sweden": "https://images.unsplash.com/photo-1509356843151-3e7d96241e11?w=1600&h=900&fit=crop",
    "Stockholm": "https://images.unsplash.com/photo-1509356843151-3e7d96241e11?w=1600&h=900&fit=crop",
    "Denmark": "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1600&h=900&fit=crop",
    "Copenhagen": "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1600&h=900&fit=crop",
    "Finland": "https://images.unsplash.com/photo-1543832923-44667a44c804?w=1600&h=900&fit=crop",
    "Iceland": "https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=1600&h=900&fit=crop",
    
    // Europe - Eastern Europe
    "Czech": "https://images.unsplash.com/photo-1541849546-216549ae216d?w=1600&h=900&fit=crop",
    "Prague": "https://images.unsplash.com/photo-1541849546-216549ae216d?w=1600&h=900&fit=crop",
    "Poland": "https://images.unsplash.com/photo-1623698002299-41a66e99aaa6?w=1600&h=900&fit=crop",
    "Warsaw": "https://images.unsplash.com/photo-1623698002299-41a66e99aaa6?w=1600&h=900&fit=crop",
    "Hungary": "https://images.unsplash.com/photo-1541356665065-22676f35dd40?w=1600&h=900&fit=crop",
    "Budapest": "https://images.unsplash.com/photo-1541356665065-22676f35dd40?w=1600&h=900&fit=crop",
    "Romania": "https://images.unsplash.com/photo-1601491319658-1bd888189093?w=1600&h=900&fit=crop",
    "Russia": "https://images.unsplash.com/photo-1547448526-9f5b56c96359?w=1600&h=900&fit=crop",
    "Moscow": "https://images.unsplash.com/photo-1513326738677-b964603b136d?w=1600&h=900&fit=crop",
    
    // Americas - North America
    "USA": "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=1600&h=900&fit=crop",
    "New York": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1600&h=900&fit=crop",
    "Los Angeles": "https://images.unsplash.com/photo-1534190239940-9ba8944ea261?w=1600&h=900&fit=crop",
    "San Francisco": "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=1600&h=900&fit=crop",
    "Chicago": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&h=900&fit=crop",
    "Las Vegas": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1600&h=900&fit=crop",
    "Miami": "https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?w=1600&h=900&fit=crop",
    "Seattle": "https://images.unsplash.com/photo-1531581147762-8f0b1becbee7?w=1600&h=900&fit=crop",
    "Boston": "https://images.unsplash.com/photo-1554315895-baae76d81c76?w=1600&h=900&fit=crop",
    "Canada": "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1600&h=900&fit=crop",
    "Toronto": "https://images.unsplash.com/photo-1517935706615-2717063c2225?w=1600&h=900&fit=crop",
    "Vancouver": "https://images.unsplash.com/photo-1542223189-67a03fa0f0bd?w=1600&h=900&fit=crop",
    "Montreal": "https://images.unsplash.com/photo-1519931800633-d6ca1b8d0ffd?w=1600&h=900&fit=crop",
    "Mexico": "https://images.unsplash.com/photo-1518638150340-f706e86654de?w=1600&h=900&fit=crop",
    "Cancun": "https://images.unsplash.com/photo-1601024445121-e5b82f020549?w=1600&h=900&fit=crop",
    
    // Americas - South America
    "Brazil": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1600&h=900&fit=crop",
    "Rio": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1600&h=900&fit=crop",
    "Argentina": "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1600&h=900&fit=crop",
    "Buenos Aires": "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1600&h=900&fit=crop",
    "Peru": "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1600&h=900&fit=crop",
    "Chile": "https://images.unsplash.com/photo-1489171084589-9b5031ebcf9b?w=1600&h=900&fit=crop",
    "Colombia": "https://images.unsplash.com/photo-1568632234157-ce7aecd03d0d?w=1600&h=900&fit=crop",
    
    // Africa
    "Egypt": "https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=1600&h=900&fit=crop",
    "Cairo": "https://images.unsplash.com/photo-1539768942893-daf53e448371?w=1600&h=900&fit=crop",
    "Morocco": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1600&h=900&fit=crop",
    "Marrakech": "https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1600&h=900&fit=crop",
    "South Africa": "https://images.unsplash.com/photo-1484318571209-661cf29a69c3?w=1600&h=900&fit=crop",
    "Cape Town": "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1600&h=900&fit=crop",
    "Kenya": "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1600&h=900&fit=crop",
    "Tanzania": "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1600&h=900&fit=crop",
    
    // Oceania
    "Australia": "https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=1600&h=900&fit=crop",
    "Sydney": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1600&h=900&fit=crop",
    "Melbourne": "https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1600&h=900&fit=crop",
    "New Zealand": "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1600&h=900&fit=crop",
    "Auckland": "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1600&h=900&fit=crop",
  };

  // Check if destination matches any key (case-insensitive partial match)
  for (const [key, url] of Object.entries(imageMap)) {
    if (destination.toLowerCase().includes(key.toLowerCase())) {
      console.log(`✅ Matched "${destination}" to "${key}":`, url);
      return url;
    }
  }

  // If destination is still default/empty, return a beautiful generic travel image
  if (destination === "Your Dream Destination" || !destination || destination.trim() === "") {
    console.log(`⚠️ No specific destination set, using beautiful generic travel image`);
    return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&h=900&fit=crop"; // Beautiful world travel montage
  }

  // Fallback: Use Unsplash dynamic image based on destination
  // This ensures ANY destination worldwide will get a relevant image
  const encodedDestination = encodeURIComponent(destination);
  const fallbackUrl = `https://source.unsplash.com/1600x900/?${encodedDestination},travel,landmark`;
  console.log(`🔄 No match for "${destination}", using fallback:`, fallbackUrl);
  return fallbackUrl;
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
  const { tripId } = useParams<{ tripId: string }>();

  const [tripDays, setTripDays] = useState(3);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [groupPreferences, setGroupPreferences] = useState<GroupPreference[]>([]);
  const [destination, setDestination] = useState("Your Dream Destination");

  const ownerUsername = useMemo(
    () => groupPreferences.find((u) => u.isOwner)?.username ?? groupPreferences[0]?.username ?? "owner",
    [groupPreferences]
  );

  const [itinerary, setItinerary] = useState<DayItinerary[]>([]);
  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // ✅ Background animations
  const seeded = useRef<number>(Math.floor(Math.random() * 1e9));

  const userExpandedDayRef = useRef<number | null>(null);

  // ✅ Stars animation
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

  // ✅ Flight paths animation
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

  // ✅ Floaters animation
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


  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

      // Debug: Log trip data to see what we're getting
      console.log("Trip data received:", {
        main_city: tripData.main_city,
        main_country: tripData.main_country,
        destination: tripData.destination,
        country: tripData.country
      });

      if (tripData.start_date) {
        setStartDate(new Date(tripData.start_date));
      }
      
      if (tripData.days) {
        setTripDays(tripData.days.length);
      }

      if (tripData.main_city || tripData.main_country) {
        const dest = tripData.main_city || tripData.main_country || "Your Dream Destination";
        console.log("Setting destination to:", dest);
        setDestination(dest);
      } else {
        console.log("No main_city or main_country found, keeping default destination");
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
      console.error("Failed to load trip data:", err);
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
  }, [tripId, isLoading, navigate]);

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
      color: "#1e1e2f",
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
      color: "#7c3aed",
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
      {/* ✅ BACKGROUND ANIMATIONS */}
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
        {/* ✅ AI BADGE */}
        <div style={styles.aiBadge}>
          <span style={{ fontSize: "20px" }}>✨</span>
          <span>AI-GENERATED ITINERARY</span>
        </div>

        {/* ✅ HERO SECTION */}
        <div style={styles.heroSection}>
          <img 
            src={getDestinationImage(destination)} 
            alt={destination}
            style={styles.heroImage}
          />
          <div style={styles.heroOverlay}>
            <div style={styles.heroTitle}>{destination}</div>
            <div style={styles.heroSubtitle}>
              <span>🤖</span>
              <span>Personalized {tripDays}-day adventure powered by AI</span>
            </div>

            {/* ✅ STATS BAR */}
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
                    
                    {/* ✅ NEW: + / - ICON */}
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