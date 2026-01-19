// frontend/src/pages/RecommendationsPage.tsx

import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import TripSubHeader from "../components/TripSubHeader";
import ItineraryMap from "../components/ItineraryMap";
import { apiFetch } from "../lib/apiClient";

interface Recommendation {
  name: string;
  description: string;
  category: string;
  duration: string;
  cost: string;
  best_time: string;
  highlight: boolean;
  nearby_to?: string;
  action?: string;
}

interface CategoryRecommendations {
  nearby: Recommendation[];
  food: Recommendation[];
  culture: Recommendation[];
}

type ItineraryItem = {
  id: number;
  title: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  sort_order: number;
  day: number | null;
};

type TripDayResponse = {
  id: number;
  day_index: number;
  date: string | null;
};

type TripResponse = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  days: TripDayResponse[];
  items: ItineraryItem[];
};

export default function RecommendationsPage() {
  const { tripId } = useParams();
  
  // Trip data (for map)
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [days, setDays] = useState<TripDayResponse[]>([]);
  
  // Recommendations
  const [destination, setDestination] = useState("Tokyo");
  const [destinationInfo] = useState({
    description: "Discover amazing places and experiences.",
    best_time: "Year-round",
    budget: "Varies"
  });
  const [categories, setCategories] = useState<CategoryRecommendations>({
    nearby: [],
    food: [],
    culture: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeCategory, setActiveCategory] = useState<keyof CategoryRecommendations>("nearby");
  const [currentDayLocation, setCurrentDayLocation] = useState<string | null>(null);
  
  // NEW: Track loading state to prevent duplicate calls
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Load trip data
  useEffect(() => {
    if (!tripId) return;
    
    const loadTrip = async () => {
      try {
        console.log("📦 Loading trip data...");
        const data: TripResponse = await apiFetch(`/f1/trips/${tripId}/`);
        setTrip(data);
        setItems(data.items || []);
        setDays(data.days || []);
        
        // Set destination from trip
        const dest = data.main_city || data.main_country || "Tokyo";
        setDestination(dest);
        console.log(`✅ Trip loaded: ${dest}, ${data.days.length} days, ${data.items.length} items`);
        
        // Set default selected day to first day
        if (data.days && data.days.length > 0) {
          const firstDayIndex = data.days[0].day_index - 1;
          console.log(`🎯 Setting initial selected day to: ${firstDayIndex} (Day ${data.days[0].day_index})`);
          setSelectedDay(firstDayIndex);
        }
      } catch (err) {
        console.error("❌ Failed to load trip:", err);
      }
    };
    
    loadTrip();
  }, [tripId]);
  
  // Detect location for selected day
  useEffect(() => {
    console.log("\n=== 🔍 Location Detection Started ===");
    console.log(`Days loaded: ${days.length}, Items loaded: ${items.length}`);
    console.log(`Selected day index: ${selectedDay}`);
    
    if (days.length === 0 || items.length === 0) {
      console.log("⏳ Waiting for days/items to load...");
      return;
    }
    
    // Find the actual day object (day_index is 1-based in DB)
    const targetDayIndex = selectedDay + 1;
    const dayObj = days.find(d => d.day_index === targetDayIndex);
    console.log(`Looking for day with day_index=${targetDayIndex}:`, dayObj ? "✅ Found" : "❌ Not found");
    
    if (!dayObj) {
      console.log(`⚠️ Day ${targetDayIndex} not found, using trip destination: ${destination}`);
      setCurrentDayLocation(destination);
      return;
    }
    
    console.log(`Found day: ID=${dayObj.id}, day_index=${dayObj.day_index}`);
    
    // Get items for this day
    const dayItems = items.filter(item => item.day === dayObj.id);
    console.log(`\n📍 Day ${targetDayIndex} has ${dayItems.length} items:`);
    dayItems.forEach(item => {
      console.log(`  - ${item.title}: ${item.address || "no address"}`);
    });
    
    if (dayItems.length > 0) {
      // Extract location from items' addresses
      let detectedLocation = destination; // default
      const cities: string[] = [];
      
      dayItems.forEach(item => {
        if (!item.address) {
          console.log(`    ❌ ${item.title}: No address`);
          return;
        }
        
        const parts = item.address.split(',').map(p => p.trim());
        console.log(`    📍 ${item.title}: ${item.address}`);
        
        // Try multiple strategies
        let detectedCity = null;
        
        // Strategy 1: Third from end (for detailed addresses)
        if (parts.length >= 3) {
          let potential = parts[parts.length - 3];
          potential = potential.replace(/ City| Prefecture| Ward| District/gi, '').trim();
          if (potential.toLowerCase() !== 'japan') {
            detectedCity = potential;
            console.log(`       ✅ Strategy 1: "${detectedCity}"`);
          }
        }
        
        // Strategy 2: Second from end (for simple addresses)
        if (!detectedCity && parts.length >= 2) {
          let potential = parts[parts.length - 2];
          potential = potential.replace(/ City| Prefecture/gi, '').trim();
          if (potential.toLowerCase() !== 'japan') {
            detectedCity = potential;
            console.log(`       ✅ Strategy 2: "${detectedCity}"`);
          }
        }
        
        // Strategy 3: Check for major cities
        if (!detectedCity) {
          const majorCities = ['Tokyo', 'Osaka', 'Kyoto', 'Sapporo', 'Hokkaido'];
          for (const part of parts) {
            for (const city of majorCities) {
              if (part.toLowerCase().includes(city.toLowerCase())) {
                detectedCity = city;
                console.log(`       ✅ Strategy 3: "${detectedCity}"`);
                break;
              }
            }
            if (detectedCity) break;
          }
        }
        
        if (detectedCity) {
          cities.push(detectedCity);
        }
      });
      
      console.log(`\n📊 Detected cities:`, cities);
      
      if (cities.length > 0) {
        // Use most common city
        const cityCounts = cities.reduce((acc, city) => {
          acc[city] = (acc[city] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
        detectedLocation = sortedCities[0][0];
        console.log(`LOCATION DETECTED: "${detectedLocation}"`);
      } else {
        console.log(`⚠️ No cities found, using default: ${destination}`);
      }
      
      setCurrentDayLocation(detectedLocation);
    } else {
      console.log(`⚠️ No items for day ${targetDayIndex}, using trip destination: ${destination}`);
      setCurrentDayLocation(destination);
    }
    
    console.log("=== Location Detection Complete ===\n");
  }, [selectedDay, items, days, destination]);
  
  // FIXED: Load recommendations with debounce and duplicate prevention
  useEffect(() => {
    if (!currentDayLocation || !tripId) {
      console.log("⏳ Waiting for location or tripId...");
      return;
    }
    
    console.log(`\nScheduling recommendations refresh for: ${currentDayLocation} (Day ${selectedDay + 1})`);
    
    // Cancel any pending request
    if (abortControllerRef.current) {
      console.log("Cancelling previous request");
      abortControllerRef.current.abort();
    }
    
    // Debounce: wait a bit before loading
    const timer = setTimeout(() => {
      if (!loadingRef.current) {
        loadRecommendations();
      } else {
        console.log("⏸Already loading, skipping duplicate request");
      }
    }, 300); // 300ms debounce
    
    return () => {
      clearTimeout(timer);
    };
  }, [currentDayLocation, selectedDay, tripId]);
  
  const loadRecommendations = async () => {
    if (!tripId || loadingRef.current) {
      console.log("⏸️ Skipping load: already in progress");
      return;
    }
    
    const location = currentDayLocation || destination;
    
    console.log("\n=== 🤖 Loading AI Recommendations ===");
    console.log(`Trip ID: ${tripId}`);
    console.log(`Selected Day: ${selectedDay} (0-indexed)`);
    console.log(`Location: ${location}`);
    
    // Set loading flag
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const url = `/f1/recommendations/ai/?trip_id=${tripId}&day_index=${selectedDay}&location=${encodeURIComponent(location)}`;
      console.log(`📡 API Call: ${url}`);
      
      const response = await apiFetch(url);
      console.log("📥 Response received:", response);
      
      if (response.success) {
        const newCategories = response.categories || {
          nearby: [],
          food: [],
          culture: [],
        };
        
        console.log("Recommendations loaded:");
        console.log(`  - Nearby: ${newCategories.nearby.length}`);
        console.log(`  - Food: ${newCategories.food.length}`);
        console.log(`  - Culture: ${newCategories.culture.length}`);
        
        setCategories(newCategories);
        
        if (response.destination) {
          setDestination(response.destination);
        }
      } else {
        throw new Error(response.error || "Failed to load recommendations");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("⏸️ Request was cancelled");
        return;
      }
      console.error("Failed to load recommendations:", err);
      setError(err.message || "Failed to load recommendations");
      setCategories({
        nearby: [],
        food: [],
        culture: [],
      });
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      abortControllerRef.current = null;
      console.log("=== Recommendations Loading Complete ===\n");
    }
  };
  
  const handleQuickAdd = async (recommendation: Recommendation) => {
    if (!tripId) {
      alert("No trip selected");
      return;
    }
    
    console.log(`➕ Adding: ${recommendation.name} to Day ${selectedDay + 1}`);
    
    try {
      const response = await apiFetch("/f1/recommendations/quick-add/", {
        method: "POST",
        body: JSON.stringify({
          trip_id: tripId,
          day_index: selectedDay,
          recommendation: recommendation
        })
      });
      
      if (response.success) {
        alert(`${response.message}`);
        
        // Reload trip
        const data: TripResponse = await apiFetch(`/f1/trips/${tripId}/`);
        setItems(data.items || []);
        
        // Refresh recommendations
        await loadRecommendations();
      }
    } catch (err: any) {
      alert(`Failed to add: ${err.message}`);
      console.error("Failed to add:", err);
    }
  };
  
  // Prepare map items
  const dayIndexMap = new Map(days.map((d) => [d.id, d.day_index]));
  
  const itemsInTripOrder = [...items].sort((a, b) => {
    const da = dayIndexMap.get(a.day ?? 0) ?? 0;
    const db = dayIndexMap.get(b.day ?? 0) ?? 0;
    if (da !== db) return da - db;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  
  const mapItems = itemsInTripOrder.map((it, idx) => {
    const dayIdx = dayIndexMap.get(it.day ?? 0) ?? null;
    return {
      id: it.id,
      title: it.title,
      address: it.address,
      lat: it.lat,
      lon: it.lon,
      sort_order: idx + 1,
      day_index: dayIdx,
      stop_index: null,
    };
  });
  
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      nearby: "📍",
      food: "🍜",
      culture: "🏛️",
    };
    return icons[category.toLowerCase()] || "✨";
  };
  
  const getCategoryLabel = (category: keyof CategoryRecommendations) => {
    const labels: Record<keyof CategoryRecommendations, string> = {
      nearby: "Nearby Places",
      food: "Food & Dining",
      culture: "Culture & Attractions"
    };
    return labels[category];
  };
  
  const currentRecommendations = categories[activeCategory] || [];
  const totalRecommendations = Object.values(categories).flat().length;
  
  return (
    <>
      <TripSubHeader />
      
      <div style={{
        padding: "0rem 0rem 2rem",
        backgroundColor: "#f9fafb",
        minHeight: "calc(90vh - 90px)",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr)",
          columnGap: "0rem",
          alignItems: "flex-start",
          width: "100%",
          margin: 0,
          padding: 0,
        }}>
          {/* LEFT: Map */}
          <div style={{
            position: "sticky",
            top: 90,
            height: "calc(90vh - 90px)",
            background: "#e5e7eb",
            borderRadius: 0,
            overflow: "hidden",
            boxShadow: "none",
          }}>
            <ItineraryMap items={mapItems} photos={[]} />
          </div>
          
          {/* RIGHT: Recommendations */}
          <div style={{
            height: "calc(90vh - 90px)",
            backgroundColor: "white",
            padding: "1.25rem 1.25rem 1rem",
            boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
            overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{
              paddingBottom: "1rem",
              borderBottom: "1px solid #e5e7eb",
              marginBottom: "1rem",
            }}>
              <h1 style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "8px",
                margin: 0,
              }}>
                ✈️ {currentDayLocation || destination}
                {currentDayLocation && currentDayLocation !== destination && (
                  <span style={{
                    fontSize: "16px",
                    fontWeight: 500,
                    color: "#6b7280",
                    marginLeft: "12px"
                  }}>
                    (Day {selectedDay + 1})
                  </span>
                )}
              </h1>
              
              <p style={{
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: "1.5",
                marginTop: "8px",
                marginBottom: "12px",
              }}>
                {destinationInfo.description}
              </p>
              
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "16px",
              }}>
                <div>
                  <h2 style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#111827",
                    margin: 0,
                    marginBottom: "4px",
                  }}>
                    AI Recommendations
                  </h2>
                  <p style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    margin: 0,
                  }}>
                    {isLoading ? "Generating..." : `${totalRecommendations} suggestions`}
                  </p>
                </div>
                
                <button
                  onClick={loadRecommendations}
                  disabled={isLoading}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "white",
                    color: "#4f46e5",
                    border: "2px solid #4f46e5",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? "Loading..." : "🔄 Refresh"}
                </button>
              </div>
              
              {/* Category tabs */}
              <div style={{
                display: "flex",
                gap: "16px",
                marginTop: "16px",
                overflowX: "auto",
                paddingBottom: "16px",
              }}>
                {(Object.keys(categories) as Array<keyof CategoryRecommendations>).map(cat => {
                  const count = categories[cat].length;
                  const isActive = activeCategory === cat;
                  
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        padding: "10px 24px",
                        borderRadius: "999px",
                        border: isActive ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                        backgroundColor: isActive ? "#eef2ff" : "white",
                        color: isActive ? "#4f46e5" : "#6b7280",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        flexShrink: 0,
                      }}
                    >
                      <span>{getCategoryIcon(cat)}</span>
                      <span>{getCategoryLabel(cat)}</span>
                      <span style={{
                        backgroundColor: isActive ? "#4f46e5" : "#e5e7eb",
                        color: isActive ? "white" : "#6b7280",
                        borderRadius: "999px",
                        padding: "3px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {/* Day selector */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "32px",
                padding: "14px 16px",
                backgroundColor: "#f9fafb",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
              }}>
                <label style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#374151",
                  whiteSpace: "nowrap",
                }}>
                  View for:
                </label>
                <select
                  value={selectedDay}
                  onChange={(e) => {
                    const newDay = Number(e.target.value);
                    console.log(`\n👆 User changed day from ${selectedDay} to ${newDay}`);
                    setSelectedDay(newDay);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                    backgroundColor: "white",
                    fontWeight: 500,
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  {days.map(day => (
                    <option key={day.id} value={day.day_index - 1}>
                      Day {day.day_index}
                      {day.date && ` - ${new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Content */}
            <div style={{ paddingTop: "16px" }}>
              {isLoading && (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>🤖</div>
                  <p style={{ fontSize: "15px", color: "#6b7280" }}>
                    Generating recommendations for {currentDayLocation || destination}...
                  </p>
                </div>
              )}
              
              {error && !isLoading && (
                <div style={{
                  padding: "12px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#dc2626",
                  fontSize: "14px",
                }}>
                  {error}
                </div>
              )}
              
              {!isLoading && currentRecommendations.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {currentRecommendations.map((rec, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor: "white",
                        border: rec.highlight ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "16px",
                        boxShadow: rec.highlight ? "0 4px 12px rgba(79, 70, 229, 0.15)" : "0 2px 4px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 10px",
                          backgroundColor: "#f3f4f6",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}>
                          <span>{getCategoryIcon(activeCategory)}</span>
                          <span style={{ textTransform: "capitalize" }}>{activeCategory}</span>
                        </div>
                        
                        {rec.highlight && (
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 10px",
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}>
                            <span>⭐</span>
                            <span>Top Pick</span>
                          </div>
                        )}
                      </div>
                      
                      <h3 style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#111827",
                        marginBottom: "8px",
                      }}>
                        {rec.name}
                      </h3>
                      
                      <p style={{
                        fontSize: "13px",
                        color: "#6b7280",
                        lineHeight: "1.5",
                        marginTop: "8px",
                        marginBottom: "12px",
                      }}>
                        {rec.description}
                      </p>
                      
                      <div style={{
                        padding: "10px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "8px",
                        marginBottom: "12px",
                        fontSize: "12px",
                        color: "#6b7280",
                      }}>
                        <div>⏱️ {rec.duration}</div>
                        <div>💰 {rec.cost}</div>
                        <div>🕐 {rec.best_time}</div>
                      </div>
                      
                      <button
                        onClick={() => rec.action === "optimize_route" 
                          ? window.location.href = `/trip/${tripId}/itinerary`
                          : handleQuickAdd(rec)
                        }
                        style={{
                          width: "100%",
                          padding: "10px",
                          backgroundColor: rec.action === "optimize_route" ? "#10b981" : "#4f46e5",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <span>{rec.action === "optimize_route" ? "⚡" : "+"}</span>
                        <span>{rec.action === "optimize_route" ? "Go to Optimizer" : `Add to Day ${selectedDay + 1}`}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {!isLoading && currentRecommendations.length === 0 && !error && (
                <div style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "12px"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    {getCategoryIcon(activeCategory)}
                  </div>
                  <p style={{ fontSize: "15px", color: "#6b7280" }}>
                    No {getCategoryLabel(activeCategory).toLowerCase()} yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}