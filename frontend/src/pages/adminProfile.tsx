// src/pages/adminProfile.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import AdminNavbar from "../components/adminNavbar";
import AdminSidebar from "../components/adminSidebar";

type AdminProfileData = {
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  createdAt: string;
};

const EMPTY: AdminProfileData = {
  name: "",
  email: "",
  phone: "",
  role: "",
  status: "",
  createdAt: "",
};

export default function AdminProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<AdminProfileData>(EMPTY);
  const [form, setForm] = useState<AdminProfileData>(EMPTY);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const dirty = useMemo(() => {
    return (Object.keys(initial) as (keyof AdminProfileData)[]).some((k) => {
      return initial[k] !== form[k];
    });
  }, [form, initial]);

  const setField = <K extends keyof AdminProfileData>(key: K, value: AdminProfileData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const discard = () => setForm(initial);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      const user = data.session?.user;

      if (error || !user) {
        navigate("/signin", { replace: true });
        return;
      }

      // Check admin role from DB
      const { data: appUser, error: appErr } = await supabase
        .from("app_user")
        .select("id, email, role, status, created_at")
        .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
        .maybeSingle();

      if (appErr || !appUser) {
        navigate("/signin", { replace: true });
        return;
      }

      const role = appUser.role?.toLowerCase();
      const status = appUser.status?.toLowerCase();

      if (role !== "admin" || (status !== "active" && status !== "verified")) {
        navigate("/signin", { replace: true });
        return;
      }

      // Get profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("id", user.id)
        .maybeSingle();

      const loaded: AdminProfileData = {
        name: profile?.name ?? "",
        email: appUser.email ?? user.email ?? "",
        phone: profile?.phone ?? "",
        role: appUser.role ?? "admin",
        status: appUser.status ?? "active",
        createdAt: appUser.created_at ?? "",
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
        navigate("/signin", { replace: true });
        return;
      }

      // Update profiles table
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        name: form.name || null,
        phone: form.phone || null,
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
    const name = form.name.trim() || "Admin";
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] ?? "A";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
  }, [form.name]);

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) return null;

  return (
    <>
      <AdminNavbar
        onProfileClick={() => {}}
        onLogoutClick={async () => {
          await supabase.auth.signOut();
          navigate("/signin", { replace: true });
        }}
      />

      <div className="admin-shell">
        <AdminSidebar
          activeSidebarItem="dashboard"
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          onSelect={(item) => {
            if (item === "dashboard") navigate("/admin-dashboard");
          }}
        />

        <main className="admin-main">
          <div className="ap-page">
            <div className="ap-shell">
              {/* Left profile card */}
              <aside className="ap-aside">
                <div className="ap-card">
                  <div className="ap-avatar">{initials}</div>
                  <div className="ap-cardText">
                    <div className="ap-name">{form.name || "Admin User"}</div>
                    <div className="ap-email">{form.email}</div>
                    <div className="ap-role-badge">{form.role.toUpperCase()}</div>
                  </div>
                </div>

                <div className="ap-info-card">
                  <div className="ap-info-row">
                    <span className="ap-info-label">Status</span>
                    <span className={`ap-status-badge ${form.status}`}>
                      {form.status}
                    </span>
                  </div>
                  <div className="ap-info-row">
                    <span className="ap-info-label">Member Since</span>
                    <span className="ap-info-value">{formatDate(form.createdAt)}</span>
                  </div>
                </div>
              </aside>

              {/* Main form */}
              <div className="ap-main">
                <section className="ap-panel">
                  <div className="ap-panelTitle">Admin Profile Settings</div>

                  <div className="ap-panelSubTitle">Account Information</div>

                  <div className="ap-grid2">
                    <div className="ap-field">
                      <label className="ap-label">Name</label>
                      <input
                        className="ap-input"
                        value={form.name}
                        onChange={(e) => setField("name", e.target.value)}
                        placeholder="Your name"
                      />
                    </div>

                    <div className="ap-field">
                      <label className="ap-label">Email</label>
                      <input className="ap-input" value={form.email} disabled />
                    </div>

                    <div className="ap-field">
                      <label className="ap-label">Phone (Optional)</label>
                      <input
                        className="ap-input"
                        placeholder="e.g., +1234567890"
                        value={form.phone}
                        onChange={(e) => setField("phone", e.target.value)}
                      />
                    </div>

                    <div className="ap-field">
                      <label className="ap-label">Role</label>
                      <input className="ap-input" value={form.role} disabled />
                    </div>
                  </div>
                </section>

                <div className="ap-actions">
                  <button
                    type="button"
                    className="ap-btn ap-btnGhost"
                    onClick={discard}
                    disabled={!dirty || saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="ap-btn ap-btnPrimary"
                    onClick={save}
                    disabled={saving || !dirty}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        :root {
          --bg: #f3f5fb;
          --sidebar-bg: #ffffff;
          --card-bg: #ffffff;
          --accent: #2563eb;
          --accent-soft: #e0ecff;
          --text-main: #111827;
          --text-muted: #6b7280;
          --border-subtle: #e5e7eb;
          --shadow-soft: 0 10px 30px rgba(15, 23, 42, 0.08);
          --radius-lg: 18px;
          --radius-md: 14px;
          --radius-pill: 999px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
        }

        body {
          margin: 0;
          background: #e5e7eb;
        }

        .admin-shell {
          display: flex;
          min-height: 100vh;
          background: linear-gradient(135deg, #dde4ff, #f5f7fb);
          padding: 2rem;
          box-sizing: border-box;
        }

        .admin-sidebar {
          width: 220px;
          background: var(--sidebar-bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
          padding: 1.5rem 1.25rem 1.75rem;
          margin-right: 1.5rem;
          display: flex;
          flex-direction: column;
          transition: width 0.2s ease, padding 0.2s ease;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
        }

        .sidebar-section {
          font-size: 0.7rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin: 1.25rem 0 0.5rem;
          font-weight: 600;
        }

        .sidebar-divider {
          border-top: 1px solid #e5e7eb;
          margin: 0.9rem 0;
        }

        .nav-item {
          width: 100%;
          border: none;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.45rem 0.6rem;
          margin-bottom: 0.15rem;
          border-radius: 10px;
          font-size: 0.9rem;
          color: #4b5563;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .nav-icon {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          background: transparent;
          color: #6b7280;
        }

        .nav-item:hover {
          background: #eef2ff;
          color: #111827;
        }

        .nav-item:hover .nav-icon {
          color: #111827;
        }

        .nav-item--active {
          background: #2563eb;
          color: #ffffff;
        }

        .nav-item--active .nav-icon {
          background: #1d4ed8;
          color: #ffffff;
        }

        .admin-sidebar--collapsed {
          width: 76px;
          padding: 1.25rem 0.8rem;
        }

        .sidebar-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .sidebar-brand {
          font-weight: 700;
          color: var(--text-main);
        }

        .sidebar-toggle {
          border: 1px solid var(--border-subtle);
          background: #fff;
          border-radius: 10px;
          width: 34px;
          height: 34px;
          cursor: pointer;
        }

        .admin-sidebar--collapsed .nav-label {
          display: none;
        }

        .admin-sidebar--collapsed .sidebar-section,
        .admin-sidebar--collapsed .sidebar-divider {
          display: none;
        }

        .admin-sidebar--collapsed .nav-item {
          justify-content: center;
          padding: 0.55rem 0.4rem;
        }

        .admin-sidebar--collapsed .nav-icon {
          width: 34px;
          height: 34px;
          background: #eef2ff;
          color: #111827;
        }

        .admin-main {
          flex: 1;
          background: var(--bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
          padding: 1.75rem 2rem 2rem;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .ap-page {
          min-height: 100%;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          color: #1f2937;
        }

        .ap-shell {
          max-width: 900px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
          align-items: start;
        }

        .ap-aside {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ap-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 14px;
        }

        .ap-avatar {
          width: 72px;
          height: 72px;
          border-radius: 999px;
          background: linear-gradient(135deg, #0f4c81 0%, #1a6eb8 100%);
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 24px;
          color: #fff;
        }

        .ap-cardText {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ap-name {
          font-weight: 700;
          font-size: 16px;
          line-height: 1.2;
          color: #111827;
        }

        .ap-email {
          font-size: 13px;
          color: #6b7280;
        }

        .ap-role-badge {
          margin-top: 8px;
          display: inline-block;
          background: #dbeafe;
          color: #1e40af;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 999px;
          letter-spacing: 0.5px;
        }

        .ap-info-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
        }

        .ap-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
        }

        .ap-info-row:not(:last-child) {
          border-bottom: 1px solid #f3f4f6;
        }

        .ap-info-label {
          font-size: 13px;
          color: #6b7280;
        }

        .ap-info-value {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }

        .ap-status-badge {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          text-transform: capitalize;
        }

        .ap-status-badge.active,
        .ap-status-badge.verified {
          background: #dcfce7;
          color: #166534;
        }

        .ap-status-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .ap-status-badge.suspended {
          background: #fee2e2;
          color: #991b1b;
        }

        .ap-main {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .ap-panel {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
        }

        .ap-panelTitle {
          font-weight: 800;
          font-size: 20px;
          margin-bottom: 20px;
          color: #111827;
        }

        .ap-panelSubTitle {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 16px;
          color: #374151;
        }

        .ap-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 20px;
        }

        .ap-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ap-label {
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
        }

        .ap-input {
          height: 42px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 14px;
          outline: none;
          background: #fff;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .ap-input:focus {
          border-color: #0f4c81;
          box-shadow: 0 0 0 3px rgba(15, 76, 129, 0.15);
        }

        .ap-input:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .ap-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 8px;
        }

        .ap-btn {
          height: 42px;
          padding: 0 20px;
          border-radius: 8px;
          border: 1px solid transparent;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ap-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ap-btnGhost {
          background: #fff;
          border-color: #d1d5db;
          color: #6b7280;
        }

        .ap-btnGhost:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .ap-btnPrimary {
          background: #0f4c81;
          color: #fff;
        }

        .ap-btnPrimary:hover:not(:disabled) {
          background: #0c3c65;
        }

        @media (max-width: 900px) {
          .ap-shell {
            grid-template-columns: 1fr;
          }
          .ap-aside {
            order: -1;
          }
        }

        @media (max-width: 640px) {
          .ap-grid2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
