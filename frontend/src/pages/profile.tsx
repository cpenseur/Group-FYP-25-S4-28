// src/pages/profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ProfileData = {
  firstName: string;
  lastName: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  phone: string;
  email: string;
  nationality: string;
  address1: string;
  address2: string;
};

const EMPTY: ProfileData = {
  firstName: "",
  lastName: "",
  dobDay: "01",
  dobMonth: "01",
  dobYear: String(new Date().getFullYear() - 20),
  phone: "",
  email: "",
  nationality: "Singapore",
  address1: "",
  address2: "",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<ProfileData>(EMPTY);
  const [form, setForm] = useState<ProfileData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const userName = useMemo(() => {
    const full = `${form.firstName} ${form.lastName}`.trim();
    return full || "User";
  }, [form.firstName, form.lastName]);

  const userEmail = form.email || "";

  // dropdown lists (same as your component)
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
    return (Object.keys(initial) as (keyof ProfileData)[]).some((k) => initial[k] !== form[k]);
  }, [form, initial]);

  const setField = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const discard = () => setForm(initial);

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

      // Load from profiles table
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      // If table doesn't exist / RLS blocks, you'll see pErr in console
      if (pErr) console.error("Load profile error:", pErr);

      const loaded: ProfileData = {
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        dobDay: profile?.dob_day ?? "01",
        dobMonth: profile?.dob_month ?? "01",
        dobYear: profile?.dob_year ?? String(new Date().getFullYear() - 20),
        phone: profile?.phone ?? "",
        email,
        nationality: profile?.nationality ?? "Singapore",
        address1: profile?.address1 ?? "",
        address2: profile?.address2 ?? "",
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
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        nationality: form.nationality,
        address1: form.address1,
        address2: form.address2,
        dob_day: form.dobDay,
        dob_month: form.dobMonth,
        dob_year: form.dobYear,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setInitial(form); // makes dirty=false after save
      alert("Profile saved!");
    } catch (e: any) {
      alert(e?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = useMemo(() => {
    const parts = userName.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "U").toUpperCase();
  }, [userName]);

  if (loading) return null; // or your loader UI

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
          <section className="pf-panel">
            <div className="pf-panelTitle">Personal Information</div>

            <div className="pf-grid2">
              <div className="pf-field">
                <label className="pf-label">First Name</label>
                <input className="pf-input" value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} />
              </div>

              <div className="pf-field">
                <label className="pf-label">Last Name</label>
                <input className="pf-input" value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} />
              </div>

              <div className="pf-field">
                <label className="pf-label">Date of birth</label>
                <div className="pf-dob">
                  <select className="pf-select" value={form.dobDay} onChange={(e) => setField("dobDay", e.target.value)}>
                    {days.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>

                  <select className="pf-select" value={form.dobMonth} onChange={(e) => setField("dobMonth", e.target.value)}>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>

                  <select className="pf-select" value={form.dobYear} onChange={(e) => setField("dobYear", e.target.value)}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="pf-field">
                <label className="pf-label">Phone number</label>
                <input className="pf-input" placeholder="e.g., +1234567890" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
              </div>
            </div>
          </section>

          <section className="pf-panel">
            <div className="pf-panelTitle">Personal Address</div>

            <div className="pf-grid2">
              <div className="pf-field">
                <label className="pf-label">E-mail</label>
                {/* usually you should NOT allow changing auth email here */}
                <input className="pf-input" value={form.email} disabled />
              </div>

              <div className="pf-field">
                <label className="pf-label">Nationality</label>
                <select className="pf-select pf-selectFull" value={form.nationality} onChange={(e) => setField("nationality", e.target.value)}>
                  {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="pf-field">
                <label className="pf-label">Address 1</label>
                <input className="pf-input" value={form.address1} onChange={(e) => setField("address1", e.target.value)} />
              </div>

              <div className="pf-field">
                <label className="pf-label">Address 2</label>
                <input className="pf-input" placeholder="e.g., Apt 4B, Suite 205, Building 7" value={form.address2} onChange={(e) => setField("address2", e.target.value)} />
              </div>
            </div>
          </section>

          <div className="pf-actions">
            <button type="button" className="pf-btn pf-btnGhost" onClick={discard} disabled={!dirty || saving}>
              Discard
            </button>

            <button type="button" className="pf-btn pf-btnPrimary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </main>
      </div>

      {/* keep your CSS exactly the same (copied from your existing file) */}
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
          font-weight:700;
          font-size:14px;
          margin-bottom:14px;
          color:#111827;
        }
        .pf-grid2{
          display:grid;
          grid-template-columns: 1fr 1fr;
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
        .pf-input:focus, .pf-select:focus{
          border-color:#9ca3af;
          box-shadow: 0 0 0 3px rgba(156,163,175,0.25);
        }

        .pf-dob{
          display:grid;
          grid-template-columns: 1fr 1fr 1.4fr;
          gap:10px;
        }
        .pf-selectFull{ width:100%; }

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
        @media (max-width: 640px){
          .pf-grid2{ grid-template-columns: 1fr; }
          .pf-dob{ grid-template-columns: 1fr 1fr; }
          .pf-dob select:last-child{ grid-column: span 2; }
        }
      `}</style>
    </div>
  );
}
