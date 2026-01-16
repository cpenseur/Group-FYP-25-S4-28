// src/pages/profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * ✅ This version MATCHES your current DB schema exactly:
 * public.profiles columns:
 * - id
 * - name
 * - location
 * - dob_day, dob_month, dob_year
 * - phone
 * - nationality
 * - address1, address2
 * - interests (text[])
 * - travel_pace (text)
 * - budget_level (text)
 * - diet_preference (text)
 * - mobility_needs (text)
 * - onboarding_completed (bool)
 * - updated_at
 */

type ProfileData = {
  // basic info
  name: string;
  location: string;

  // optional birthday
  dobDay: string;
  dobMonth: string;
  dobYear: string;

  // optional phone
  phone: string;

  // read-only from auth
  email: string;

  // address-ish
  nationality: string;
  address1: string;
  address2: string;

  // preferences
  interests: string[];
  travelPace: string; // relaxed | moderate | packed
  budgetLevel: string; // budget | mid | luxury
  dietPreference: string; // vegetarian | vegan | halal | kosher | gluten_free | none
  mobilityNeeds: string; // free text
};

const EMPTY: ProfileData = {
  name: "",
  location: "",

  dobDay: "01",
  dobMonth: "01",
  dobYear: String(new Date().getFullYear() - 20),

  phone: "",
  email: "",

  nationality: "Singapore",
  address1: "",
  address2: "",

  interests: [],
  travelPace: "",
  budgetLevel: "",
  dietPreference: "none",
  mobilityNeeds: "",
};

const INTERESTS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "arts", label: "Arts & Culture", emoji: "🎨" },
  { key: "nature", label: "Nature & Outdoors", emoji: "🌿" },
  { key: "food", label: "Food & Dining", emoji: "🍜" },
  { key: "shopping", label: "Shopping", emoji: "🛍️" },
  { key: "history", label: "History", emoji: "🏛️" },
  { key: "adventure", label: "Adventure", emoji: "🧗" },
  { key: "nightlife", label: "Nightlife", emoji: "🎉" },
  { key: "relaxation", label: "Relaxation", emoji: "🧘" },
];

const DIETS: Array<{ key: string; label: string }> = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "halal", label: "Halal" },
  { key: "kosher", label: "Kosher" },
  { key: "gluten_free", label: "Gluten-free" },
  { key: "none", label: "None" },
];

