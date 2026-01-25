// frontend/src/pages/aiTripGeneratorStep2.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import SearchableSelect, { SelectOption } from "../components/SearchableSelect";
import countriesCities from "../data/countriesCities.json";

type ChipValue = string;
type CountryCitiesEntry = { name: string; cities: string[] };

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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isBetween(date: Date, start: Date, end: Date): boolean {
  const t = startOfDay(date).getTime();
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return t > s && t < e;
}
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  let d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d = new Date(year, month, d.getDate() + 1);
  }
  return days;
}

function toISODate(d: Date | null): string | null {
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AITripGeneratorStep2() {
  const navigate = useNavigate();

  /* -------------------- STATES -------------------- */
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const [durationDays, setDurationDays] = useState(3);

  const [preferredCountry, setPreferredCountry] = useState("");
  const [preferredCity, setPreferredCity] = useState("");

  const destinationOptions: ChipValue[] = [
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
  const [selectedDestinations, setSelectedDestinations] = useState<ChipValue[]>([]);

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

  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* -------------------- CHIP TOGGLE -------------------- */
  const toggleDestination = (opt: ChipValue) => {
    setErrorMsg(null);
    setSelectedDestinations((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  };
  const toggleActivity = (opt: ChipValue) => {
    setErrorMsg(null);
    setSelectedActivities((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  };

  /* -------------------- PREFERENCES BUILD -------------------- */
  const preferencesText = useMemo(() => {
    const lines: string[] = [];
    if (preferredCountry || preferredCity) {
      const location = [preferredCity, preferredCountry].filter(Boolean).join(", ");
      if (location) lines.push(`Preferred location: ${location}`);
    }
    if (selectedActivities.length) lines.push(`Activities/Interests: ${selectedActivities.join(", ")}`);
    if (selectedDestinations.length) lines.push(`Destination types: ${selectedDestinations.join(", ")}`);
    if (budgetMin || budgetMax) lines.push(`Budget range: ${budgetMin || "?"} - ${budgetMax || "?"}`);
    if (additionalInfo.trim()) lines.push(`Notes: ${additionalInfo.trim()}`);
    return lines.join("\n");
  }, [preferredCountry, preferredCity, selectedActivities, selectedDestinations, budgetMin, budgetMax, additionalInfo]);

  const countryCityData = countriesCities as CountryCitiesEntry[];
  const countryOptions = useMemo(() => {
    return countryCityData
      .map((c) => c.name)
      .filter(Boolean)
      .map((name) => ({ label: name, value: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [countryCityData]);

  const selectedCountryEntry = useMemo(() => {
    return countryCityData.find((c) => c.name === preferredCountry) ?? null;
  }, [countryCityData, preferredCountry]);

  const cityOptions: SelectOption[] = useMemo(() => {
    if (!selectedCountryEntry) return [];
    const seen = new Set<string>();
    const opts: SelectOption[] = [];
    for (const city of selectedCountryEntry.cities || []) {
      const trimmed = (city || "").trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push({ label: trimmed, value: trimmed });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedCountryEntry]);

  const selectedCountryOpt = preferredCountry ? { label: preferredCountry, value: preferredCountry } : null;
  const selectedCityOpt = preferredCity ? { label: preferredCity, value: preferredCity } : null;

  /* -------------------- STYLES (keep your current look) -------------------- */
  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      width: "100%",
      overflowX: "hidden",
      background: "linear-gradient(135deg, #eff3ff 0%, #ede8ff 32%, #d5e7ff 64%, #f4e9ff 100%)",
      backgroundSize: "400% 400%",
      animation: "gradientShift 16s ease infinite",
      fontFamily: "Inter, 'Plus Jakarta Sans', 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    },
    navOuter: { width: "100%", background: "#fff", borderBottom: "2px solid #d0d7ff", display: "flex", justifyContent: "center" },
    navInner: { width: "100%", maxWidth: "1400px", height: "70px", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    navRight: { display: "flex", gap: "28px", alignItems: "center", color: "#3b3b55", fontSize: "15px" },
    logoutBtn: { padding: "10px 20px", background: "#1e3a8a", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer" },
    container: { width: "1200px", padding: "40px 0px 120px 0px", boxSizing: "border-box", margin: "0 auto" },
    pageSub: { fontSize: "14px", color: "#6d6d8c", marginBottom: "6px" },
    pageTitle: { fontSize: "32px", fontWeight: 600, color: "#1e1e2f", marginBottom: "24px" },
    card: { background: "#fff", padding: "24px 28px", borderRadius: "18px", border: "1px solid #dde3ff", boxShadow: "0px 6px 18px rgba(0,0,0,0.05)", marginBottom: "24px" },
    twoColRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px", width: "100%" },
    row: { display: "flex", gap: "22px", alignItems: "stretch" },
    sectionTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" },
    sectionTitle: { fontSize: "18px", fontWeight: 600, color: "#2e2e3f" },
    sectionHint: { fontSize: "12px", color: "#9292aa" },
    dateBox: { flex: 1, background: "#f7f8ff", padding: "16px", borderRadius: "12px", border: "1px solid #d5ddff", cursor: "pointer" },
    sliderRow: { display: "flex", alignItems: "center", gap: "12px" },
    chipsContainer: { display: "flex", flexWrap: "wrap", gap: "10px" },
    chipBase: {
      padding: "8px 14px",
      borderRadius: "999px",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "#c5ccff",
      background: "#fff",
      fontSize: "13px",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
    chipSelected: {
      background: "#4f46e5",
      color: "#fff",
      borderColor: "#4f46e5",
      borderWidth: "1px",
      borderStyle: "solid",
      boxShadow: "0 6px 16px rgba(124,92,255,0.25)",
    },
    calendarPopup: {
      position: "absolute",
      top: "200px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "900px",
      background: "#fff",
      padding: "24px 28px",
      borderRadius: "20px",
      border: "1px solid #dfe3ff",
      boxShadow: "0px 18px 40px rgba(0,0,0,0.15)",
      zIndex: 500,
      display: "flex",
      gap: "30px",
    },
    closeBtn: { position: "absolute", top: "10px", right: "18px", border: "none", background: "transparent", fontSize: "22px", cursor: "pointer", color: "#666" },
    doneButton: {
      marginTop: "20px",
      padding: "12px 32px",
      borderRadius: "999px",
      background: "linear-gradient(135deg, #8b7cff 0%, #6b5cff 100%)",
      color: "#fff",
      border: "none",
      cursor: submitting ? "not-allowed" : "pointer",
      fontSize: "15px",
      fontWeight: 600,
      boxShadow: "0 6px 16px rgba(124, 92, 255, 0.35)",
      alignSelf: "flex-end",
      opacity: submitting ? 0.7 : 1,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      transition: "all 0.3s ease",
    },
    error: { marginTop: "10px", color: "#b91c1c", fontSize: "13px" },
  };

  /* -------------------- GLOBAL STYLES -------------------- */
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        25% { background-position: 25% 50%; }
        50% { background-position: 50% 50%; }
        75% { background-position: 75% 50%; }
        100% { background-position: 0% 50%; }
      }
      button:hover { transform: translateY(-2px); }
      button:active { transform: translateY(0); }
    `;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

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

    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: offset === 0 ? "space-between" : "center", alignItems: "center", marginBottom: "10px", fontWeight: 600, fontSize: "14px" }}>
          {offset === 0 ? (
            <button
              onClick={() => {
                let m = calendarMonth - 1;
                let y = calendarYear;
                if (m < 0) { m = 11; y -= 1; }
                setCalendarMonth(m); setCalendarYear(y);
              }}
              style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }}
            >
              ‹
            </button>
          ) : (
            <div style={{ width: "20px" }} />
          )}

          <div>
            {new Date(year, effMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>

          {offset === 1 ? (
            <button
              onClick={() => {
                let m = calendarMonth + 1;
                let y = calendarYear;
                if (m > 11) { m = 0; y += 1; }
                setCalendarMonth(m); setCalendarYear(y);
              }}
              style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }}
            >
              ›
            </button>
          ) : (
            <div style={{ width: "20px" }} />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", fontSize: "11px", color: "#a0a0b8", marginBottom: "6px" }}>
          {weekdayLabels.map((w) => (<div key={w} style={{ textAlign: "center" }}>{w}</div>))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: "8px" }}>
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} />;
            const isStart = startDate && isSameDay(date, startDate);
            const isEnd = endDate && isSameDay(date, endDate);
            const inRange = startDate && endDate && isBetween(date, startDate, endDate);

            let bg = "transparent";
            let color = "#333";
            if (isStart || isEnd) { bg = "#7c5cff"; color = "#fff"; }
            else if (inRange) { bg = "rgba(124, 92, 255, 0.15)"; }

            return (
              <div key={idx} onClick={() => handleDayClick(date)} style={{ display: "flex", justifyContent: "center", cursor: "pointer" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: bg, color, fontSize: "13px" }}>
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
  const handleGenerate = () => {
    setErrorMsg(null);

    // ---- basic validation (keep this) ----
    if (selectedActivities.length < 2) {
      setErrorMsg("Please select at least two Activities & Interests.");
      return;
    }
    if (selectedDestinations.length < 2) {
      setErrorMsg("Please select at least two Destination Types.");
      return;
    }

    const locationNote = [preferredCity, preferredCountry].filter(Boolean).join(", ");
    const mergedAdditionalInfo = [locationNote ? `Preferred location: ${locationNote}` : "", additionalInfo.trim()].filter(Boolean).join("\n");

    // ---- build payload (same shape as backend expects) ----
    const payload = {
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      duration_days: durationDays,

      activities: selectedActivities,
      destination_types: selectedDestinations,

      budget_min: budgetMin ? Number(budgetMin) : null,
      budget_max: budgetMax ? Number(budgetMax) : null,

      additional_info: mergedAdditionalInfo || "",
      preferences_text: preferencesText,
    };

    // ---- keywords for animation ----
    const keywords = [
      ...selectedActivities,
      ...selectedDestinations,
      preferredCity,
      preferredCountry,
    ].filter(Boolean).slice(0, 18);

    // ---- go to waiting screen ----
    navigate("/ai-trip-generator/wait", {
      state: {
        payload,
        keywords,
      },
    });
  };


  /* =======================================================
                           RENDER
  ======================================================= */
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.pageSub}>Share your preferences</div>
        <div style={styles.pageTitle}>AI Trip Generator</div>

        {/* Optional Country + City (for more specific suggestions) */}
        <div style={{ ...styles.card, marginBottom: "26px" }}>
          <div style={styles.sectionTitleRow}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <div style={styles.sectionTitle}>Preferred Country & City</div>
              <div style={{ ...styles.sectionHint, fontSize: "11px" }}>(Optional)</div>
            </div>
            <div style={styles.sectionHint}>Leave blank for our suggestions</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <SearchableSelect
              label="Country"
              placeholder="Search country..."
              value={selectedCountryOpt}
              options={countryOptions}
              onChange={(opt) => {
                const next = opt?.value ?? "";
                setPreferredCountry(next);
                if (next !== preferredCountry) setPreferredCity("");
              }}
            />
            <SearchableSelect
              label="City (optional)"
              placeholder={preferredCountry ? "Search city..." : "Select a country first..."}
              value={selectedCityOpt}
              options={cityOptions}
              disabled={!preferredCountry}
              onChange={(opt) => setPreferredCity(opt?.value ?? "")}
            />
          </div>
        </div>

        {/* 1. Estimated Travel Dates */}
        <div style={styles.card}>
          <div style={styles.sectionTitleRow}>
            <div style={styles.sectionTitle}>Estimated Travel Dates</div>
          </div>

          <div style={styles.row}>
            <div style={styles.dateBox} onClick={() => setCalendarOpen(true)}>
              <div style={{ fontSize: "11px", color: "#8c8ca0" }}>Start</div>
              <div style={{ fontSize: "15px", fontWeight: 500 }}>{formatDisplayDate(startDate)}</div>
            </div>

            <div style={styles.dateBox} onClick={() => setCalendarOpen(true)}>
              <div style={{ fontSize: "11px", color: "#8c8ca0" }}>End</div>
              <div style={{ fontSize: "15px", fontWeight: 500 }}>{formatDisplayDate(endDate)}</div>
            </div>
          </div>
        </div>

        {calendarOpen && (
          <div style={styles.calendarPopup}>
            <button style={styles.closeBtn} onClick={() => setCalendarOpen(false)}>×</button>
            {renderMonthGrid(0)}
            {renderMonthGrid(1)}
          </div>
        )}

        {/* 2. Travel Duration + Activities */}
        <div style={{ ...styles.twoColRow, marginBottom: "26px" }}>
          <div style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionTitle}>Travel Duration</div>
              <div style={styles.sectionHint}>min. 1 day - up to 21+ days</div>
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
                    style={{ ...styles.chipBase, ...(selected ? styles.chipSelected : {}) }}
                  >
                    ↠ {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Destination Type + Budget */}
        <div style={{ ...styles.twoColRow, marginBottom: "26px" }}>
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
                    style={{ ...styles.chipBase, ...(selected ? styles.chipSelected : {}) }}
                  >
                    ↠ {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionTitle}>Budget</div>
              <div style={{ fontSize: "12px", color: "#9292aa" }}>Optional</div>
            </div>

            <div style={{ display: "flex", gap: "20px", marginTop: "6px" }}>
              <div style={{ flex: 1, border: "1px solid #c7c7d1", borderRadius: "8px", padding: "10px 12px", background: "#fff" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Min</div>
                <input
                  type="number"
                  min={0}
                  step={1}
                  style={{ width: "100%", border: "none", outline: "none", fontSize: "14px", color: "#444" }}
                  placeholder="0"
                  value={budgetMin}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (isNaN(val)) {
                      setBudgetMin("");
                    } else {
                      setBudgetMin(String(Math.max(0, val)));
                    }
                  }}
                />
              </div>

              <div style={{ flex: 1, border: "1px solid #c7c7d1", borderRadius: "8px", padding: "10px 12px", background: "#fff" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Max</div>
                <input
                  type="number"
                  style={{ width: "100%", border: "none", outline: "none", fontSize: "14px", color: "#444" }}
                  placeholder="0"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Additional Information */}
        <div style={{ width: "100%", padding: "26px", borderRadius: "22px", background: "linear-gradient(135deg, #eef2ff 0%, #e3eaff 40%, #d8e6ff 100%)", boxShadow: "0px 8px 18px rgba(0,0,0,0.06)", marginBottom: "40px" }}>
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#1e1e2f", marginBottom: "6px" }}>Additional Information</div>
            <div style={{ fontSize: "14px", color: "#6b6bb0" }}>Write what comes to mind…</div>
          </div>

          <textarea
            style={{ width: "100%", height: "160px", borderRadius: "16px", padding: "14px 18px", border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(4px)", fontSize: "14px", color: "#2a2a3a", outline: "none", resize: "vertical", boxSizing: "border-box" }}
            placeholder="Tell TripMate anything special…"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
          />

          {errorMsg && <div style={styles.error}>{errorMsg}</div>}
        </div>

        {/* Generate button */}
        <div style={{ width: "1200px", display: "flex", justifyContent: "flex-end" }}>
          <button style={styles.doneButton} onClick={handleGenerate} disabled={submitting}>
            ✨ <span>{submitting ? "Generating..." : "Generate itinerary"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
