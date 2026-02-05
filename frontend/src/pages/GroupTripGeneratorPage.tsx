// frontend/src/pages/GroupTripGeneratorPage.tsx

import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import { encodeId } from "../lib/urlObfuscation";

// Import the JSON data directly from the data folder
import countriesCitiesRaw from "../data/countriesCities.json";

type ChipValue = string;

interface CountryCity {
  country: string;
  cities: string[];
}

/* ---------------- DATE HELPERS ---------------- */

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date | null): string {
  if (!date) return "Select date";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBetween(date: Date, start: Date, end: Date): boolean {
  const t = startOfDay(date).getTime();
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return t > s && t < e;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  let d = first;
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d = new Date(year, month, d.getDate() + 1);
  }
  return days;
}

/* =======================================================
                        MAIN COMPONENT
======================================================= */

export default function GroupTripGeneratorPage() {
  const navigate = useNavigate();

  /* -------------------- TRANSFORM DATA -------------------- */
  const COUNTRIES_WITH_CITIES: CountryCity[] = useMemo(() => {
    return (countriesCitiesRaw as any[]).map((item: any) => ({
      country: item.name,
      cities: item.cities || []
    }));
  }, []);

  /* -------------------- STATES -------------------- */

  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const [durationDays, setDurationDays] = useState(3);

  const destinationTypeOptions: ChipValue[] = [
    "Tropical",
    "Beach/Coastal",
    "Mountains",
    "Cold/Winter",
    "Countryside",
    "Urban",
    "Island",
    "Desert",
    "Forest/Nature",
    "Historical Sites",
    "Modern Cities",
    "Small Towns",
    "Wine Region",
  ];
  const [selectedDestinationTypes, setSelectedDestinationTypes] = useState<ChipValue[]>([]);

  const activityOptions: ChipValue[] = [
    "Luxury/Shopping",
    "Adventure",
    "Wellness",
    "Cultural Immersion",
    "Culinary",
    "Sightseeing",
    "Beach/Water Sports",
    "Hiking/Trekking",
    "Photography",
    "Nightlife",
    "Museums & Art",
    "Food Tours",
    "Wine Tasting",
    "Scuba Diving",
    "Skiing/Winter Sports",
    "Wildlife Watching",
    "Yoga/Meditation",
    "Live Music",
    "Local Markets",
  ];
  const [selectedActivities, setSelectedActivities] = useState<ChipValue[]>([]);

  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [destTypesExpanded, setDestTypesExpanded] = useState(false);

  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  
  const currencies = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
    { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
    { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
    { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
    { code: "THB", symbol: "฿", name: "Thai Baht" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "KRW", symbol: "₩", name: "South Korean Won" },
  ];

  const currentCurrency = currencies.find(c => c.code === selectedCurrency) || currencies[0];

  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  /* -------------------- HOVER STATES -------------------- */
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  /* -------------------- HANDLERS -------------------- */

  const toggleDestinationType = (opt: ChipValue) => {
    setSelectedDestinationTypes((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    );
  };

  const toggleActivity = (opt: ChipValue) => {
    setSelectedActivities((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    );
  };

  const toggleDestination = useCallback((destination: string) => {
    setSelectedDestinations((prev) =>
      prev.includes(destination)
        ? prev.filter((d) => d !== destination)
        : [...prev, destination]
    );
  }, []);

  const removeDestination = (destination: string) => {
    setSelectedDestinations((prev) => prev.filter((d) => d !== destination));
  };

  const toggleCountryExpansion = useCallback((country: string) => {
    setExpandedCountries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(country)) {
        newSet.delete(country);
      } else {
        newSet.add(country);
      }
      return newSet;
    });
  }, []);

  /* -------------------- COUNTRY/CITY MODAL - OPTIMIZED -------------------- */

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) {
      return COUNTRIES_WITH_CITIES.slice(0, 50);
    }
    
    const searchLower = countrySearch.toLowerCase().trim();
    
    const filtered = COUNTRIES_WITH_CITIES
      .map(item => {
        const countryMatches = item.country.toLowerCase().includes(searchLower);
        
        if (countryMatches) {
          return item;
        }
        
        const matchingCities = item.cities.filter(city => 
          city.toLowerCase().includes(searchLower)
        );
        
        if (matchingCities.length > 0) {
          return {
            country: item.country,
            cities: matchingCities.slice(0, 20)
          };
        }
        
        return null;
      })
      .filter(Boolean) as CountryCity[];
    
    return filtered.slice(0, 30);
  }, [COUNTRIES_WITH_CITIES, countrySearch]);

  /* -------------------- CALENDAR LOGIC -------------------- */

  const handleDayClick = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      return;
    }

    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
      return;
    }

    if (startOfDay(date) < startOfDay(startDate)) {
      setStartDate(date);
      return;
    }

    setEndDate(date);
    setTimeout(() => setCalendarOpen(false), 200);
  };

  const renderMonthGrid = (offset: number) => {
    const month = calendarMonth + offset;
    const yearOffset = Math.floor(month / 12);
    const effMonth = ((month % 12) + 12) % 12;
    const year = calendarYear + yearOffset;

    const firstDay = new Date(year, effMonth, 1).getDay();
    const days = getDaysInMonth(year, effMonth);
    const blanks = firstDay === 0 ? 6 : firstDay - 1;

    const cells: (Date | null)[] = [];
    for (let i = 0; i < blanks; i++) cells.push(null);
    cells.push(...days);
    while (cells.length % 7 !== 0) cells.push(null);

    const weekdayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: offset === 0 ? "space-between" : "center",
            alignItems: "center",
            marginBottom: "10px",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          {offset === 0 ? (
            <button
              onClick={() => {
                let m = calendarMonth - 1;
                let y = calendarYear;
                if (m < 0) { m = 11; y -= 1; }
                setCalendarMonth(m);
                setCalendarYear(y);
              }}
              style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }}
            >
              ‹
            </button>
          ) : (
            <div style={{ width: "20px" }} />
          )}

          <div>
            {new Date(year, effMonth, 1).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </div>

          {offset === 1 ? (
            <button
              onClick={() => {
                let m = calendarMonth + 1;
                let y = calendarYear;
                if (m > 11) { m = 0; y += 1; }
                setCalendarMonth(m);
                setCalendarYear(y);
              }}
              style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }}
            >
              ›
            </button>
          ) : (
            <div style={{ width: "20px" }} />
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            fontSize: "11px",
            color: "#a0a0b8",
            marginBottom: "6px",
          }}
        >
          {weekdayLabels.map((w) => (
            <div key={w} style={{ textAlign: "center" }}>{w}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: "8px" }}>
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} />;

            const isPast = date < today;
            
            const isStart = startDate && isSameDay(date, startDate);
            const isEnd = endDate && isSameDay(date, endDate);
            const inRange = startDate && endDate && isBetween(date, startDate, endDate);

            let bg = "transparent";
            let color = "#333";
            let cursor = "pointer";
            let opacity = 1;

            if (isPast) {
              color = "#ccc";
              cursor = "not-allowed";
              opacity = 0.4;
            } else if (isStart || isEnd) {
              bg = "#7c5cff";
              color = "#ffffff";
            } else if (inRange) {
              bg = "rgba(124, 92, 255, 0.15)";
            }

            return (
              <div
                key={idx}
                onClick={() => !isPast && handleDayClick(date)}
                style={{ display: "flex", justifyContent: "center", cursor }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: bg,
                    color,
                    fontSize: "13px",
                    opacity,
                  }}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* -------------------- SUBMIT HANDLER -------------------- */

  const handleDone = async () => {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("tripId");

    if (!tripId) {
      alert("No trip ID found. Please start from the invitation page.");
      return;
    }

    if (selectedDestinations.length === 0) {
      alert("Please select at least one destination (country or city).");
      return;
    }

    if (selectedActivities.length < 2) {
      alert("Please select at least two Activities & Interests.");
      return;
    }

    if (selectedDestinationTypes.length < 2) {
      alert("Please select at least two Destination Types.");
      return;
    }

    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }

    if (!budgetMin || !budgetMax) {
      alert("Please enter your budget range (both min and max).");
      return;
    }

    if (Number(budgetMin) >= Number(budgetMax)) {
      alert("Maximum budget must be greater than minimum budget.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("Please log in to save preferences.");
        navigate("/signin");
        return;
      }

      const destinationsString = selectedDestinations.join(", ");

      const payload = {
        user_id: user.id,
        country: destinationsString,
        start_date: formatDateLocal(startDate),
        end_date: formatDateLocal(endDate),
        duration_days: durationDays,
        activities: selectedActivities,
        destination_types: selectedDestinationTypes,
        budget_min: Number(budgetMin),
        budget_max: Number(budgetMax),
        budget_currency: selectedCurrency,
        additional_info: additionalInfo.trim() || "",
      };

      await apiFetch(`/f1/trips/${tripId}/preferences/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Navigate to obfuscated group wait route
      navigate(`/v/${encodeId(tripId)}/gw`);
    } catch (err: any) {
      console.error("Error saving preferences:", err);
      alert(`Failed to save preferences: ${err.message || "Please try again."}`);
    }
  };

  /* -------------------- STYLES -------------------- */

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      width: "100%",
      overflowX: "hidden",
      background: "linear-gradient(135deg, #e0f2fe 0%, #ddd6fe 20%, #fce7f3 40%, #fed7aa 60%, #fef3c7 80%, #e0f2fe 100%)",
      backgroundSize: "400% 400%",
      animation: "gradientShift 15s ease infinite",
      fontFamily: "Inter, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    },

    container: {
      width: "1200px",
      padding: "40px 0px 120px 0px",
      boxSizing: "border-box",
      margin: "0 auto",
      position: "relative",
      zIndex: 1,
    },

    pageSub: {
      fontSize: "14px",
      color: "#6d6d8c",
      marginBottom: "6px",
    },

    pageTitle: {
      fontSize: "32px",
      fontWeight: 600,
      color: "#1e1e2f",
      marginBottom: "24px",
    },

    card: {
      background: "#ffffff",
      padding: "24px 28px",
      borderRadius: "18px",
      border: "1px solid #dde3ff",
      boxShadow: "0px 6px 18px rgba(0,0,0,0.05)",
      marginBottom: "24px",
      transition: "all 0.3s ease",
    },

    twoColRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "22px",
      width: "100%",
    },

    row: {
      display: "flex",
      gap: "22px",
      alignItems: "stretch",
    },

    sectionTitleRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "14px",
    },

    sectionTitle: {
      fontSize: "18px",
      fontWeight: 600,
      color: "#2e2e3f",
    },

    sectionHint: {
      fontSize: "12px",
      color: "#9292aa",
    },

    dateBox: {
      flex: 1,
      background: "#f7f8ff",
      padding: "16px",
      borderRadius: "12px",
      border: "1px solid #d5ddff",
      cursor: "pointer",
      transition: "all 0.3s ease",
    },

    destinationSelector: {
      background: "#f7f8ff",
      padding: "16px",
      borderRadius: "12px",
      border: "1px solid #d5ddff",
      cursor: "pointer",
      minHeight: "56px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      transition: "all 0.3s ease",
    },

    selectedChips: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginTop: "8px",
    },

    selectedChip: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      background: "#4f46e5",
      color: "#ffffff",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: 500,
    },

    chipRemoveBtn: {
      background: "rgba(255,255,255,0.3)",
      border: "none",
      borderRadius: "50%",
      width: "18px",
      height: "18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      fontSize: "12px",
      color: "#ffffff",
    },

    sliderRow: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    chipsContainer: {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px",
    },

    chipBase: {
      padding: "8px 14px",
      borderRadius: "999px",
      border: "1px solid #c5ccff",
      background: "#ffffff",
      fontSize: "13px",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },

    chipSelected: {
      background: "#4f46e5",
      color: "#ffffff",
      borderColor: "#4f46e5",
    },

    doneButton: {
      marginTop: "20px",
      padding: "12px 32px",
      borderRadius: "999px",
      background: "linear-gradient(135deg, #8b7cff 0%, #6b5cff 100%)",
      color: "#ffffff",
      border: "none",
      cursor: "pointer",
      fontSize: "15px",
      fontWeight: 600,
      boxShadow: "0 6px 16px rgba(124, 92, 255, 0.35)",
      alignSelf: "flex-end",
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },

    calendarPopup: {
      position: "absolute",
      top: "200px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "900px",
      background: "#ffffff",
      padding: "24px 28px",
      borderRadius: "20px",
      border: "1px solid #dfe3ff",
      boxShadow: "0px 18px 40px rgba(0,0,0,0.15)",
      zIndex: 500,
      display: "flex",
      gap: "30px",
    },

    countryModal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },

    countryModalContent: {
      background: "#ffffff",
      borderRadius: "24px",
      padding: "32px",
      width: "700px",
      maxHeight: "80vh",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0px 24px 48px rgba(0,0,0,0.2)",
    },

    countrySearchInput: {
      width: "100%",
      padding: "14px 18px",
      borderRadius: "12px",
      border: "1px solid #d5ddff",
      fontSize: "15px",
      outline: "none",
      marginBottom: "20px",
      boxSizing: "border-box",
    },

    countryList: {
      flex: 1,
      overflowY: "auto",
      padding: "4px",
    },

    countryGroup: {
      marginBottom: "16px",
    },

    countryHeader: {
      fontWeight: 600,
      fontSize: "16px",
      color: "#4f46e5",
      marginBottom: "10px",
      padding: "8px 12px",
      background: "#f0f0ff",
      borderRadius: "8px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      transition: "all 0.2s ease",
    },

    cityGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
      paddingLeft: "12px",
      marginTop: "8px",
    },

    destinationItem: {
      padding: "10px 14px",
      borderRadius: "10px",
      border: "1px solid #e5e9ff",
      background: "#fafbff",
      cursor: "pointer",
      fontSize: "14px",
      transition: "all 0.2s ease",
    },

    destinationItemSelected: {
      background: "#4f46e5",
      color: "#ffffff",
      borderColor: "#4f46e5",
    },

    closeBtn: {
      position: "absolute",
      top: "10px",
      right: "18px",
      border: "none",
      background: "transparent",
      fontSize: "22px",
      cursor: "pointer",
      color: "#666666",
    },

    currencyButton: {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      border: "2px solid #4f46e5",
      background: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 600,
      color: "#4f46e5",
      transition: "all 0.2s ease",
    },

    currencyModal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },

    currencyModalContent: {
      background: "#ffffff",
      borderRadius: "20px",
      padding: "28px",
      width: "450px",
      maxHeight: "600px",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0px 24px 48px rgba(0,0,0,0.2)",
    },

    currencyGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "10px",
      marginTop: "16px",
      maxHeight: "450px",
      overflowY: "auto",
      padding: "4px",
    },

    currencyOption: {
      padding: "12px 16px",
      borderRadius: "12px",
      border: "1px solid #e5e9ff",
      background: "#fafbff",
      cursor: "pointer",
      transition: "all 0.2s ease",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },

    currencyOptionSelected: {
      background: "#4f46e5",
      color: "#ffffff",
      borderColor: "#4f46e5",
    },
  };

  React.useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        25% { background-position: 25% 50%; }
        50% { background-position: 50% 50%; }
        75% { background-position: 75% 50%; }
        100% { background-position: 0% 50%; }
      }

      button:hover {
        transform: translateY(-2px);
      }

      button:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  /* =======================================================
                           RENDER
  ======================================================= */

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.pageSub}>Share your preferences</div>
        <div style={styles.pageTitle}>AI Trip Generator</div>

        {/* DESTINATION SELECTION */}
        <div 
          style={{
            ...styles.card,
            ...(hoveredCard === 'destination' ? { transform: 'translateY(-4px)', boxShadow: '0px 12px 24px rgba(0,0,0,0.08)' } : {})
          }}
          onMouseEnter={() => setHoveredCard('destination')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={styles.sectionTitleRow}>
            <div style={styles.sectionTitle}>Destinations</div>
            <div style={styles.sectionHint}>Select countries or cities (multiple allowed)</div>
          </div>

          <div 
            style={{
              ...styles.destinationSelector,
              ...(hoveredCard === 'destination-selector' ? { background: '#eef1ff', borderColor: '#c5ccff' } : {})
            }}
            onClick={() => setCountryModalOpen(true)}
            onMouseEnter={() => setHoveredCard('destination-selector')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={{ fontSize: "11px", color: "#8c8ca0" }}>
              {selectedDestinations.length > 0 ? "Selected destinations" : "Click to select"}
            </div>
            {selectedDestinations.length === 0 ? (
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#9292aa" }}>
                Select destinations
              </div>
            ) : (
              <div style={styles.selectedChips}>
                {selectedDestinations.map((dest) => (
                  <div key={dest} style={styles.selectedChip}>
                    <span>{dest}</span>
                    <button
                      style={styles.chipRemoveBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDestination(dest);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COUNTRY/CITY MODAL */}
        {countryModalOpen && (
          <div
            style={styles.countryModal}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setCountryModalOpen(false);
                setCountrySearch("");
                setExpandedCountries(new Set());
              }
            }}
          >
            <div style={styles.countryModalContent}>
              <div style={{ position: "relative", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#1e1e2f", margin: 0 }}>
                  Select Destinations
                </h2>
                <button
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    border: "none",
                    background: "transparent",
                    fontSize: "28px",
                    cursor: "pointer",
                    color: "#666666",
                    lineHeight: 1,
                  }}
                  onClick={() => {
                    setCountryModalOpen(false);
                    setCountrySearch("");
                    setExpandedCountries(new Set());
                  }}
                >
                  ×
                </button>
              </div>

              <input
                type="text"
                placeholder="Search countries or cities..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                style={styles.countrySearchInput}
                autoFocus
              />

              <div style={styles.countryList}>
                {filteredCountries.length === 0 ? (
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    padding: "40px", 
                    fontSize: "16px", 
                    color: "#6d6d8c" 
                  }}>
                    No matching countries or cities found
                  </div>
                ) : (
                  filteredCountries.map((item) => {
                    const isExpanded = expandedCountries.has(item.country);
                    const citiesToShow = isExpanded ? item.cities.slice(0, 50) : [];
                    
                    return (
                      <div key={item.country} style={styles.countryGroup}>
                        <div
                          style={{
                            ...styles.countryHeader,
                            ...(selectedDestinations.includes(item.country)
                              ? { background: "#4f46e5", color: "#ffffff" }
                              : {}),
                          }}
                          onMouseEnter={(e) => {
                            if (!selectedDestinations.includes(item.country)) {
                              e.currentTarget.style.background = "#e8edff";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!selectedDestinations.includes(item.country)) {
                              e.currentTarget.style.background = "#f0f0ff";
                            }
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                            {item.cities.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCountryExpansion(item.country);
                                }}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  padding: "0 4px",
                                  color: "inherit",
                                }}
                              >
                                {isExpanded ? "▼" : "▶"}
                              </button>
                            )}
                            <span onClick={() => toggleDestination(item.country)} style={{ flex: 1, cursor: "pointer" }}>
                              {item.country}
                            </span>
                          </div>
                          <span onClick={() => toggleDestination(item.country)} style={{ cursor: "pointer" }}>
                            {selectedDestinations.includes(item.country) ? "✓" : "+"}
                          </span>
                        </div>

                        {isExpanded && item.cities.length > 0 && (
                          <div style={styles.cityGrid}>
                            {citiesToShow.map((city) => {
                              const cityLabel = `${city}, ${item.country}`;
                              const isSelected = selectedDestinations.includes(cityLabel);

                              return (
                                <div
                                  key={city}
                                  style={{
                                    ...styles.destinationItem,
                                    ...(isSelected ? styles.destinationItemSelected : {}),
                                  }}
                                  onClick={() => toggleDestination(cityLabel)}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.background = "#eef1ff";
                                      e.currentTarget.style.borderColor = "#c5ccff";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.background = "#fafbff";
                                      e.currentTarget.style.borderColor = "#e5e9ff";
                                    }
                                  }}
                                >
                                  {city}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  style={{
                    padding: "10px 24px",
                    background: "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => {
                    setCountryModalOpen(false);
                    setCountrySearch("");
                    setExpandedCountries(new Set());
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#4338ca";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#4f46e5";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  Done ({selectedDestinations.length} selected)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TRAVEL DATES */}
        <div 
          style={{
            ...styles.card,
            ...(hoveredCard === 'dates' ? { transform: 'translateY(-4px)', boxShadow: '0px 12px 24px rgba(0,0,0,0.08)' } : {})
          }}
          onMouseEnter={() => setHoveredCard('dates')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={styles.sectionTitleRow}>
            <div style={styles.sectionTitle}>Estimated Travel Dates</div>
          </div>

          <div style={styles.row}>
            <div 
              style={{
                ...styles.dateBox,
                ...(hoveredCard === 'start-date' ? { background: '#eef1ff', borderColor: '#c5ccff' } : {})
              }}
              onClick={() => setCalendarOpen(true)}
              onMouseEnter={() => setHoveredCard('start-date')}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={{ fontSize: "11px", color: "#8c8ca0" }}>Start</div>
              <div style={{ fontSize: "15px", fontWeight: 500 }}>
                {formatDisplayDate(startDate)}
              </div>
            </div>

            <div 
              style={{
                ...styles.dateBox,
                ...(hoveredCard === 'end-date' ? { background: '#eef1ff', borderColor: '#c5ccff' } : {})
              }}
              onClick={() => setCalendarOpen(true)}
              onMouseEnter={() => setHoveredCard('end-date')}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={{ fontSize: "11px", color: "#8c8ca0" }}>End</div>
              <div style={{ fontSize: "15px", fontWeight: 500 }}>
                {formatDisplayDate(endDate)}
              </div>
            </div>
          </div>
        </div>

        {/* CALENDAR POPUP */}
        {calendarOpen && (
          <div style={styles.calendarPopup}>
            <button style={styles.closeBtn} onClick={() => setCalendarOpen(false)}>
              ×
            </button>
            {renderMonthGrid(0)}
            {renderMonthGrid(1)}
          </div>
        )}

        {/* TRAVEL DURATION + ACTIVITIES */}
        <div style={{ ...styles.twoColRow, marginBottom: "26px" }}>
          <div 
            style={{
              ...styles.card,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: "140px",
              ...(hoveredCard === 'duration' ? { transform: 'translateY(-4px)', boxShadow: '0px 12px 24px rgba(0,0,0,0.08)' } : {})
            }}
            onMouseEnter={() => setHoveredCard('duration')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionTitle}>Travel Duration</div>
              <div style={styles.sectionHint}>How long do you plan to travel?</div>
            </div>

            <div style={styles.sliderRow}>
              <span style={{ fontSize: "11px", color: "#8c8ca0" }}>1 day</span>
              <input
                type="range"
                min={1}
                max={30}
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: "11px", color: "#8c8ca0" }}>30+ days</span>
              <div style={{ 
                fontSize: "14px", 
                fontWeight: 600, 
                color: "#4f46e5",
                minWidth: "70px",
                textAlign: "right"
              }}>
                {durationDays} {durationDays === 1 ? 'day' : 'days'}
              </div>
            </div>
          </div>

          <div 
            style={{
              ...styles.card,
              ...(hoveredCard === 'activities' ? { transform: 'translateY(-4px)', boxShadow: '0px 12px 24px rgba(0,0,0,0.08)' } : {})
            }}
            onMouseEnter={() => setHoveredCard('activities')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionTitle}>Activities & Interests</div>
              <div style={styles.sectionHint}>Select at least two</div>
            </div>

            <div style={styles.chipsContainer}>
              {(activitiesExpanded ? activityOptions : activityOptions.slice(0, 8)).map((opt) => {
                const selected = selectedActivities.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleActivity(opt)}
                    style={{
                      ...styles.chipBase,
                      ...(selected ? styles.chipSelected : {}),
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) {
                        e.currentTarget.style.background = "#eef1ff";
                        e.currentTarget.style.borderColor = "#b5bcff";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) {
                        e.currentTarget.style.background = "#ffffff";
                        e.currentTarget.style.borderColor = "#c5ccff";
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: "12px", textAlign: "center" }}>
              <button
                onClick={() => setActivitiesExpanded(!activitiesExpanded)}
                style={{
                  padding: "8px 20px",
                  background: "transparent",
                  color: "#4f46e5",
                  border: "1px solid #c5ccff",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#eef1ff";
                  e.currentTarget.style.borderColor = "#4f46e5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "#c5ccff";
                }}
              >
                {activitiesExpanded ? "Show less" : `Show more (${activityOptions.length - 8} more)`}
              </button>
            </div>
          </div>
        </div>

        {/* DESTINATION TYPE + BUDGET */}
        <div style={{ ...styles.twoColRow, marginBottom: "26px" }}>
          <div 
            style={{
              ...styles.card,
              ...(hoveredCard === 'dest-type' ? { transform: 'translateY(-4px)', boxShadow: '0px 12px 24px rgba(0,0,0,0.08)' } : {})
            }}
            onMouseEnter={() => setHoveredCard('dest-type')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionTitle}>Destination Type</div>
              <div style={styles.sectionHint}>Select at least two</div>
            </div>

            <div style={styles.chipsContainer}>
              {(destTypesExpanded ? destinationTypeOptions : destinationTypeOptions.slice(0, 8)).map((opt) => {
                const selected = selectedDestinationTypes.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleDestinationType(opt)}
                    style={{
                      ...styles.chipBase,
                      ...(selected ? styles.chipSelected : {}),
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) {
                        e.currentTarget.style.background = "#eef1ff";
                        e.currentTarget.style.borderColor = "#b5bcff";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) {
                        e.currentTarget.style.background = "#ffffff";
                        e.currentTarget.style.borderColor = "#c5ccff";
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: "12px", textAlign: "center" }}>
              <button
                onClick={() => setDestTypesExpanded(!destTypesExpanded)}
                style={{
                  padding: "8px 20px",
                  background: "transparent",
                  color: "#4f46e5",
                  border: "1px solid #c5ccff",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#eef1ff";
                  e.currentTarget.style.borderColor = "#4f46e5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "#c5ccff";
                }}
              >
                {destTypesExpanded ? "Show less" : `Show more (${destinationTypeOptions.length - 8} more)`}
              </button>
            </div>
          </div>

          <div 
            style={{
              ...styles.card,
              ...(hoveredCard === 'budget' ? { transform: 'translateY(-4px)', boxShadow: '0px 12px 24px rgba(0,0,0,0.08)' } : {})
            }}
            onMouseEnter={() => setHoveredCard('budget')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={styles.sectionTitle}>Budget</div>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  border: "1.5px solid #9ca3af",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
                onClick={() => setCurrencyModalOpen(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#4f46e5";
                  e.currentTarget.style.color = "#4f46e5";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#9ca3af";
                  e.currentTarget.style.color = "#6b7280";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title={`Currency: ${currentCurrency.code} ${currentCurrency.symbol}`}
              >
                i
              </div>
            </div>

            <div style={{ display: "flex", gap: "20px", marginTop: "6px" }}>
              <div
                style={{
                  flex: 1,
                  border: "1px solid #c7c7d1",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  background: "#ffffff",
                }}
              >
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Min</div>
                <input
                  type="number"
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontSize: "14px",
                    color: "#444",
                  }}
                  placeholder={`0${currentCurrency.symbol}`}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  border: "1px solid #c7c7d1",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  background: "#ffffff",
                }}
              >
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Max</div>
                <input
                  type="number"
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontSize: "14px",
                    color: "#444",
                  }}
                  placeholder={`0${currentCurrency.symbol}`}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CURRENCY MODAL */}
        {currencyModalOpen && (
          <div
            style={styles.currencyModal}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setCurrencyModalOpen(false);
              }
            }}
          >
            <div style={styles.currencyModalContent}>
              <div style={{ position: "relative", marginBottom: "10px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1e1e2f", margin: 0 }}>
                  Select Currency
                </h2>
                <button
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    border: "none",
                    background: "transparent",
                    fontSize: "28px",
                    cursor: "pointer",
                    color: "#666666",
                    lineHeight: 1,
                  }}
                  onClick={() => setCurrencyModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <div style={styles.currencyGrid}>
                {currencies.map((currency) => {
                  const isSelected = selectedCurrency === currency.code;
                  return (
                    <div
                      key={currency.code}
                      style={{
                        ...styles.currencyOption,
                        ...(isSelected ? styles.currencyOptionSelected : {}),
                      }}
                      onClick={() => {
                        setSelectedCurrency(currency.code);
                        setCurrencyModalOpen(false);
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "#eef1ff";
                          e.currentTarget.style.borderColor = "#c5ccff";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "#fafbff";
                          e.currentTarget.style.borderColor = "#e5e9ff";
                        }
                      }}
                    >
                      <div style={{ fontSize: "16px", fontWeight: 600 }}>
                        {currency.symbol} {currency.code}
                      </div>
                      <div style={{ fontSize: "12px", opacity: 0.8 }}>
                        {currency.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ADDITIONAL INFORMATION */}
        <div
          style={{
            width: "100%",
            padding: "26px",
            borderRadius: "22px",
            background: "rgba(255, 255, 255, 0.6)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.8)",
            boxShadow: "0px 4px 12px rgba(0,0,0,0.04)",
            marginBottom: "40px",
          }}
        >
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#1e1e2f", marginBottom: "6px" }}>
              Additional Information
            </div>
            <div style={{ fontSize: "14px", color: "#6b6bb0", lineHeight: 1.5 }}>
              Write what comes to mind in natural language…
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "14px",
              border: "1px solid rgba(107,92,255,0.15)",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#4f46e5", marginBottom: "8px" }}>
              💡 AI understands requests like:
            </div>
            <div style={{ fontSize: "12px", color: "#5a5a7a", lineHeight: 1.7 }}>
              • "I want a relaxed schedule"<br />
              • "I am vegan" / "I need vegetarian food"<br />
              • "We need halal food"<br />
              • "Wheelchair accessible"<br />
              • "We have young kids" / "Family-friendly"
            </div>
          </div>

          <textarea
            style={{
              width: "100%",
              height: "140px",
              borderRadius: "16px",
              padding: "14px 18px",
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(4px)",
              fontSize: "14px",
              color: "#2a2a3a",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
            placeholder="e.g., 'We prefer a relaxed pace and need vegetarian restaurants...'"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
          />

          <div
            style={{
              marginTop: "12px",
              padding: "12px 14px",
              background: "rgba(255, 193, 7, 0.12)",
              border: "1px solid rgba(255, 193, 7, 0.3)",
              borderRadius: "10px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
            <div style={{ fontSize: "12px", color: "#7a5c00", lineHeight: 1.5 }}>
              <strong>Note:</strong> AI will try its best to follow your requirements, but it may occasionally make mistakes. 
              Please review the generated itinerary and regenerate if needed.
            </div>
          </div>
        </div>

        {/* DONE BUTTON */}
        <div style={{ width: "1200px", display: "flex", justifyContent: "flex-end" }}>
          <button
            style={styles.doneButton}
            onClick={handleDone}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(124, 92, 255, 0.45)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(124, 92, 255, 0.35)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(-2px) scale(0.98)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}