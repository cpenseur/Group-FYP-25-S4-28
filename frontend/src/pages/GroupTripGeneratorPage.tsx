import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import tripmateLogo from "../assets/tripmate_logo.png";

type ChipValue = string;

/* ---------------- DATE HELPERS ---------------- */
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

  /* -------------------- STATES -------------------- */
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(0);
  const [calendarYear, setCalendarYear] = useState(2025);

  const [durationDays, setDurationDays] = useState(3);

  const destinationOptions: ChipValue[] = [
    "Tropical",
    "Mountains",
    "Cold/Winter",
    "Countryside",
    "Urban",
  ];
  const [selectedDestinations, setSelectedDestinations] = useState<ChipValue[]>([
    "Tropical",
    "Countryside",
  ]);

  const activityOptions: ChipValue[] = [
    "Luxury/Shopping",
    "Adventure",
    "Wellness",
    "Cultural Immersion",
    "Culinary",
    "Sightseeing",
  ];
  const [selectedActivities, setSelectedActivities] = useState<ChipValue[]>([
    "Adventure",
    "Cultural Immersion",
  ]);

  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  /* -------------------- CHIP TOGGLE -------------------- */
  const toggleDestination = (opt: ChipValue) => {
    setSelectedDestinations((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    );
  };

  const toggleActivity = (opt: ChipValue) => {
    setSelectedActivities((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    );
  };

  /* -------------------- STYLES -------------------- */

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      width: "100%",
      overflowX: "hidden",
      background:
        "linear-gradient(180deg, #eff3ff 0%, #ede8ff 45%, #d5e7ff 100%)",
      fontFamily: "Inter, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },

    /* NAVBAR */
    navOuter: {
      width: "100%",
      background: "#ffffff",
      borderBottom: "2px solid #d0d7ff",
      display: "flex",
      justifyContent: "center",
    },

    navInner: {
      width: "100%",
      maxWidth: "1400px",
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
      color: "#ffffff",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
    },

    /* MAIN CONTAINER — 1200px FIXED LAYOUT */
    container: {
      width: "1200px",
      padding: "40px 0px 120px 0px",
      boxSizing: "border-box",
      margin: "0 auto",
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
    },

    chipSelected: {
      background: "#4f46e5",
      color: "#ffffff",
      borderColor: "#4f46e5",
    },

    budgetInput: {
      width: "100%",
      height: "40px",
      padding: "6px 10px",
      borderRadius: "6px",
      border: "1px solid #c7c7d1",
      background: "#ffffff",
      fontSize: "13px",
      outline: "none",
    },

    textarea: {
      width: "100%",
      minHeight: "120px",
      padding: "12px 14px",
      borderRadius: "16px",
      border: "1px solid #d0d5ff",
      fontSize: "14px",
      resize: "vertical",
    },


/* done button */
    doneButton: {
      marginTop: "20px",
      padding: "10px 26px",
      borderRadius: "999px",

      background: "linear-gradient(135deg, #8b7cff 0%, #6b5cff 100%)",

      color: "#ffffff",
      border: "none",
      cursor: "pointer",

      fontSize: "15px",
      fontWeight: 600,

      boxShadow: "0 6px 16px rgba(124, 92, 255, 0.35)",

      alignSelf: "flex-end",

      transition: "transform 0.15s ease, box-shadow 0.15s ease",
    },


    /* Calendar Popup */
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
  };

  /* ----------------------------------------------------
                      CALENDAR LOGIC
  ---------------------------------------------------- */

  const handleDayClick = (date: Date) => {
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

    setTimeout(() => {
      setCalendarOpen(false);
    }, 200);
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

    return (
      <div style={{ flex: 1 }}>
        {/* Header */}
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
                if (m < 0) {
                  m = 11;
                  y -= 1;
                }
                setCalendarMonth(m);
                setCalendarYear(y);
              }}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "20px",
                cursor: "pointer",
              }}
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
                if (m > 11) {
                  m = 0;
                  y += 1;
                }
                setCalendarMonth(m);
                setCalendarYear(y);
              }}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "20px",
                cursor: "pointer",
              }}
            >
              ›
            </button>
          ) : (
            <div style={{ width: "20px" }} />
          )}
        </div>

        {/* Weekday Row */}
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
            <div key={w} style={{ textAlign: "center" }}>
              {w}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            rowGap: "8px",
          }}
        >
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} />;

            const isStart = startDate && isSameDay(date, startDate);
            const isEnd = endDate && isSameDay(date, endDate);
            const inRange =
              startDate && endDate && isBetween(date, startDate, endDate);

            let bg = "transparent";
            let color = "#333";

            if (isStart || isEnd) {
              bg = "#7c5cff";
              color = "#ffffff";
            } else if (inRange) {
              bg = "rgba(124, 92, 255, 0.15)";
            }

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(date)}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
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

  /* ----------------------------------------------------
                        SUBMIT HANDLER
  ---------------------------------------------------- */
    // ---------- BUILD PREFERENCES (3.2) ----------
  const buildPreferencesArray = () => {
    const prefs: string[] = [];

    // activities
    selectedActivities.forEach((a) => prefs.push(a));

    // destination types
    selectedDestinations.forEach((d) => prefs.push(d));

    // additional info
    if (additionalInfo.trim()) {
      prefs.push(`Note: ${additionalInfo.trim()}`);
    }

    return prefs;
  };


    const handleDone = async () => {
    const preferences = buildPreferencesArray();

    const tripId = 1;   // demo
    const userId = 1;   // demo

    try {
      await fetch(`http://127.0.0.1:8000/api/f1/trips/${tripId}/preferences/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          preferences: preferences,
          start_date: startDate
            ? startDate.toISOString().split("T")[0]
            : null,
          end_date: endDate
            ? endDate.toISOString().split("T")[0]
            : null,
          budget_max: budgetMax ? Number(budgetMax) : null,
        }),
      });

      // go to waiting page
      navigate("/group-wait-for-friends");
    } catch (err) {
      console.error("Failed to save preferences", err);
      alert("Failed to save preferences. Please try again.");
    }
  };



  /* =======================================================
                           RENDER
  ======================================================= */

  return (
    <div style={styles.page}>
      {/* NAVBAR */}
      <div style={styles.navOuter}>
        <div style={styles.navInner}>
          <img
            src={tripmateLogo}
            alt="TripMate"
            style={{ height: "150px", objectFit: "contain" }}
          />

          <div style={styles.navRight}>
            <span style={{ cursor: "pointer" }}onClick={() => navigate("/dashboard")}>Dashboard</span>
            <span>Trips</span>
            <span>Explore</span>
            <span>Profile</span>
            <button style={styles.logoutBtn}>Log Out</button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={styles.container}>
        <div style={styles.pageSub}>Share your preferences</div>
        <div style={styles.pageTitle}>AI Trip Generator</div>

        {/* 1. Estimated Travel Dates */}
        <div style={styles.card}>
          <div style={styles.sectionTitleRow}>
            <div style={styles.sectionTitle}>Estimated Travel Dates</div>
          </div>

          <div style={styles.row}>
            <div style={styles.dateBox} onClick={() => setCalendarOpen(true)}>
              <div style={{ fontSize: "11px", color: "#8c8ca0" }}>Start</div>
              <div style={{ fontSize: "15px", fontWeight: 500 }}>
                {formatDisplayDate(startDate)}
              </div>
            </div>

            <div style={styles.dateBox} onClick={() => setCalendarOpen(true)}>
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
            <button
              style={styles.closeBtn}
              onClick={() => setCalendarOpen(false)}
            >
              ×
            </button>

            {renderMonthGrid(0)}
            {renderMonthGrid(1)}
          </div>
        )}

        {/* 2. TRAVEL DURATION + ACTIVITIES */}
        <div style={{ ...styles.twoColRow, marginBottom: "26px" }}>
          {/* LEFT — Travel Duration */}
          <div style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionTitle}>Travel Duration</div>
              <div style={styles.sectionHint}>
                min. 1 day — up to 21+ days
              </div>
            </div>

            <div style={styles.sliderRow}>
              <span style={{ fontSize: "11px" }}>min. 1 day</span>

              <input
                type="range"
                min={1}
                max={21}
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value))}
                style={{ flex: 1 }}
              />

              <span style={{ fontSize: "11px" }}>21+ days</span>
              <span style={{ fontSize: "12px" }}>{durationDays} days</span>
            </div>
          </div>

          {/* RIGHT — Activities */}
          <div style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionTitle}>Activities & Interests</div>
              <div style={styles.sectionHint}>Select at least two</div>
            </div>

            <div style={styles.chipsContainer}>
              {activityOptions.map((opt) => {
                const selected = selectedActivities.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleActivity(opt)}
                    style={{
                      ...styles.chipBase,
                      ...(selected ? styles.chipSelected : {}),
                    }}
                  >
                    ↠ {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. DESTINATION TYPE + BUDGET */}
        <div style={{ ...styles.twoColRow, marginBottom: "26px" }}>
          {/* LEFT — Destination Type */}
          <div style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionTitle}>Destination Type</div>
              <div style={styles.sectionHint}>Select at least two</div>
            </div>

            <div style={styles.chipsContainer}>
              {destinationOptions.map((opt) => {
                const selected = selectedDestinations.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleDestination(opt)}
                    style={{
                      ...styles.chipBase,
                      ...(selected ? styles.chipSelected : {}),
                    }}
                  >
                    ↠ {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT — Budget */}
          <div style={styles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <div style={styles.sectionTitle}>Budget</div>

              {/* info icon */}
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  border: "1px solid #bbb",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#555",
                  cursor: "default",
                }}
              >
                i
              </div>
            </div>

            {/* two small rectangular input boxes */}
            <div style={{ display: "flex", gap: "20px", marginTop: "6px" }}>
              {/* Min box */}
              <div
                style={{
                  flex: 1,
                  border: "1px solid #c7c7d1",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "4px",
                  }}
                >
                  Min
                </div>
                <input
                  type="number"
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontSize: "14px",
                    color: "#444",
                  }}
                  placeholder="0$"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
              </div>

              {/* Max box */}
              <div
                style={{
                  flex: 1,
                  border: "1px solid #c7c7d1",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "4px",
                  }}
                >
                  Max
                </div>
                <input
                  type="number"
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontSize: "14px",
                    color: "#444",
                  }}
                  placeholder="0$"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. (AI Preferences Hidden) */}
        {/* <div style={styles.card}>...</div> */}

        {/* 5. ADDITIONAL INFORMATION */}
        <div
          style={{
            width: "100%",
            padding: "26px",
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, #eef2ff 0%, #e3eaff 40%, #d8e6ff 100%)",
            boxShadow: "0px 8px 18px rgba(0,0,0,0.06)",
            marginBottom: "40px",
          }}
        >
          {/* Title + hint */}
          <div style={{ marginBottom: "14px" }}>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#1e1e2f",
                marginBottom: "6px",
              }}
            >
              Additional Information
            </div>

            <div style={{ fontSize: "14px", color: "#6b6bb0" }}>
              Write what comes to mind…
            </div>
          </div>

          {/* Textarea */}
          <textarea
            style={{
              width: "100%",
              height: "160px",
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
            placeholder="Tell TripMate anything special…"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
          />
        </div>

        {/* 6. DONE BUTTON (bottom right) */}
        <div style={{ width: "1200px", display: "flex", justifyContent: "flex-end" }}>
          <button
            style={styles.doneButton}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onClick={handleDone}
          >
          ✨<span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
