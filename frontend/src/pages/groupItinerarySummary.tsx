import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function formatDDMon(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Parse SeaLion text in the requested format.
 * Expected (example):
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

  // split by DAY X:
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
      // match "10:00 - Place | Area"
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

  // change these if you want
  const TRIP_DAYS = 3; // can be dynamic later
  const START_DATE = useMemo(() => new Date(2025, 9, 20), []); // 20 Oct 2025

  const [groupPreferences, setGroupPreferences] = useState<GroupPreference[]>([
    { username: "alice29", preferences: ["Food", "Temples"], isOwner: true },
    { username: "chris33", preferences: ["Museums", "Photography"] },
    { username: "cinderella08", preferences: ["Shopping", "Nature"] },
  ]);

  const ownerUsername = useMemo(
    () => groupPreferences.find((u) => u.isOwner)?.username ?? groupPreferences[0]?.username ?? "owner",
    [groupPreferences]
  );

  const [itinerary, setItinerary] = useState<DayItinerary[]>([
    {
      day: 1,
      date: formatDDMon(START_DATE),
      items: [
        { time: "10:00", title: "Bugis Street", location: "Bugis" },
        { time: "15:00", title: "Gardens by the Bay", location: "Marina Bay" },
        { time: "19:00", title: "Maxwell Food Centre", location: "Chinatown" },
      ],
    },
    { day: 2, date: formatDDMon(addDays(START_DATE, 1)), items: [] },
    { day: 3, date: formatDDMon(addDays(START_DATE, 2)), items: [] },
  ]);

  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const removeUser = (username: string) => {
    // owner cannot be removed
    if (username === ownerUsername) return;
    setGroupPreferences((prev) => prev.filter((u) => u.username !== username));
  };

  /* ================= SEALION CALL ================= */

  const generateAnotherPlan = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setErrorMsg("");

    try {
      const prompt = `
You are an AI travel planner.

Task:
Generate a ${TRIP_DAYS}-day Singapore itinerary based on this group's preferences.
Choose REAL attractions/places in Singapore (not placeholders like "Morning Activity").
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

DAY 3:
10:00 - Place | Area
15:00 - Place | Area
19:00 - Place | Area
`.trim();

      // Use the shared API client; keep this path distinct from chatbot (/api/ai/chat)
      const data = await apiFetch("/ai/test/", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });

      const text: string | undefined =
        data?.choices?.[0]?.message?.content ?? data?.reply;

      if (!text) {
        throw new Error("Sealion returned empty response.");
      }

      const parsed = parseSealionToDays(text, TRIP_DAYS, START_DATE);

      // if AI format is off and no items parsed, show message but keep UI stable
      const totalItems = parsed.reduce((sum, d) => sum + d.items.length, 0);
      if (totalItems === 0) {
        throw new Error("AI response format did not match the required template. Try again.");
      }

      setItinerary(parsed);
      setExpandedDay(1);
    } catch (err: any) {
      console.error("Sealion error:", err);
      setErrorMsg(err?.message ?? "Failed to generate. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // generate once on first load (optional; if you don’t want, remove this useEffect)
  useEffect(() => {
    const fetchGroupPreferences = async () => {
      try {
        const data = await apiFetch("/f2/trips/1/preferences/", { method: "GET" });

        if (Array.isArray(data) && data.length) {
          setGroupPreferences(
            data.map((u: any) => ({
              username: u.username,
              preferences: u.preferences,
              isOwner: u.is_owner,
            }))
          );
        }
        // if empty or not array, keep existing defaults
      } catch (err) {
        console.error("Failed to load group preferences", err);
        // keep existing defaults on error
      }
    };


  fetchGroupPreferences();
}, []);


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

    btnPrimary: {
      padding: "10px 22px",
      borderRadius: "999px",
      border: "none",
      background: "#eef2ff",
      color: "#4f46e5",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
    },

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
  };

  /* ================= RENDER ================= */

  return (
    <div style={styles.page}>
      {/* MAIN */}
      <div style={styles.container}>
        <div style={styles.title}>Your Group Itinerary is Ready!</div>
        <div style={styles.subtitle}>AI combined everyone’s preferences into one trip plan</div>

        {/* GROUP PREF SUMMARY */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Group Preferences Summary</div>

          {groupPreferences.map((p) => (
            <div key={p.username} style={styles.preferenceRow}>
              <strong>{p.username}</strong>

              <div style={styles.prefRight}>
                <span>{p.preferences.join(", ")}</span>

                {/* X button for non-owner */}
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
          ))}
        </div>

        {/* DAILY ITINERARY */}
        <div style={styles.card}>
          <div style={styles.itineraryHeader}>
            <div style={styles.sectionTitle}>Daily Itinerary</div>

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

          {errorMsg && <div style={styles.error}>{errorMsg}</div>}

          {itinerary.map((day) => {
            const isOpen = expandedDay === day.day;

            return (
              <div key={day.day} style={{ marginBottom: "18px" }}>
                <div
                  style={styles.dayHeader}
                  onClick={() => setExpandedDay(isOpen ? 0 : day.day)}
                >
                  <span>
                    DAY {day.day} · {day.date}
                  </span>
                  <span>{isOpen ? "⌃" : "⌄"}</span>
                </div>

                {isOpen && (
                  <>
                    {day.items.length === 0 ? (
                      <div style={{ color: "#7a7aa0", fontSize: "13px", padding: "6px 6px 2px 6px" }}>
                        No items generated for this day yet.
                      </div>
                    ) : (
                      day.items.map((item, idx) => (
                        <div key={idx} style={styles.row}>
                          <div style={styles.time}>{item.time}</div>

                          <div>
                            <div style={styles.itemTitle}>{item.title}</div>
                            <div style={styles.itemSub}>{item.location}</div>
                          </div>

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
          })}
        </div>

        {/* ACTION BUTTONS */}
        <div style={styles.actionRow}>
          <button
            style={styles.btnSecondary}
            onClick={() => navigate("/trip/:tripId/itinerary")}
          >
            Edit Itinerary
          </button>

          <button
            style={styles.btnPrimary}
            onClick={() => console.log("Confirmed")}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