const PACE_OPTIONS = ["relaxed", "moderate", "packed"];
const BUDGET_OPTIONS = ["budget", "mid", "luxury"];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<ProfileData>(EMPTY);
  const [form, setForm] = useState<ProfileData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const userName = form.name.trim() || "User";
  const userEmail = form.email || "";

  // dropdown lists
  const days = useMemo(
    () => Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")),
    []
  );
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    []
  );
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const start = now - 90;
    const end = now - 10;
    const list: string[] = [];
    for (let y = end; y >= start; y--) list.push(String(y));
    return list;
  }, []);

  const nationalities = useMemo(
    () => ["Singapore", "Malaysia", "Indonesia", "Thailand", "Philippines", "Vietnam", "Other"],
    []
  );

  const dirty = useMemo(() => {
    return (Object.keys(initial) as (keyof ProfileData)[]).some((k) => {
      const a = initial[k];
      const b = form[k];
      if (Array.isArray(a) && Array.isArray(b)) return a.join("|") !== b.join("|");
      return a !== b;
    });
  }, [form, initial]);

  const setField = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const discard = () => setForm(initial);

  const toggleInterest = (key: string) => {
    setForm((prev) => {
      const next = prev.interests.includes(key)
        ? prev.interests.filter((x) => x !== key)
        : [...prev.interests, key];
      return { ...prev, interests: next };
    });
  };

  const setDiet = (dietKey: string) => {
    // single-select stored as text in diet_preference
    setField("dietPreference", dietKey);
  };

  // ✅ load profile on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error || !data.session) {
        navigate("/signin", { replace: true });
        return;
      }

      const user = data.session.user;
      const email = (user.email ?? "").toLowerCase();

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (pErr) console.error("Load profile error:", pErr);

      const loaded: ProfileData = {
        name: profile?.name ?? "",
        location: profile?.location ?? "",

        dobDay: profile?.dob_day ?? "01",
        dobMonth: profile?.dob_month ?? "01",
        dobYear: profile?.dob_year ?? String(new Date().getFullYear() - 20),

        phone: profile?.phone ?? "",
        email,

        nationality: profile?.nationality ?? "Singapore",
        address1: profile?.address1 ?? "",
        address2: profile?.address2 ?? "",

        interests: Array.isArray(profile?.interests) ? profile.interests : [],
        travelPace: profile?.travel_pace ?? "",
        budgetLevel: profile?.budget_level ?? "",
        dietPreference: profile?.diet_preference ?? "none",
        mobilityNeeds: profile?.mobility_needs ?? "",
      };

      setInitial(loaded);
      setForm(loaded);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const save = async () => {
    try {
      setSaving(true);

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,

        name: form.name || null,
        location: form.location || null,

        dob_day: form.dobDay || null,
        dob_month: form.dobMonth || null,
        dob_year: form.dobYear || null,

        phone: form.phone || null,
        nationality: form.nationality || null,
        address1: form.address1 || null,
        address2: form.address2 || null,

        interests: form.interests,
        travel_pace: form.travelPace || null,
        budget_level: form.budgetLevel || null,
        diet_preference: form.dietPreference || null,
        mobility_needs: form.mobilityNeeds || null,

        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setInitial(form);
      alert("Profile saved!");
    } catch (e: any) {
      alert(e?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = useMemo(() => {
    const parts = userName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "U";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
  }, [userName]);

  if (loading) return null;

  return (
    <div className="pf-page">
      <div className="pf-shell">
        {/* Left profile card */}
        <aside className="pf-aside">
          <div className="pf-card">
            <div className="pf-avatar">{initials}</div>
            <div className="pf-cardText">
              <div className="pf-name">{userName}</div>
              <div className="pf-email">{userEmail}</div>
            </div>
          </div>
        </aside>

        {/* Main form */}
        <main className="pf-main">
          {/* BASIC INFO */}
          <section className="pf-panel">
            <div className="pf-panelTitle">Profile Settings</div>

            <div className="pf-panelSubTitle">Basic Information</div>

            <div className="pf-grid2">
              <div className="pf-field">
                <label className="pf-label">Name</label>
                <input
                  className="pf-input"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="pf-field">
                <label className="pf-label">Location</label>
                <input
                  className="pf-input"
                  value={form.location}
                  onChange={(e) => setField("location", e.target.value)}
                  placeholder="City, Country"
                />
              </div>

              <div className="pf-field">
                <label className="pf-label">Birthday (Optional)</label>
                <div className="pf-dob">
                  <select className="pf-select" value={form.dobDay} onChange={(e) => setField("dobDay", e.target.value)}>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <select className="pf-select" value={form.dobMonth} onChange={(e) => setField("dobMonth", e.target.value)}>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select className="pf-select" value={form.dobYear} onChange={(e) => setField("dobYear", e.target.value)}>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pf-field">
                <label className="pf-label">Phone (Optional)</label>
                <input
                  className="pf-input"
                  placeholder="e.g., +1234567890"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* TRAVEL PREFERENCES */}
          <section className="pf-panel">
            <div className="pf-panelSubTitle">Travel Preferences</div>

            <div className="pf-field" style={{ marginBottom: 12 }}>
              <label className="pf-label">Interests</label>
              <div className="pf-chips">
                {INTERESTS.map((it) => {
                  const selected = form.interests.includes(it.key);
                  return (
                    <button
                      key={it.key}
                      type="button"
                      className={`pf-chip ${selected ? "pf-chipOn" : ""}`}
                      onClick={() => toggleInterest(it.key)}
                      aria-pressed={selected}
                    >
                      <span className="pf-chipEmoji">{it.emoji}</span>
                      {it.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pf-grid3">
              <div className="pf-field">
                <label className="pf-label">Travel Pace</label>
                <select
                  className="pf-select pf-selectFull"
                  value={form.travelPace}
                  onChange={(e) => setField("travelPace", e.target.value)}
                >
                  <option value="">Select...</option>
                  {PACE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pf-field">
                <label className="pf-label">Budget Level</label>
                <select
                  className="pf-select pf-selectFull"
                  value={form.budgetLevel}
                  onChange={(e) => setField("budgetLevel", e.target.value)}
                >
                  <option value="">Select...</option>
                  {BUDGET_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v === "mid" ? "Mid-range" : v[0].toUpperCase() + v.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pf-field">
                <label className="pf-label">Diet Preference</label>
                <select
                  className="pf-select pf-selectFull"
                  value={form.dietPreference}
                  onChange={(e) => setDiet(e.target.value)}
                >
                  {DIETS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* PRACTICAL PREFERENCES */}
          <section className="pf-panel">
            <div className="pf-panelSubTitle">Practical Preferences</div>

            <div className="pf-field">
              <label className="pf-label">Accessibility / Mobility Needs</label>
              <textarea
                className="pf-textarea"
                placeholder="e.g., wheelchair accessible, avoid stairs, etc."
                value={form.mobilityNeeds}
                onChange={(e) => setField("mobilityNeeds", e.target.value)}
              />
            </div>
          </section>

          {/* ADDRESS (kept from your original) */}
          <section className="pf-panel">
            <div className="pf-panelSubTitle">Personal Address</div>

            <div className="pf-grid2">
              <div className="pf-field">
                <label className="pf-label">E-mail</label>
                <input className="pf-input" value={form.email} disabled />
              </div>

              <div className="pf-field">
                <label className="pf-label">Nationality</label>
                <select
                  className="pf-select pf-selectFull"
                  value={form.nationality}
                  onChange={(e) => setField("nationality", e.target.value)}
                >
                  {nationalities.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pf-field">
                <label className="pf-label">Address 1</label>
                <input
                  className="pf-input"
                  value={form.address1}
                  onChange={(e) => setField("address1", e.target.value)}
                />
              </div>

              <div className="pf-field">
                <label className="pf-label">Address 2</label>
                <input
                  className="pf-input"
                  placeholder="e.g., Apt 4B, Suite 205, Building 7"
                  value={form.address2}
                  onChange={(e) => setField("address2", e.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="pf-actions">
            <button type="button" className="pf-btn pf-btnGhost" onClick={discard} disabled={!dirty || saving}>
              Cancel
            </button>

            <button type="button" className="pf-btn pf-btnPrimary" onClick={save} disabled={saving || !dirty}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </main>
      </div>

      <style>{`
        .pf-page{
          min-height: 100vh;
          background:#f4f5f7;
          padding:24px;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
          color:#1f2937;
        }
        .pf-shell{
          max-width: 980px;
          margin: 0 auto;
          display:grid;
          grid-template-columns: 240px 1fr;
          gap: 20px;
          align-items:start;
        }
        .pf-card{
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:10px;
          padding:14px;
          display:flex;
          gap:12px;
          align-items:center;
        }
        .pf-avatar{
          width:44px;height:44px;border-radius:999px;
          background:#b9c2cc;
          display:grid;place-items:center;
          font-weight:700;color:#fff;
        }
        .pf-name{ font-weight:700; font-size:14px; line-height:1.2; }
        .pf-email{ font-size:12px; color:#6b7280; margin-top:2px; }

        .pf-main{ display:flex; flex-direction:column; gap:18px; }
        .pf-panel{
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:10px;
          padding:16px;
        }
        .pf-panelTitle{
          font-weight:800;
          font-size:18px;
          margin-bottom:14px;
          color:#111827;
        }
        .pf-panelSubTitle{
          font-weight:700;
          font-size:14px;
          margin-bottom:12px;
          color:#111827;
        }

        .pf-grid2{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 18px;
        }
        .pf-grid3{
          display:grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px 18px;
        }

        .pf-field{ display:flex; flex-direction:column; gap:6px; }
        .pf-label{ font-size:12px; color:#6b7280; }

        .pf-input, .pf-select{
          height:38px;
          border:1px solid #d1d5db;
          border-radius:8px;
          padding: 0 12px;
          outline:none;
          background:#fff;
          font-size:14px;
        }
        .pf-input:focus, .pf-select:focus, .pf-textarea:focus{
          border-color:#9ca3af;
          box-shadow: 0 0 0 3px rgba(156,163,175,0.25);
        }

        .pf-dob{
          display:grid;
          grid-template-columns: 1fr 1fr 1.4fr;
          gap:10px;
        }
        .pf-selectFull{ width:100%; }

        .pf-chips{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
        }
        .pf-chip{
          border:1px solid #d1d5db;
          background:#fff;
          border-radius:999px;
          padding:8px 12px;
          font-size:13px;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap:8px;
          user-select:none;
        }
        .pf-chipOn{
          border-color:#2563eb;
          background:rgba(37,99,235,0.08);
        }
        .pf-chipEmoji{ font-size:14px; }

        .pf-textarea{
          border:1px solid #d1d5db;
          border-radius:8px;
          padding:10px 12px;
          min-height: 90px;
          resize: vertical;
          outline:none;
          font-size:14px;
          background:#fff;
        }

        .pf-actions{
          display:flex;
          justify-content:flex-end;
          gap:12px;
          padding-top:6px;
        }
        .pf-btn{
          height:40px;
          padding:0 18px;
          border-radius:10px;
          border:1px solid transparent;
          font-weight:600;
          font-size:14px;
          cursor:pointer;
        }
        .pf-btn:disabled{ opacity:0.6; cursor:not-allowed; }

        .pf-btnGhost{
          background:#fff;
          border-color:#d1d5db;
          color:#6b7280;
        }
        .pf-btnPrimary{
          background:#123a63;
          color:#fff;
        }

        @media (max-width: 900px){
          .pf-shell{ grid-template-columns: 1fr; }
          .pf-aside{ order: -1; }
        }
        @media (max-width: 820px){
          .pf-grid3{ grid-template-columns: 1fr; }
        }
        @media (max-width: 640px){
          .pf-grid2{ grid-template-columns: 1fr; }
          .pf-dob{ grid-template-columns: 1fr 1fr; }
          .pf-dob select:last-child{ grid-column: span 2; }
        }
      `}</style>
    </div>
  );
}
