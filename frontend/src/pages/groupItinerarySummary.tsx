import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";

/* ================= TYPES ================= */

type GroupPreference = {
  username: string;
  preferences: string[];
  isOwner?: boolean;
};

type ItineraryItem = {
  time: string;      // "10:00"
  title: string;     // "Gardens by the Bay"
  location: string;  // "Marina Bay"
};

type DayItinerary = {
  day: number;       // 1,2,3...
  date: string;      // "20 Oct"
  items: ItineraryItem[];
};

/* ================= HELPERS ================= */

// Format date as "DD Mon" (e.g., "20 Oct")
function formatDDMon(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Add days to a base date
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Parse SeaLion AI text response into structured day itinerary
 * Expected format:
 * DAY 1:
 * 10:00 - Place | Area
 * 15:00 - Place | Area
 * 19:00 - Place | Area
 */
function parseSealionToDays(
  text: string,
  totalDays: number,
  startDate: Date
): DayItinerary[] {
  const days: DayItinerary[] = [];

  // Split by "DAY X:" pattern
  const blocks = text.split(/DAY\s*\d+\s*:/i).slice(1);

  for (let i = 0; i < totalDays; i++) {
    const dateStr = formatDDMon(addDays(startDate, i));
    const block = blocks[i] ?? "";
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const items: ItineraryItem[] = [];

    for (const line of lines) {
      // Match pattern: "10:00 - Place | Area"
      const match = line.match(/^(\d{2}:\d{2})\s*-\s*(.+?)\s*\|\s*(.+)$/);
      if (match) {
        items.push({
          time: match[1],
          title: match[2].trim(),
          location: match[3].trim(),
        });
      }
    }

    days.push({
      day: i + 1,
      date: dateStr,
      items,
    });
  }

  return days;
}

/* ================= COMPONENT ================= */

export default function GroupItinerarySummary() {
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId: string }>();

  // Trip metadata
  const [tripDays, setTripDays] = useState(3);
  const [startDate, setStartDate] = useState<Date>(new Date());

  // Group preferences state
  const [groupPreferences, setGroupPreferences] = useState<GroupPreference[]>([]);

  // Find the trip owner
  const ownerUsername = useMemo(
    () => groupPreferences.find((u) => u.isOwner)?.username ?? groupPreferences[0]?.username ?? "owner",
    [groupPreferences]
  );

  // Itinerary data (loaded from backend)
  const [itinerary, setItinerary] = useState<DayItinerary[]>([]);

  // UI state
  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Remove a user from the group (owner cannot be removed)
  const removeUser = (username: string) => {
    if (username === ownerUsername) return;
    setGroupPreferences((prev) => prev.filter((u) => u.username !== username));
  };

  /* ================= LOAD TRIP DATA FROM API ================= */

  useEffect(() => {
    const loadTripData = async () => {
      if (!tripId) {
        setErrorMsg("No trip ID found in URL");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Fetch trip details including days and items
        const tripData = await apiFetch(`/f1/trips/${tripId}/`, { 
          method: "GET" 
        });

        console.log("Loaded trip data:", tripData);

        // Set trip metadata
        if (tripData.start_date) {
          setStartDate(new Date(tripData.start_date));
        }
        
        if (tripData.days) {
          setTripDays(tripData.days.length);
        }

        // Convert backend data to DayItinerary format
        if (tripData.days && tripData.items) {
          const convertedDays: DayItinerary[] = tripData.days
            .sort((a: any, b: any) => a.day_index - b.day_index)
            .map((day: any) => {
              // Get all items for this specific day
              const dayItems = tripData.items
                .filter((item: any) => item.day === day.id)
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((item: any) => ({
                  time: item.start_time ? item.start_time.slice(11, 16) : "—",
                  title: item.title || "Unnamed activity",
                  location: item.address || "Location not specified",
                }));

              return {
                day: day.day_index,
                date: day.date ? formatDDMon(new Date(day.date)) : `Day ${day.day_index}`,
                items: dayItems,
              };
            });

          setItinerary(convertedDays);
          
          // Expand first day that has items
          const firstDayWithItems = convertedDays.find(d => d.items.length > 0);
          if (firstDayWithItems) {
            setExpandedDay(firstDayWithItems.day);
          }
        }

        setErrorMsg("");
      } catch (err: any) {
        console.error("Failed to load trip data:", err);
        setErrorMsg("Failed to load trip data. Using defaults.");
        
        // Fallback: create empty days
        const emptyDays: DayItinerary[] = [];
        for (let i = 0; i < tripDays; i++) {
          emptyDays.push({
            day: i + 1,
            date: formatDDMon(addDays(startDate, i)),
            items: [],
          });
        }
        setItinerary(emptyDays);
      } finally {
        setIsLoading(false);
      }
    };

    loadTripData();
  }, [tripId]);

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
            data.map((u: any) => ({
              username: u.username,
              preferences: u.preferences,
              isOwner: u.is_owner,
            }))
          );
        } else {
          // Fallback to demo data if no preferences found
          setGroupPreferences([
            { username: "You", preferences: ["Adventure", "Cultural Immersion"], isOwner: true },
          ]);
        }
      } catch (err) {
        console.error("Failed to load group preferences", err);
        // Use fallback data
        setGroupPreferences([
          { username: "You", preferences: ["Adventure", "Cultural Immersion"], isOwner: true },
        ]);
      }
    };

    fetchGroupPreferences();
  }, [tripId]);

  /* ================= AI GENERATION (SEALION) ================= */

  const generateAnotherPlan = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setErrorMsg("");

    try {
      // Build AI prompt with group preferences
      const prompt = `
You are an AI travel planner.

Task:
Generate a ${tripDays}-day itinerary based on this group's preferences.
Choose REAL attractions/places (not placeholders like "Morning Activity").
Keep each day to 3 time slots: 10:00, 15:00, 19:00.

Group preferences:
${groupPreferences.map((p) => `- ${p.username}: ${p.preferences.join(", ")}`).join("\n")}

Output MUST be EXACTLY in this format (no extra text before/after):

DAY 1:
10:00 - Place | Area
15:00 - Place | Area
19:00 - Place | Area

DAY 2:
10:00 - Place | Area
15:00 - Place | Area
19:00 - Place | Area

${tripDays > 2 ? `DAY 3:\n10:00 - Place | Area\n15:00 - Place | Area\n19:00 - Place | Area\n` : ""}
`.trim();

      // Call AI API
      const data = await apiFetch("/ai/test/", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });

      const text: string | undefined =
        data?.choices?.[0]?.message?.content ?? data?.reply;

      if (!text) {
        throw new Error("AI returned empty response.");
      }

      // Parse AI response into structured format
      const parsed = parseSealionToDays(text, tripDays, startDate);

      // Validate AI response
      const totalItems = parsed.reduce((sum, d) => sum + d.items.length, 0);
      if (totalItems === 0) {
        throw new Error("AI response format did not match the required template. Try again.");
      }

      setItinerary(parsed);
      setExpandedDay(1);
    } catch (err: any) {
      console.error("AI generation error:", err);
      setErrorMsg(err?.message ?? "Failed to generate. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  /* ================= STYLES ================= */

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(180deg, #eff3ff 0%, #ede8ff 45%, #d5e7ff 100%)",
      fontFamily: "Inter, sans-serif",
    },

    /* NAV */
    navOuter: {
      background: "#ffffff",
      borderBottom: "2px solid #d0d7ff",
      display: "flex",
      justifyContent: "center",
    },
    navInner: {
      width: "1400px",
      height: "70px",
      padding: "0 40px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    navRight: {
      display: "flex",
      gap: "28px",
      alignItems: "center",
      color: "#3b3b55",
      fontSize: "15px",
    },
    logoutBtn: {
      padding: "10px 20px",
      background: "#1e3a8a",
      color: "#fff",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
    },

    /* MAIN */
    container: {
      width: "1200px",
      margin: "0 auto",
      padding: "40px 0 120px",
    },

    title: {
      textAlign: "center",
      fontSize: "22px",
      fontWeight: 600,
      color: "#1e1e2f",
      marginBottom: "6px",
    },
    subtitle: {
      textAlign: "center",
      fontSize: "14px",
      color: "#6d6d8c",
      marginBottom: "30px",
    },

    card: {
      background: "#ffffff",
      borderRadius: "24px",
      padding: "24px 28px",
      border: "1px solid #dde3ff",
      boxShadow: "0px 6px 18px rgba(0,0,0,0.05)",
      marginBottom: "26px",
    },

    sectionTitle: {
      fontSize: "18px",
      fontWeight: 600,
      marginBottom: "16px",
    },

    preferenceRow: {
      display: "flex",
      alignItems: "center",
      padding: "10px 14px",
      background: "#f5f7ff",
      borderRadius: "12px",
      marginBottom: "10px",
      justifyContent: "space-between",
      fontSize: "14px",
    },

    prefRight: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    removeBtn: {
      width: "26px",
      height: "26px",
      borderRadius: "999px",
      border: "none",
      background: "rgba(0,0,0,0.06)",
      cursor: "pointer",
      lineHeight: "26px",
      textAlign: "center",
      fontSize: "14px",
    },

    itineraryHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "14px",
    },

    generateBtn: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
      fontWeight: 600,
      color: "#6b5cff",
      cursor: "pointer",
      userSelect: "none",
    },

    error: {
      marginTop: "10px",
      color: "#b91c1c",
      fontSize: "13px",
      background: "rgba(185, 28, 28, 0.08)",
      padding: "10px 12px",
      borderRadius: "12px",
      border: "1px solid rgba(185, 28, 28, 0.18)",
    },

    dayHeader: {
      background: "#f3f5ff",
      borderRadius: "14px",
      padding: "12px 16px",
      fontSize: "14px",
      fontWeight: 600,
      display: "flex",
      justifyContent: "space-between",
      cursor: "pointer",
      marginBottom: "10px",
      border: "1px solid #e6e9ff",
    },

    row: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      marginBottom: "14px",
      padding: "2px 6px",
    },

    time: {
      width: "60px",
      fontSize: "13px",
      color: "#6d6d8c",
    },

    itemTitle: {
      fontSize: "15px",
      fontWeight: 700,
      color: "#111827",
    },

    itemSub: {
      fontSize: "12px",
      color: "#7a7aa0",
      marginTop: "2px",
    },

    detailsBtn: {
      marginLeft: "auto",
      padding: "8px 16px",
      borderRadius: "999px",
      background: "#eef2ff",
      border: "none",
      color: "#4f46e5",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 600,
    },

    actionRow: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "12px",
      marginTop: "24px",
    },

    // Both buttons now use the same secondary style (white bg, blue border/text)
    btnSecondary: {
      padding: "10px 22px",
      borderRadius: "999px",
      border: "1px solid #d6dcff",
      background: "#ffffff",
      color: "#4f46e5",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
    },

    loading: {
      textAlign: "center",
      padding: "40px",
      fontSize: "14px",
      color: "#6d6d8c",
    },
  };

  /* ================= RENDER ================= */

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loading}>Loading trip data...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* MAIN CONTENT */}
      <div style={styles.container}>
        <div style={styles.title}>Your Group Itinerary is Ready!</div>
        <div style={styles.subtitle}>AI combined everyone's preferences into one trip plan</div>

        {/* Show error message if any */}
        {errorMsg && (
          <div style={styles.error}>
            {errorMsg}
          </div>
        )}

        {/* GROUP PREFERENCES SUMMARY */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Group Preferences Summary</div>

          {groupPreferences.length === 0 ? (
            <div style={{ color: "#7a7aa0", fontSize: "13px", padding: "6px" }}>
              No preferences loaded yet.
            </div>
          ) : (
            groupPreferences.map((p) => (
              <div key={p.username} style={styles.preferenceRow}>
                <strong>{p.username}</strong>

                <div style={styles.prefRight}>
                  <span>{p.preferences.join(", ")}</span>

                  {/* X button - only show for non-owner users */}
                  {p.username !== ownerUsername && (
                    <button
                      title="Remove user"
                      style={styles.removeBtn}
                      onClick={() => removeUser(p.username)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* DAILY ITINERARY */}
        <div style={styles.card}>
          <div style={styles.itineraryHeader}>
            <div style={styles.sectionTitle}>Daily Itinerary</div>

            {/* Generate another plan button */}
            <div
              style={{
                ...styles.generateBtn,
                opacity: isGenerating ? 0.6 : 1,
                pointerEvents: isGenerating ? "none" : "auto",
              }}
              onClick={generateAnotherPlan}
            >
              ✨ {isGenerating ? "Generating..." : "Generate another plan"}
            </div>
          </div>

          {/* Show itinerary or empty state */}
          {itinerary.length === 0 ? (
            <div style={{ color: "#7a7aa0", fontSize: "13px", padding: "6px" }}>
              No itinerary data available yet.
            </div>
          ) : (
            itinerary.map((day) => {
              const isOpen = expandedDay === day.day;

              return (
                <div key={day.day} style={{ marginBottom: "18px" }}>
                  {/* Day header (collapsible) */}
                  <div
                    style={styles.dayHeader}
                    onClick={() => setExpandedDay(isOpen ? 0 : day.day)}
                  >
                    <span>
                      DAY {day.day} · {day.date}
                    </span>
                    <span>{isOpen ? "⌃" : "⌄"}</span>
                  </div>

                  {/* Day content (shown when expanded) */}
                  {isOpen && (
                    <>
                      {day.items.length === 0 ? (
                        <div style={{ color: "#7a7aa0", fontSize: "13px", padding: "6px 6px 2px 6px" }}>
                          No activities scheduled for this day yet.
                        </div>
                      ) : (
                        day.items.map((item, idx) => (
                          <div key={idx} style={styles.row}>
                            {/* Time */}
                            <div style={styles.time}>{item.time}</div>

                            {/* Activity details */}
                            <div>
                              <div style={styles.itemTitle}>{item.title}</div>
                              <div style={styles.itemSub}>{item.location}</div>
                            </div>

                            {/* Details button */}
                            <button
                              style={styles.detailsBtn}
                              onClick={() => navigate("/discovery-local")}
                            >
                              Details
                            </button>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div style={styles.actionRow}>
          {/* Edit Itinerary button - navigate to itinerary editor */}
          <button
            style={styles.btnSecondary}
            onClick={() => {
              if (tripId) {
                navigate(`/trip/${tripId}/itinerary`);
              } else {
                setErrorMsg("No trip ID available. Cannot edit itinerary.");
              }
            }}
          >
            Edit Itinerary
          </button>

          {/* Confirm button - save trip and navigate to trips page */}
          <button
            style={styles.btnSecondary}  // Same style as Edit Itinerary button
            onClick={() => {
              console.log("Trip confirmed:", tripId);
              // Navigate to trips page after confirmation
              navigate("/trips");
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}