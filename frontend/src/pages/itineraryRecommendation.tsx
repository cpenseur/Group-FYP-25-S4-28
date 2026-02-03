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
  matched_preferences?: string[];
  // ✅ CRITICAL for place details to work
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  xid?: string | null;
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

interface UserProfile {
  interests?: string[];
  travel_pace?: string;
  budget_level?: string;
  diet_preference?: string;
  mobility_needs?: string;
}

export default function RecommendationsPage() {
  const { tripId } = useParams();
  
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [days, setDays] = useState<TripDayResponse[]>([]);
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
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
  
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        console.log("📋 Loading user profile preferences...");
        setIsLoadingProfile(true);
        
        const profileData = await apiFetch("/f1/profile/");
        
        const profile: UserProfile = {
          interests: profileData.interests || [],
          travel_pace: profileData.travel_pace || null,
          budget_level: profileData.budget_level || null,
          diet_preference: profileData.diet_preference || null,
          mobility_needs: profileData.mobility_needs || null,
        };
        
        setUserProfile(profile);
        console.log("✅ User profile loaded:", profile);
      } catch (err) {
        console.error("❌ Failed to load user profile:", err);
        setUserProfile({});
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    loadUserProfile();
  }, []);
  
  useEffect(() => {
    if (!tripId) return;
    
    const loadTrip = async () => {
      try {
        console.log("📦 Loading trip data...");
        const data: TripResponse = await apiFetch(`/f1/trips/${tripId}/`);
        setTrip(data);
        setItems(data.items || []);
        setDays(data.days || []);
        
        const dest = data.main_city || data.main_country || "Tokyo";
        setDestination(dest);
        console.log(`✅ Trip loaded: ${dest}, ${data.days.length} days, ${data.items.length} items`);
        
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
  
  // ✅ FIXED: Improved location detection logic
  useEffect(() => {
    console.log("\n=== 🔍 Location Detection Started ===");
    console.log(`Days loaded: ${days.length}, Items loaded: ${items.length}`);
    console.log(`Selected day index: ${selectedDay}`);
    
    if (days.length === 0 || items.length === 0) {
      console.log("⏳ Waiting for days/items to load...");
      return;
    }
    
    const targetDayIndex = selectedDay + 1;
    const dayObj = days.find(d => d.day_index === targetDayIndex);
    console.log(`Looking for day with day_index=${targetDayIndex}:`, dayObj ? "✅ Found" : "❌ Not found");
    
    if (!dayObj) {
      console.log(`⚠️ Day ${targetDayIndex} not found, using trip destination: ${destination}`);
      setCurrentDayLocation(destination);
      return;
    }
    
    console.log(`Found day: ID=${dayObj.id}, day_index=${dayObj.day_index}`);
    
    const dayItems = items.filter(item => item.day === dayObj.id);
    console.log(`\n📍 Day ${targetDayIndex} has ${dayItems.length} items:`);
    dayItems.forEach(item => {
      console.log(`  - ${item.title}: ${item.address || "no address"}`);
    });
    
    if (dayItems.length > 0) {
      let detectedLocation = destination;
      const cities: string[] = [];
      
      // ✅ Track if we find Singapore explicitly
      let hasSingapore = false;
      
      dayItems.forEach(item => {
        if (!item.address) {
          console.log(`    ❌ ${item.title}: No address`);
          return;
        }
        
        const addressLower = item.address.toLowerCase();
        
        // ✅ PRIORITY: Check for "Singapore" explicitly first
        if (addressLower.includes('singapore')) {
          cities.push('Singapore');
          hasSingapore = true;
          console.log(`    ✅ DIRECT MATCH: ${item.title} → Singapore`);
          return; // Skip other strategies for this item
        }
        
        const parts = item.address.split(',').map(p => p.trim());
        console.log(`    📍 ${item.title}: ${item.address}`);
        
        let detectedCity = null;
        
        // Strategy 1: Third from end (for structured addresses)
        if (parts.length >= 3) {
          let potential = parts[parts.length - 3];
          potential = potential.replace(/ City| Prefecture| Ward| District/gi, '').trim();
          
          // ✅ Exclude country names and common false positives
          const excludeWords = ['japan', 'united kingdom', 'united states', 'scotland', 
                               'england', 'wales', 'ireland', 'montana', 'wyoming'];
          
          if (!excludeWords.includes(potential.toLowerCase()) && potential.length > 2) {
            detectedCity = potential;
            console.log(`       ✅ Strategy 1: "${detectedCity}"`);
          }
        }
        
        // Strategy 2: Second from end
        if (!detectedCity && parts.length >= 2) {
          let potential = parts[parts.length - 2];
          potential = potential.replace(/ City| Prefecture/gi, '').trim();
          
          const excludeWords = ['japan', 'united kingdom', 'united states', 'scotland',
                               'england', 'wales', 'ireland', 'montana', 'wyoming'];
          
          if (!excludeWords.includes(potential.toLowerCase()) && potential.length > 2) {
            detectedCity = potential;
            console.log(`       ✅ Strategy 2: "${detectedCity}"`);
          }
        }
        
        // Strategy 3: Check for major cities in ANY part
        if (!detectedCity) {
          const majorCities = [
            'Tokyo', 'Osaka', 'Kyoto', 'Sapporo', 'Hokkaido', 'Fukuoka',
            'Yokohama', 'Nagoya', 'Kobe', 'Hiroshima', 'Sendai', 'Nara',
            'Singapore', 'Kuala Lumpur', 'Bangkok', 'Hanoi', 'Seoul',
            'Hong Kong', 'Manila', 'Jakarta', 'Taipei', 'Shanghai', 'Beijing'
          ];
          
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
        
        // ✅ Filter out known bad cities BEFORE adding
        if (detectedCity) {
          const invalidCities = [
            'fife', 'great falls', 'montana', 'scotland', 'united kingdom',
            'st andrews', 'st. andrews', 'cluny road', 'mandai', 'orange grove'
          ];
          
          const cityLower = detectedCity.toLowerCase();
          const isInvalid = invalidCities.some(invalid => cityLower.includes(invalid));
          
          if (!isInvalid) {
            cities.push(detectedCity);
            console.log(`       ✅ Added: "${detectedCity}"`);
          } else {
            console.log(`       ⚠️ FILTERED (invalid): "${detectedCity}"`);
          }
        }
      });
      
      console.log(`\n📊 Detected cities:`, cities);
      
      // ✅ PRIORITY: If we found Singapore explicitly, use it
      if (hasSingapore || cities.includes('Singapore')) {
        detectedLocation = 'Singapore';
        console.log(`✅ PRIORITY: Using Singapore (explicitly found in addresses)`);
      } else if (cities.length > 0) {
        // Count occurrences and pick most common
        const cityCounts = cities.reduce((acc, city) => {
          acc[city] = (acc[city] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
        detectedLocation = sortedCities[0][0];
        
        // ✅ SAFETY CHECK: Override if detected location is still invalid
        const finalInvalidCheck = ['fife', 'great falls', 'montana', 'scotland'];
        if (finalInvalidCheck.some(invalid => detectedLocation.toLowerCase().includes(invalid))) {
          console.log(`⚠️ SAFETY OVERRIDE: "${detectedLocation}" is invalid, using trip default: ${destination}`);
          detectedLocation = destination;
        } else {
          console.log(`✅ LOCATION DETECTED: "${detectedLocation}" (${cityCounts[detectedLocation]} occurrences)`);
        }
      } else {
        console.log(`⚠️ No valid cities found, using trip default: ${destination}`);
      }
      
      setCurrentDayLocation(detectedLocation);
    } else {
      console.log(`⚠️ No items for day ${targetDayIndex}, using trip destination: ${destination}`);
      setCurrentDayLocation(destination);
    }
    
    console.log("=== Location Detection Complete ===\n");
  }, [selectedDay, items, days, destination]);
  
  useEffect(() => {
    if (!currentDayLocation || !tripId || isLoadingProfile) {
      console.log("⏳ Waiting for location, tripId, or user profile...");
      return;
    }
    
    console.log(`\nScheduling recommendations refresh for: ${currentDayLocation} (Day ${selectedDay + 1})`);
    
    if (abortControllerRef.current) {
      console.log("Cancelling previous request");
      abortControllerRef.current.abort();
    }
    
    const timer = setTimeout(() => {
      if (!loadingRef.current) {
        loadRecommendations();
      } else {
        console.log("⏸ Already loading, skipping duplicate request");
      }
    }, 300);
    
    return () => {
      clearTimeout(timer);
    };
  }, [currentDayLocation, selectedDay, tripId, isLoadingProfile, userProfile]);
  
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
    console.log(`User Preferences:`, userProfile);
    
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    abortControllerRef.current = new AbortController();
    
    try {
      let url = `/f1/recommendations/ai/?trip_id=${tripId}&day_index=${selectedDay}&location=${encodeURIComponent(location)}`;
      
      const requestBody: any = {
        trip_id: tripId,
        day_index: selectedDay,
        location: location,
      };
      
      if (userProfile) {
        requestBody.user_preferences = {
          interests: userProfile.interests || [],
          travel_pace: userProfile.travel_pace,
          budget_level: userProfile.budget_level,
          diet_preference: userProfile.diet_preference,
          mobility_needs: userProfile.mobility_needs,
        };
        
        console.log(`📋 Including user preferences in request:`, requestBody.user_preferences);
      }
      
      console.log(`📡 API Call: ${url}`);
      
      const response = await apiFetch(url, {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
      
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
        
        // ✅ Log coordinates check
        const totalRecs = [...newCategories.nearby, ...newCategories.food, ...newCategories.culture];
        const withCoords = totalRecs.filter(r => r.lat != null && r.lon != null).length;
        console.log(`📍 Recommendations with coordinates: ${withCoords}/${totalRecs.length}`);
        
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
    console.log(`📍 Coordinates: lat=${recommendation.lat}, lon=${recommendation.lon}`);
    
    // ✅ Validate coordinates exist
    if (!recommendation.lat || !recommendation.lon) {
      console.error("❌ Recommendation missing coordinates:", recommendation);
      alert("This recommendation is missing location data and cannot be added.");
      return;
    }
    
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
        
        const data: TripResponse = await apiFetch(`/f1/trips/${tripId}/`);
        setItems(data.items || []);
        
        await loadRecommendations();
      }
    } catch (err: any) {
      alert(`Failed to add: ${err.message}`);
      console.error("Failed to add:", err);
    }
  };
  
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
  
  const renderPreferencesSummary = () => {
    if (!userProfile || isLoadingProfile) return null;
    
    const hasPreferences = 
      (userProfile.interests && userProfile.interests.length > 0) ||
      userProfile.travel_pace ||
      userProfile.budget_level ||
      userProfile.diet_preference ||
      userProfile.mobility_needs;
    
    if (!hasPreferences) {
      return (
        <div style={{
          padding: "12px",
          backgroundColor: "#fef3c7",
          border: "1px solid #fbbf24",
          borderRadius: "8px",
          marginBottom: "16px",
          fontSize: "13px",
          color: "#92400e",
        }}>
          <strong>💡 Tip:</strong> Set your preferences in your profile to get personalized recommendations!
        </div>
      );
    }
    
    return (
      <div style={{
        padding: "12px",
        backgroundColor: "#f0fdf4",
        border: "1px solid #86efac",
        borderRadius: "8px",
        marginBottom: "16px",
        fontSize: "12px",
        color: "#166534",
      }}>
        <div style={{ fontWeight: 600, marginBottom: "6px" }}>
          ✨ Personalized for you
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {userProfile.interests && userProfile.interests.length > 0 && (
            <span style={{
              padding: "4px 8px",
              backgroundColor: "white",
              borderRadius: "12px",
              fontSize: "11px",
            }}>
              🎯 {userProfile.interests.join(", ")}
            </span>
          )}
          {userProfile.budget_level && (
            <span style={{
              padding: "4px 8px",
              backgroundColor: "white",
              borderRadius: "12px",
              fontSize: "11px",
            }}>
              💰 {userProfile.budget_level}
            </span>
          )}
          {userProfile.travel_pace && (
            <span style={{
              padding: "4px 8px",
              backgroundColor: "white",
              borderRadius: "12px",
              fontSize: "11px",
            }}>
              ⚡ {userProfile.travel_pace}
            </span>
          )}
          {userProfile.diet_preference && (
            <span style={{
              padding: "4px 8px",
              backgroundColor: "white",
              borderRadius: "12px",
              fontSize: "11px",
            }}>
              🍽️ {userProfile.diet_preference}
            </span>
          )}
        </div>
      </div>
    );
  };
  
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
          
          <div style={{
            height: "calc(90vh - 90px)",
            backgroundColor: "white",
            padding: "1.25rem 1.25rem 1rem",
            boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
            overflowY: "auto",
          }}>
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
              
              {renderPreferencesSummary()}
              
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
                  disabled={isLoading || isLoadingProfile}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "white",
                    color: "#4f46e5",
                    border: "2px solid #4f46e5",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: (isLoading || isLoadingProfile) ? "not-allowed" : "pointer",
                    opacity: (isLoading || isLoadingProfile) ? 0.6 : 1,
                  }}
                >
                  {isLoading ? "Loading..." : "🔄 Refresh"}
                </button>
              </div>
              
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
            
            <div style={{ paddingTop: "16px" }}>
              {isLoading && (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>🤖</div>
                  <p style={{ fontSize: "15px", color: "#6b7280" }}>
                    Generating personalized recommendations for {currentDayLocation || destination}...
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
                        
                        {(!rec.lat || !rec.lon) && (
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 10px",
                            backgroundColor: "#fef2f2",
                            color: "#dc2626",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}>
                            <span>⚠️</span>
                            <span>No location</span>
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
                        
                        {rec.matched_preferences && rec.matched_preferences.length > 0 && (
                          <div style={{
                            marginTop: "8px",
                            paddingTop: "8px",
                            borderTop: "1px solid #e5e7eb",
                          }}>
                            <div style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#10b981",
                              marginBottom: "4px",
                            }}>
                              ✨ Matches your preferences:
                            </div>
                            <div style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                            }}>
                              {rec.matched_preferences.map((pref: string, idx: number) => (
                                <span
                                  key={idx}
                                  style={{
                                    padding: "2px 8px",
                                    backgroundColor: "#d1fae5",
                                    color: "#065f46",
                                    borderRadius: "10px",
                                    fontSize: "10px",
                                    fontWeight: 500,
                                  }}
                                >
                                  {pref}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => rec.action === "optimize_route" 
                          ? window.location.href = `/trip/${tripId}/itinerary`
                          : handleQuickAdd(rec)
                        }
                        disabled={!rec.lat || !rec.lon}
                        style={{
                          width: "100%",
                          padding: "10px",
                          backgroundColor: (!rec.lat || !rec.lon) ? "#d1d5db" : (rec.action === "optimize_route" ? "#10b981" : "#4f46e5"),
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: (!rec.lat || !rec.lon) ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          opacity: (!rec.lat || !rec.lon) ? 0.6 : 1,
                        }}
                      >
                        <span>{rec.action === "optimize_route" ? "⚡" : "+"}</span>
                        <span>
                          {(!rec.lat || !rec.lon) 
                            ? "Location unavailable" 
                            : (rec.action === "optimize_route" ? "Go to Optimizer" : `Add to Day ${selectedDay + 1}`)
                          }
                        </span>
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
