// src/pages/adminDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import AdminNavbar from "../components/adminNavbar";
import AdminSidebar from "../components/adminSidebar";
import { exportPDF as ExportPDF } from "../components/exportPDF";
import AnalyticsView from "./adminAnalyticsView";
import ContentModerationView from "./adminContentModerationView";
import AdminReportsView from "./adminReportsView";


// --- mock data --------------------------------------------------------------
const initialModerationItems = [
  {
    title: 'Itinerary: "Tokyo Nightlife Guide"',
    statusText: "Reported for inappropriate content",
    user: "user123",
    severity: "red",
    state: "pending",
  },
  {
    title: 'FAQ: "Best time to visit Bali"',
    statusText: "Pending review",
    user: "user456",
    severity: "orange",
    state: "pending",
  },
  {
    title: 'User Review: "Hotel California"',
    statusText: "Flagged as spam",
    user: "user789",
    severity: "red",
    state: "pending",
  },
];

const reportItems = [
  { name: "Weekly Activity Report", date: "2025-02-10" },
  { name: "Monthly Growth Summary", date: "2025-02-01" },
  { name: "Destination Performance", date: "2025-01-28" },
];

const securityEvents = [
  { time: "09:42", text: "5 failed login attempts (user: mike@demo.com)" },
  { time: "08:15", text: "New admin role assigned to sarah@demo.com" },
  { time: "Yesterday", text: "Password reset requested by john@demo.com" },
];

type StatDelta = {
  direction: "up" | "down" | "flat";
  percent: number;
  diff: number;
  label: string;
};

type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  itinerariesCreated: number;
  pendingVerifications: number;

  totalUsersDelta: StatDelta;
  activeUsersDelta: StatDelta;
  itinerariesDelta: StatDelta;
  pendingDelta: StatDelta;
};

type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  status: string | null;
  created_at: string;

  role?: string | null;
  auth_user_id?: string | null;
  last_active_at?: string | null;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [activeSidebarItem, setActiveSidebarItem] = useState("dashboard");
  const [activeTab, setActiveTab] = useState<"users" | "moderation">("moderation");
  const [moderationItems, setModerationItems] = useState(initialModerationItems);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [reviewClicked, setReviewClicked] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [viewOpen, setViewOpen] = useState(false);
  const [viewUser, setViewUser] = useState<AdminUserRow | null>(null);

  // Export mode state from URL params
  const [exportMode, setExportMode] = useState(false);
  const [hidePopularItineraries, setHidePopularItineraries] = useState(false);
  const [exportFromDate, setExportFromDate] = useState<string | undefined>(undefined);
  const [exportToDate, setExportToDate] = useState<string | undefined>(undefined);
  
  // Export preview data (for User Activity Report)
  type ExportPreviewData = {
    heading: string;
    cards: { label: string; value: string; tone: "neutral" | "good" | "warn" }[];
    note: string;
  };
  const [exportPreviewData, setExportPreviewData] = useState<ExportPreviewData | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Fetch export preview data for User Activity Report
  const fetchExportPreview = async (from: string, to: string) => {
    setExportLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const params = new URLSearchParams({ type: "user_activity", from, to });
      const r = await fetch(`http://localhost:8000/api/admin/reports/preview/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (r.ok) {
        const json = await r.json();
        setExportPreviewData(json);
      }
    } catch (e) {
      console.error("Failed to fetch export preview:", e);
    } finally {
      setExportLoading(false);
    }
  };

  // Handle URL params for export mode
  useEffect(() => {
    const isExport = searchParams.get("export") === "true";
    const view = searchParams.get("view");
    const hidePopular = searchParams.get("hidePopular") === "true";
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    if (isExport) {
      setExportMode(true);
      setHidePopularItineraries(hidePopular);
      setExportFromDate(fromDate || undefined);
      setExportToDate(toDate || undefined);
      
      // Set the appropriate view
      if (view === "analytics") {
        setActiveSidebarItem("analytics");
      } else if (view === "dashboard") {
        setActiveSidebarItem("dashboard");
        // Fetch preview data for dashboard export
        if (fromDate && toDate) {
          fetchExportPreview(fromDate, toDate);
        }
      }

      // Trigger print after a short delay to allow rendering
      setTimeout(() => {
        window.print();
        // Clear URL params after printing
        setSearchParams({});
        setExportMode(false);
        setHidePopularItineraries(false);
        setExportFromDate(undefined);
        setExportToDate(undefined);
        setExportPreviewData(null);
      }, 2000);
    }
  }, [searchParams, setSearchParams]);


  const emptyDelta: StatDelta = { direction: "flat", percent: 0, diff: 0, label: "" };

  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    itinerariesCreated: 0,
    pendingVerifications: 0,
    totalUsersDelta: emptyDelta,
    activeUsersDelta: emptyDelta,
    itinerariesDelta: emptyDelta,
    pendingDelta: emptyDelta,
  });

  const [statsLoading, setStatsLoading] = useState(false);

  // Define "active" window
  const ACTIVE_DAYS = 30;
  const ACTIVE_COLUMN = "last_active_at";

  function calcDelta(current: number, previous: number): StatDelta {
    const diff = current - previous;

    const direction: StatDelta["direction"] = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

    // if last week is 0, don't show fake 100%
    if (previous === 0) {
      if (current === 0) {
        return { direction: "flat", percent: 0, diff: 0, label: `${arrow} no change from last week` };
      }
      return { direction: "up", percent: 0, diff, label: `${arrow} new from last week (+${current})` };
    }

    const percentRaw = (diff / previous) * 100;
    const percent = Math.round(Math.abs(percentRaw) * 10) / 10;

    let label = "";
    if (direction === "flat") label = `${arrow} no change from last week`;
    else label = `${arrow} ${percent}% ${direction === "up" ? "increase" : "decrease"} from last week`;

    return { direction, percent, diff, label };
  }

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      let q = supabase
        .from("app_user")
        .select(`id, email,role, status, auth_user_id, created_at, last_active_at, profiles:profiles!app_user_profiles_fk (name)`) 
        .order("created_at", { ascending: false });

      if (search.trim()) {
        const s = search.trim();

        // 1) find profile ids where name matches
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id")
          .ilike("name", `%${s}%`);

        if (profErr) console.error("profiles search error", profErr);

        const ids = (profs ?? []).map((p) => p.id);

        // 2) apply OR: email match OR id in (matching profile ids)
        if (ids.length > 0) {
          q = q.or(`email.ilike.%${s}%,id.in.(${ids.join(",")})`);
        } else {
          q = q.ilike("email", `%${s}%`);
        }
      }

      const { data, error } = await q;

      console.log("users error:", error);
      console.log("users error json:", JSON.stringify(error, null, 2));

      if (error) {
        console.error("fetchUsers error:", error);
        setUsers([]);
        return;
      }

    const mapped: AdminUserRow[] = (data ?? []).map((u: any) => ({
      id: u.id,
      name: u.profiles?.name ?? null,
      email: u.email,
      status: u.status ?? (u.auth_user_id ? "verified" : "pending"),
      created_at: u.created_at,
      role: u.role ?? null,
      auth_user_id: u.auth_user_id ?? null,
      last_active_at: u.last_active_at ?? null,
    }));


      setUsers(mapped);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchAdminStats = async () => {
    setStatsLoading(true);
    try {
      const now = new Date();

      const startThisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const startLastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const activeThisWeekReq = supabase
        .from("app_user")
        .select("id", { count: "exact", head: true })
        .not("auth_user_id", "is", null)
        .gte(ACTIVE_COLUMN, startThisWeek);

      const activeLastWeekReq = supabase
        .from("app_user")
        .select("id", { count: "exact", head: true })
        .not("auth_user_id", "is", null)
        .gte(ACTIVE_COLUMN, startLastWeek)
        .lt(ACTIVE_COLUMN, startThisWeek);

      const activeCutoffNow = new Date(now.getTime() - ACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const totalUsersReq = supabase.from("app_user").select("id", { count: "exact", head: true });

      const usersThisWeekReq = supabase
        .from("app_user")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startThisWeek);

      const usersLastWeekReq = supabase
        .from("app_user")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startLastWeek)
        .lt("created_at", startThisWeek);

      const pendingTotalReq = supabase
        .from("app_user")
        .select("id", { count: "exact", head: true })
        .is("auth_user_id", null);

      const pendingThisWeekReq = supabase
        .from("app_user")
        .select("id", { count: "exact", head: true })
        .is("auth_user_id", null)
        .gte("created_at", startThisWeek);

      const pendingLastWeekReq = supabase
        .from("app_user")
        .select("id", { count: "exact", head: true })
        .is("auth_user_id", null)
        .gte("created_at", startLastWeek)
        .lt("created_at", startThisWeek);

      const activeNowReq = supabase
        .from("app_user")
        .select("id", { count: "exact", head: true })
        .not("auth_user_id", "is", null)
        .gte(ACTIVE_COLUMN, activeCutoffNow);

      const tripsTotalReq = supabase.rpc("admin_trip_count");
      const tripsThisWeekReq = supabase.rpc("admin_trip_count_range", { start_ts: startThisWeek, end_ts: null });
      const tripsLastWeekReq = supabase.rpc("admin_trip_count_range", { start_ts: startLastWeek, end_ts: startThisWeek });

      const [
        totalUsersRes,
        usersThisWeekRes,
        usersLastWeekRes,
        pendingTotalRes,
        pendingThisWeekRes,
        pendingLastWeekRes,
        activeNowRes,
        activeThisWeekRes,
        activeLastWeekRes,
        tripsTotalRes,
        tripsThisWeekRes,
        tripsLastWeekRes,
      ] = await Promise.all([
        totalUsersReq,
        usersThisWeekReq,
        usersLastWeekReq,
        pendingTotalReq,
        pendingThisWeekReq,
        pendingLastWeekReq,
        activeNowReq,
        activeThisWeekReq,
        activeLastWeekReq,
        tripsTotalReq,
        tripsThisWeekReq,
        tripsLastWeekReq,
      ]);

      [
        totalUsersRes,
        usersThisWeekRes,
        usersLastWeekRes,
        pendingTotalRes,
        pendingThisWeekRes,
        pendingLastWeekRes,
        activeNowRes,
        tripsTotalRes,
        tripsThisWeekRes,
        tripsLastWeekRes,
      ].forEach((r: any) => r?.error && console.error(r.error));

      const activeThisWeek = activeThisWeekRes.count ?? 0;
      const activeLastWeek = activeLastWeekRes.count ?? 0;

      const totalUsers = totalUsersRes.count ?? 0;
      const pendingTotal = pendingTotalRes.count ?? 0;
      const activeUsers = activeNowRes.count ?? 0;
      const tripsTotal = Number(tripsTotalRes.data ?? 0);

      const usersThisWeek = usersThisWeekRes.count ?? 0;
      const usersLastWeek = usersLastWeekRes.count ?? 0;

      const pendingThisWeek = pendingThisWeekRes.count ?? 0;
      const pendingLastWeek = pendingLastWeekRes.count ?? 0;

      const tripsThisWeek = Number(tripsThisWeekRes.data ?? 0);
      const tripsLastWeek = Number(tripsLastWeekRes.data ?? 0);

      setStats({
        totalUsers,
        activeUsers,
        itinerariesCreated: tripsTotal,
        pendingVerifications: pendingTotal,
        totalUsersDelta: calcDelta(usersThisWeek, usersLastWeek),
        activeUsersDelta: calcDelta(activeThisWeek, activeLastWeek),
        itinerariesDelta: calcDelta(tripsThisWeek, tripsLastWeek),
        pendingDelta: calcDelta(pendingThisWeek, pendingLastWeek),
      });
    } finally {
      setStatsLoading(false);
    }
  };

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

      // 🔥 CHECK ADMIN ROLE FROM DB (NOT EMAIL LIST)
      const { data: profile, error: profErr } = await supabase
        .from("app_user")
        .select("role, status, email")
        .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
        .maybeSingle();

      if (profErr || !profile) {
        navigate("/signin", { replace: true });
        return;
      }

      const role = profile.role?.toLowerCase();
      const status = profile.status?.toLowerCase();

      if (
        role !== "admin" ||
        (status !== "active" && status !== "verified")
      ) {
        navigate("/signin", { replace: true });
        return;
      }

      setUserEmail(profile.email ?? user.email ?? "");

      await fetchAdminStats();
      await fetchUsers();
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const filteredModerationItems = useMemo(() => {
    return showPendingOnly ? moderationItems.filter((item) => item.state === "pending") : moderationItems;
  }, [showPendingOnly, moderationItems]);

  const handleApprove = (index: number) => {
    setModerationItems((items) => items.map((item, i) => (i === index ? { ...item, state: "approved" } : item)));
  };

  const handleReject = (index: number) => {
    setModerationItems((items) => items.map((item, i) => (i === index ? { ...item, state: "rejected" } : item)));
  };

  const handleExportPDF = async () => {
    setPdfOpen(false);
    requestAnimationFrame(() => {
      window.print();
    });
  };
  const [rowActionLoading, setRowActionLoading] = useState<Record<string, boolean>>({});

  const setRowBusy = (userId: string, busy: boolean) => {
  setRowActionLoading((prev) => ({ ...prev, [userId]: busy }));
  };

  const updateUserStatus = async (userId: string, nextStatus: "verified" | "pending" | "suspended") => {
    setRowBusy(userId, true);
    try {
      const { error } = await supabase.from("app_user").update({ status: nextStatus }).eq("id", userId);
      if (error) throw error;

      // refresh list (simple + reliable)
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert("Could not update user status.");
    } finally {
      setRowBusy(userId, false);
    }
  };

  const deleteUserRow = async (userId: string) => {
    const ok = window.confirm("Remove this user from the list?");
    if (!ok) return;

    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const openViewUser = (u: AdminUserRow) => {
  setViewUser(u);
  setViewOpen(true);
  };

  const ViewRow = ({
    label,
    value,
    mono,
    pill,
    pillClass,
  }: {
    label: string;
    value: string;
    mono?: boolean;
    pill?: boolean;
    pillClass?: string;
  }) => {
    return (
      <div className="view-row">
        <div className="view-label">{label}</div>
        <div className={"view-value " + (mono ? "view-mono" : "")}>
          {pill ? <span className={pillClass ?? ""}>{value}</span> : value}
        </div>
      </div>
    );
  };
  

  return (
    <>
      <AdminNavbar
        onProfileClick={() => navigate("/admin-profile")}
        onLogoutClick={async () => {
          await supabase.auth.signOut();
          navigate("/signin", { replace: true });
        }}
      />

      <div className="admin-shell">
        {/* SIDEBAR */}
        <AdminSidebar
          activeSidebarItem={activeSidebarItem}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          onSelect={(item, tab) => {
            setActiveSidebarItem(item);
            if (tab) setActiveTab(tab);
          }}
        />

        {/* MAIN */}
        <main className="admin-main">
          <div id="print-area">
            {activeSidebarItem === "dashboard" && !exportMode && (
              <header className="admin-header">
                <div>
                  <h1>Admin Dashboard</h1>
                  <p>User Account Management, Destination Data, System Monitoring & Content Moderation</p>
                </div>

                <div className="header-actions">
                  <button className="btn btn-outline" onClick={() => setPdfOpen(true)}>
                    Export Reports
                  </button>

                  <button
                    className="btn btn-primary"
                    onClick={fetchAdminStats}
                    disabled={statsLoading}
                    title="Refresh dashboard stats"
                  >
                    ↻ {statsLoading ? "Refreshing..." : "Refresh"}
                  </button>

                  <div className="admin-user-pill">
                    <span className="avatar">AD</span>
                    <div>
                      <span className="pill-label">Admin User</span>
                      <span className="pill-name">{userEmail ? userEmail : "Administrator"}</span>
                    </div>
                  </div>
                </div>
              </header>
            )}

            {/* STATS – only for dashboard */}
            {activeSidebarItem === "dashboard" && !exportMode && (
              <section className="stats-row">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">TOTAL USERS</span>
                    <span className="stat-icon">👥</span>
                  </div>
                  <div className="stat-value">{stats.totalUsers.toLocaleString()}</div>
                  <div
                    className={
                      "stat-meta " +
                      (stats.totalUsersDelta.direction === "up"
                        ? "stat-meta--up"
                        : stats.totalUsersDelta.direction === "down"
                        ? "stat-meta--down"
                        : "")
                    }
                  >
                    {stats.totalUsersDelta.label}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">ACTIVE USERS</span>
                    <span className="stat-icon">✅</span>
                  </div>
                  <div className="stat-value">{stats.activeUsers.toLocaleString()}</div>
                  <div
                    className={
                      "stat-meta " +
                      (stats.activeUsersDelta.direction === "up"
                        ? "stat-meta--up"
                        : stats.activeUsersDelta.direction === "down"
                        ? "stat-meta--down"
                        : "")
                    }
                  >
                    {stats.activeUsersDelta.label}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">ITINERARIES CREATED</span>
                    <span className="stat-icon stat-icon--pink">🧳</span>
                  </div>
                  <div className="stat-value">{stats.itinerariesCreated.toLocaleString()}</div>
                  <div
                    className={
                      "stat-meta " +
                      (stats.itinerariesDelta.direction === "up"
                        ? "stat-meta--up"
                        : stats.itinerariesDelta.direction === "down"
                        ? "stat-meta--down"
                        : "")
                    }
                  >
                    {stats.itinerariesDelta.label}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">PENDING VERIFICATIONS</span>
                    <span className="stat-icon stat-icon--red">⚠️</span>
                  </div>
                  <div className="stat-value">{stats.pendingVerifications.toLocaleString()}</div>
                  <div
                    className={
                      "stat-meta " +
                      (stats.pendingDelta.direction === "up"
                        ? "stat-meta--up"
                        : stats.pendingDelta.direction === "down"
                        ? "stat-meta--down"
                        : "")
                    }
                  >
                    {stats.pendingDelta.label}
                  </div>
                </div>
              </section>
            )}

            {/* EXPORT MODE - User Activity Report View */}
            {activeSidebarItem === "dashboard" && exportMode && (
              <section className="export-report-view" style={{
                padding: "32px",
                background: "#fff",
                borderRadius: "16px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                maxWidth: "1000px",
                margin: "0 auto"
              }}>
                <h1 style={{ 
                  fontSize: "28px", 
                  fontWeight: 900, 
                  marginBottom: "24px",
                  color: "#111827"
                }}>
                  {exportPreviewData?.heading?.replace(/\n/g, " ") || "User Activity Report"}
                </h1>
                
                {exportLoading ? (
                  <p>Loading report data...</p>
                ) : (
                  <>
                    {/* Stats Cards from API - all filtered by date range */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "16px",
                      marginBottom: "24px"
                    }}>
                      {/* All cards from Preview API (date-filtered) */}
                      {exportPreviewData?.cards.map((card, idx) => (
                        <div key={idx} style={{
                          padding: "20px",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          background: "#fafafa"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                              {card.label.replace(/\n/g, " ")}
                            </span>
                            <span style={{ fontSize: "18px" }}>
                              {card.label.toLowerCase().includes("active") ? "👥" : 
                               card.label.toLowerCase().includes("signup") ? "✅" :
                               card.label.toLowerCase().includes("itinerar") ? "🧳" :
                               card.label.toLowerCase().includes("pending") || card.label.toLowerCase().includes("verif") ? "⚠️" : "📊"}
                            </span>
                          </div>
                          <div style={{ 
                            fontSize: "36px", 
                            fontWeight: 900, 
                            color: card.tone === "good" ? "#059669" : card.tone === "warn" ? "#dc2626" : "#111827",
                            marginBottom: "8px" 
                          }}>
                            {card.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {exportPreviewData?.note && (
                      <p style={{ 
                        fontSize: "14px", 
                        color: "#6b7280",
                        marginBottom: "16px",
                        fontStyle: "italic"
                      }}>
                        {exportPreviewData.note.replace(/\n/g, " ")}
                      </p>
                    )}
                  </>
                )}
                
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#9ca3af",
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: "16px"
                }}>
                  <span>Report Generated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span>Date Range: {exportFromDate ? new Date(exportFromDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"} - {exportToDate ? new Date(exportToDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}</span>
                </div>
              </section>
            )}

            {/* GRID BELOW – SWITCH BY SIDEBAR ITEM */}
            <section className={"content-grid " + (activeSidebarItem === "dashboard" ? "content-grid--dashboard" : "")}>
              {/* DASHBOARD VIEW - hide when in export mode */}
              {activeSidebarItem === "dashboard" && !exportMode && (
                <>
                  {/* LEFT COLUMN */}
                  <div className="card card-moderation">
                    <div className="card-header card-header--space">
                      <div>
                        <h2>{activeTab === "moderation" ? "Content Moderation" : "User Accounts"}</h2>
                      </div>
                    </div>

                    <div className="tabs tabs--underline">
                      <button
                        className={"tab " + (activeTab === "users" ? "tab--underline-active" : "")}
                        onClick={() => setActiveTab("users")}
                      >
                        User Management
                      </button>
                      <button
                        className={"tab " + (activeTab === "moderation" ? "tab--underline-active" : "")}
                        onClick={() => setActiveTab("moderation")}
                      >
                        Content Moderation
                      </button>
                    </div>
                  {activeTab === "moderation" ? (
                    <div className="cm-dashboard-compact">
                      <ContentModerationView compact />
                    </div>
                  ) : (
                      <div className="users-card">
                        {/* header */}
                        <div className="users-top">
                        </div>

                        {/* search */}
                        <div className="users-search-row">
                          <input
                            placeholder="Search users by name, email..."
                            className="users-search-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          <button className="btn btn-outline users-search-btn" onClick={fetchUsers} disabled={usersLoading}>
                            <span className="users-search-icon">🔍</span>
                            {usersLoading ? "Searching..." : "Search"}
                          </button>
                          <button className="btn btn-primary users-add">+ Add User</button>                          
                        </div>
                        {/* table */}
                        <div className="users-table-wrap">
                          <table className="users-table">
                            <thead>
                              <tr>
                                <th>User</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th style={{ textAlign: "right" }}>Actions</th>
                              </tr>
                            </thead>

                            <tbody>
                              {usersLoading ? (
                                <tr>
                                  <td colSpan={6} className="users-empty">
                                    Loading...
                                  </td>
                                </tr>
                              ) : users.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="users-empty">
                                    No users found
                                  </td>
                                </tr>
                              ) : (
                                users.map((u) => {
                                  const initials =
                                    (u.name?.trim()?.split(/\s+/).map((p) => p[0]).slice(0, 2).join("") ||
                                      u.email?.[0] ||
                                      "?").toUpperCase();

                                  const status = (u.status ?? "verified").toLowerCase();
                                  const joined = new Date(u.created_at);
                                  const joinedTop = joined.toISOString().slice(0, 4);
                                  const joinedBottom = joined.toISOString().slice(5, 10);

                                  const isPending = status === "pending";
                                  const isSuspended = status === "suspended";

                                  return (
                                    <tr key={u.id}>
                                      <td>
                                        <div className="users-usercell">
                                          <div className="users-avatar">{initials}</div>
                                        </div>
                                      </td>
    
<td className="users-name">
  {u.name && u.name.trim() !== "" ? u.name : "-"}
</td>
                                      <td className="users-email">{u.email}</td>

                                      <td>
                                        <span className={"users-status users-status--" + status}>
                                          {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </span>
                                      </td>

                                      <td>
                                        <div className="users-joined">
                                          <div>{joinedTop}</div>
                                          <div>{joinedBottom}</div>
                                        </div>
                                      </td>

                                      <td>
                                        <div className="users-actions">
                                          <button className="users-action-btn" title="View" onClick={() => openViewUser(u)} // or open a modal
                                           disabled={!!rowActionLoading[u.id]}>
                                            👁️
                                          </button>

                                          {isPending ? (
                                            <button className="users-action-btn users-action-btn--success" title="Approve" onClick={() => updateUserStatus(u.id, "verified")}
                                             disabled={!!rowActionLoading[u.id]}>
                                              ✓
                                            </button>
                                          ) : isSuspended ? (
                                            <button className="users-action-btn users-action-btn--success" title="Unsuspend" onClick={() => updateUserStatus(u.id, "verified")} disabled={!!rowActionLoading[u.id]}>
                                              🔓
                                            </button>
                                          ) : (
                                            <button className="users-action-btn users-action-btn--lock" title="Suspend" onClick={() => updateUserStatus(u.id, "suspended")} disabled={!!rowActionLoading[u.id]}>
                                             🔒
                                              </button>
                                            )}
                                            <button className="users-action-btn users-action-btn--danger" title="Delete" onClick={() => deleteUserRow(u.id)} disabled={!!rowActionLoading[u.id]}>
                                              🗑️
                                            </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN (always present on dashboard so grid stays valid) */}
                  <aside className="card card-side">
                    <h2>Pending Actions</h2>

                    <div className="side-block side-block--primary">
                      <div className="side-block-header">
                        <div>
                          <span className="side-title">User Verifications</span>
                          <p className="side-sub">
                            {stats.pendingVerifications.toLocaleString()} new users
                            <br />
                            awaiting approval
                          </p>
                        </div>
                        <button className="btn btn-primary btn-small" onClick={() => setReviewClicked(true)}>
                          Review
                        </button>
                      </div>
                      {reviewClicked && <p className="side-note">Opened verification queue (demo behavior).</p>}
                    </div>
                  </aside>
                </>
              )}

              {/* ANALYTICS VIEW */}
              {activeSidebarItem === "analytics" && (
                  <div className="card card-analytics">
                    <AnalyticsView
                      stats={stats}
                      onApplyFilter={(from, to) => {
                        console.log("apply filter", from, to);
                        // later call your fetchAnalytics(from,to)
                      }}
                      hidePopularItineraries={hidePopularItineraries}
                      initialFrom={exportFromDate}
                      initialTo={exportToDate}
                    />
                  </div>
                )}              
              {/* USER MANAGEMENT VIEW */}
              {activeSidebarItem === "users" && (
                <>
                  <div className="card usersM-card">
                    <div className="users-top">
                      <div>
                        <h2 className="users-title">User Accounts</h2>
                      </div>
                    </div>

                    <div className="users-search-row">
                      <input
                        placeholder="Search users by name, email..."
                        className="users-search-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <button className="btn btn-outline users-search-btn" onClick={fetchUsers} disabled={usersLoading}>
                        <span className="users-search-icon">🔍</span>
                        {usersLoading ? "Searching..." : "Search"}
                      </button>
                      <button className="btn btn-primary users-add">+ Add User</button>
                    </div>

                    <div className="users-table-wrap">
                      <table className="users-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {usersLoading ? (
                            <tr>
                              <td colSpan={6} className="users-empty">
                                Loading...
                              </td>
                            </tr>
                          ) : users.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="users-empty">
                                No users found
                              </td>
                            </tr>
                          ) : (
                            users.map((u) => {
                              const initials =
                                (u.name?.trim()?.split(/\s+/).map((p) => p[0]).slice(0, 2).join("") ||
                                  u.email?.[0] ||
                                  "?").toUpperCase();

                              const status = (u.status ?? "verified").toLowerCase();
                              const joined = new Date(u.created_at);
                              const joinedTop = joined.toISOString().slice(0, 4);
                              const joinedBottom = joined.toISOString().slice(5, 10);

                              const isPending = status === "pending";
                              const isSuspended = status === "suspended";

                              return (
                                <tr key={u.id}>
                                  <td>
                                    <div className="users-usercell">
                                      <div className="users-avatar">{initials}</div>
                                    </div>
                                  </td>
                                  
                                  <td className="users-name">{u.name ?? "-"}</td>
                                  <td className="users-email">{u.email}</td>

                                  <td>
                                    <span className={"users-status users-status--" + status}>
                                      {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </span>
                                  </td>

                                  <td>
                                    <div className="users-joined">
                                      <div>{joinedTop}</div>
                                      <div>{joinedBottom}</div>
                                    </div>
                                  </td>

                                  <td>
                                      <div className="users-actions">
                                        <button className="users-action-btn" title="View" onClick={() => openViewUser(u)} // or open a modal
                                          disabled={!!rowActionLoading[u.id]}>
                                          👁️
                                        </button>

                                        {isPending ? (
                                          <button className="users-action-btn users-action-btn--success" title="Approve" onClick={() => updateUserStatus(u.id, "verified")}
                                            disabled={!!rowActionLoading[u.id]}>
                                            ✓
                                          </button>
                                        ) : isSuspended ? (
                                          <button className="users-action-btn users-action-btn--success" title="Unsuspend" onClick={() => updateUserStatus(u.id, "verified")} disabled={!!rowActionLoading[u.id]}>
                                            🔓
                                          </button>
                                        ) : (
                                          <button className="users-action-btn users-action-btn--lock" title="Suspend" onClick={() => updateUserStatus(u.id, "suspended")} disabled={!!rowActionLoading[u.id]}>
                                            🔒
                                            </button>
                                          )}
                                          <button className="users-action-btn users-action-btn--danger" title="Delete" onClick={() => deleteUserRow(u.id)} disabled={!!rowActionLoading[u.id]}>
                                            🗑️
                                          </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <aside className="card card-side">
                    <h2>Roles Summary</h2>
                    <ul className="simple-list">
                      <li>Admins</li>
                      <li>Managers</li>
                      <li>Regular Users</li>
                    </ul>
                  </aside>
                </>
              )}
              {activeSidebarItem === "content" && (
                <>
                  <div className="card" style={{ gridColumn: "1 / -1" }}>
                    <ContentModerationView />
                  </div>
                </>
              )}
              {/* REPORTS VIEW */}
              {activeSidebarItem === "reports" && (
                <div className="card" style={{ gridColumn: "1 / -1", padding: 0, background: "transparent", boxShadow: "none" }}>
                  <AdminReportsView
                  />
                </div>
              )}

              {/* SECURITY VIEW */}
              {activeSidebarItem === "security" && (
                <>
                  <div className="card">
                    <div className="card-header">
                      <h2>Security Log</h2>
                    </div>
                    <ul className="security-log-list">
                      {securityEvents.map((e, i) => (
                        <li key={i} className="security-log-item">
                          <span className="security-log-time">{e.time}</span>
                          <span className="security-log-text">{e.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <aside className="card card-side">
                    <h2>Security Status</h2>
                    <ul className="simple-list">
                      <li>2FA required for admins</li>
                      <li>Last password policy update: 5 days ago</li>
                    </ul>
                  </aside>
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      <ExportPDF open={pdfOpen} onClose={() => setPdfOpen(false)} onExport={handleExportPDF} />
      {viewOpen && viewUser && (
        <div className="modal-backdrop" onClick={() => setViewOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2 className="modal-title">User Account</h2>
                <p className="modal-sub">View user details</p>
              </div>
              <button className="modal-close" onClick={() => setViewOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="view-grid">
                <ViewRow label="User ID" value={viewUser.id} mono />
                <ViewRow label="Name" value={viewUser.name ?? "-"} />
                <ViewRow label="Email" value={viewUser.email} />
                <ViewRow label="Role" value={viewUser.role ?? "-"} />
                <ViewRow
                  label="Status"
                  value={(viewUser.status ?? "verified").toString()}
                  pill
                  pillClass={"users-status users-status--" + (viewUser.status ?? "verified").toLowerCase()}
                />
                <ViewRow label="Auth User ID" value={viewUser.auth_user_id ?? "-"} mono />
                <ViewRow label="Joined" value={new Date(viewUser.created_at).toLocaleString()} />
                <ViewRow
                  label="Last Active"
                  value={viewUser.last_active_at ? new Date(viewUser.last_active_at).toLocaleString() : "-"}
                />
              </div>

              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setViewOpen(false)}>
                  Close
                </button>

                {/* quick actions inside view */}
                {((viewUser.status ?? "verified").toLowerCase() === "pending") ? (
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      await updateUserStatus(viewUser.id, "verified");
                      setViewOpen(false);
                    }}
                    disabled={!!rowActionLoading[viewUser.id]}
                  >
                    Approve
                  </button>
                ) : ((viewUser.status ?? "verified").toLowerCase() === "suspended") ? (
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      await updateUserStatus(viewUser.id, "verified");
                      setViewOpen(false);
                    }}
                    disabled={!!rowActionLoading[viewUser.id]}
                  >
                    Unsuspend
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      await updateUserStatus(viewUser.id, "suspended");
                      setViewOpen(false);
                    }}
                    disabled={!!rowActionLoading[viewUser.id]}
                  >
                    Suspend
                  </button>
                )}

                <button
                  className="btn"
                  style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                  onClick={async () => {
                    await deleteUserRow(viewUser.id);
                    setViewOpen(false);
                  }}
                  disabled={!!rowActionLoading[viewUser.id]}
                  title="Delete user"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS INLINE */}
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
          --danger: #ef4444;
          --success: #16a34a;
          --warning: #f59e0b;
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
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.75rem;
        }

        .admin-header h1 {
          margin: 0;
          font-size: 1.5rem;
          color: var(--text-main);
        }

        .admin-header p {
          margin: 0.2rem 0 0;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
        }

        .btn {
          border-radius: var(--radius-pill);
          padding: 0.45rem 0.95rem;
          border: 1px solid transparent;
          font-size: 0.85rem;
          cursor: pointer;
          background: #fff;
        }

        .btn-small {
          padding: 0.3rem 0.9rem;
          font-size: 0.8rem;
        }

        .btn-primary {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.4);
        }

        .btn-outline {
          border-color: var(--border-subtle);
        }

        .btn-approve {
          background: #16a34a;
          color: #fff;
          border-color: transparent;
        }

        .btn-reject {
          background: #ef4444;
          color: #fff;
          border-color: transparent;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: default;
          box-shadow: none;
        }

        .btn-filter-active {
          border-color: var(--accent);
          color: var(--accent);
        }

        .admin-user-pill {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.35rem 0.7rem;
          background: #fff;
          border-radius: var(--radius-pill);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
        }

        .pill-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .pill-name {
          font-size: 0.8rem;
          font-weight: 600;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          font-weight: bold;
        }

        .avatar--small {
          width: 26px;
          height: 26px;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stat-card {
          padding: 1rem;
          background: var(--card-bg);
          border-radius: 18px;
          box-shadow: 0 3px 18px rgba(15, 23, 42, 0.04);
        }

        .stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stat-label {
          font-size: 0.7rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .stat-icon {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
        }

        .stat-icon--pink {
          background: #ffe4f1;
        }

        .stat-icon--red {
          background: #fee2e2;
        }

        .stat-value {
          font-size: 1.6rem;
          font-weight: 700;
          margin-top: 0.4rem;
        }

        .stat-meta {
          font-size: 0.75rem;
          margin-top: 0.2rem;
        }

        .stat-meta--up {
          color: var(--success);
        }

        .stat-meta--down {
          color: var(--danger);
        }

        .content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.2rem;
          align-items: flex-start;
        }

        .card {
          background: var(--card-bg);
          border-radius: var(--radius-md);
          box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
          padding: 1.1rem 1.2rem;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-header--space {
          margin-bottom: 0.6rem;
        }

        .card-header h2 {
          margin: 0;
          font-size: 1rem;
        }

        .card-header p {
          margin: 0.2rem 0 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .card-analytics{
          grid-column: 1 / -1;
          background: transparent;
          box-shadow: none;
          padding: 0;
        }
          
        /* dashboard-only tightening for content moderation */
        .card-moderation .card-header--space {
          margin-bottom: 0.25rem;  /* was 0.6rem */
        }

        .card-moderation .tabs--underline {
          margin-top: 0.25rem;     /* was 0.7rem */
        }

        .cm-dashboard-compact {
          margin-top: 0.6rem;      /* controls space after tabs */
        }

        /* Dashboard-only: hide the inner title/subtitle of ContentModerationView */
        .cm-dashboard-compact .cm-title,
        .cm-dashboard-compact .cm-sub {
          display: none !important;
        }

        /* Dashboard compact header: search inline with Pending/Refresh */
        .cm-dashboard-compact .cm-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: nowrap;
        }

        /* If the component has a left title area, hide it on dashboard */
        .cm-dashboard-compact .cm-head > :first-child {
          display: none;
        }

        /* Make toolbar row */
        .cm-dashboard-compact .cm-head > :last-child {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          justify-content: flex-end;
        }

        /* Search should expand, buttons stay at the right */
        .cm-dashboard-compact .cm-head .cm-search,
        .cm-dashboard-compact .cm-head .cm-searchWrap,
        .cm-dashboard-compact .cm-head input[type="text"] {
          flex: 1;
          min-width: 280px;
          max-width: 520px;
        }

        /* Keep actions tight */
        .cm-dashboard-compact .cm-head .cm-actions,
        .cm-dashboard-compact .cm-head .cm-right {
          display: flex;
          align-items: center;
          gap: 10px;
          white-space: nowrap;
        }

        .cm-dashboard-compact .cm-head {
          align-items: center;
}

        .content-grid--dashboard {
          grid-template-columns: 3fr 1fr; /* was 2fr 1fr */
        }        
        .tabs--underline {
          display: flex;
          gap: 1.5rem;
          border-bottom: 1px solid var(--border-subtle);
          margin-top: 0.7rem;
        }

        .tabs--underline .tab {
          border: none;
          background: transparent;
          padding: 0.4rem 0;
          font-size: 0.85rem;
          color: var(--text-muted);
          cursor: pointer;
        }

        .tab--underline-active {
          color: var(--accent);
          border-bottom: 2px solid var(--accent);
        }

        .moderation-list {
          margin-top: 0.8rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .moderation-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0.9rem;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: #f9fafb;
        }

        .moderation-item--approved {
          background: #ecfdf5;
          border-color: #bbf7d0;
        }

        .moderation-item--rejected {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .moderation-main {
          flex: 1;
          margin-right: 0.75rem;
        }

        .moderation-title-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .moderation-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .moderation-sub {
          margin: 0.2rem 0 0;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .moderation-tag {
          font-size: 0.7rem;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
        }

        .moderation-tag--red {
          background: #fee2e2;
          color: #b91c1c;
        }

        .moderation-tag--orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .moderation-tag--approved {
          background: #bbf7d0;
          color: #166534;
        }

        .moderation-tag--rejected {
          background: #fecaca;
          color: #b91c1c;
        }

        .moderation-actions {
          display: flex;
          gap: 0.4rem;
        }

        .empty-text {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-top: 0.6rem;
        }

        .table-toolbar {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 0.8rem;
        }

        .input-wrapper {
          flex: 1;
        }

        .search-input {
          width: 100%;
          padding: 0.4rem 0.75rem;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border-subtle);
          font-size: 0.85rem;
        }

        .users-card {
          padding: 0;
        }

        .usersM-card {
          padding: 1.25rem 1.3rem;
        }
        .users-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .users-title {
          margin: 0;
          font-size: 1.1rem;
        }

        .users-add {
          padding: 0.45rem 1rem;
        }

        .users-search-row {
          display: flex;
          gap: 0.8rem;
          align-items: center;
          margin-bottom: 0.9rem;
        }

        .users-search-input {
          flex: 1;
          padding: 0.65rem 1rem;
          border-radius: 14px;
          border: 1px solid var(--border-subtle);
          font-size: 0.9rem;
          background: #fff;
          outline: none;
        }

        .users-search-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          border-color: #c7d2fe;
          padding: 0.6rem 1rem;
        }

        .users-search-icon {
          font-size: 0.95rem;
        }

        .users-table-wrap {
          margin-top: 0.25rem;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table th {
          font-size: 0.85rem;
          color: var(--text-muted);
          text-align: left;
          padding: 0.7rem 0.4rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        .users-table td {
          padding: 0.85rem 0.4rem;
          border-bottom: 1px solid #eef2f7;
          vertical-align: middle;
        }

        .users-empty {
          text-align: left;
          color: var(--text-muted);
          padding: 1.2rem 0.4rem;
        }

        .users-usercell {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .users-avatar {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          background: #1d4ed8;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.85rem;
        }

        .users-name {
          font-weight: 600;
          color: var(--text-main);
        }

        .users-email {
          color: #374151;
        }

        .users-status {
          display: inline-flex;
          padding: 0.28rem 0.65rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .users-status--active {
          background: rgba(16, 185, 129, 0.14);
          color: #059669;
        }
        .users-status--verified {
          background: rgba(16, 185, 129, 0.14);
          color: #059669;
        }
        .users-status--pending {
          background: rgba(245, 158, 11, 0.16);
          color: #b45309;
        }
        .users-status--suspended {
          background: rgba(239, 68, 68, 0.14);
          color: #dc2626;
        }

        .users-joined {
          display: flex;
          flex-direction: column;
          line-height: 1.05;
          color: #111827;
          font-weight: 600;
        }

        .users-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .users-action-btn {
          width: 38px;
          height: 34px;
          border-radius: 10px;
          border: 2px solid #c7d2fe;
          background: #fff;
          cursor: pointer;
          font-size: 0.95rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .users-action-btn--success {
          border-color: transparent;
          background: #10b981;
          color: #fff;
        }

        .users-action-btn--lock {
          border-color: transparent;
          background: #10b981;
          color: #fff;
        }

        .users-action-btn--danger {
          border-color: #c7d2fe;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          z-index: 9999;
        }

        .modal-card {
          width: min(760px, 96vw);
          background: #ffffff;
          border-radius: 18px;
          box-shadow: 0 30px 80px rgba(15, 23, 42, 0.25);
          border: 1px solid rgba(229, 231, 235, 0.9);
          overflow: hidden;
        }

        .modal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px 18px;
          border-bottom: 1px solid #eef2f7;
        }

        .modal-title {
          margin: 0;
          font-size: 1.05rem;
        }

        .modal-sub {
          margin: 0.2rem 0 0;
          font-size: 0.82rem;
          color: #6b7280;
        }

        .modal-close {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
        }

        .modal-body {
          padding: 16px 18px 18px;
        }

        .view-grid {
          display: grid;
          gap: 10px;
          margin-bottom: 16px;
        }

        .view-row {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 12px;
          align-items: center;
        }

        .view-label {
          font-size: 0.78rem;
          color: #6b7280;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .view-value {
          font-size: 0.92rem;
          color: #111827;
          word-break: break-word;
        }

        .view-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 0.88rem;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }


        .status-pill {
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-pill);
          font-size: 0.75rem;
        }

        .status-pill--active {
          background: rgba(16, 185, 129, 0.15);
          color: var(--success);
        }

        .status-pill--pending {
          background: rgba(245, 158, 11, 0.15);
          color: var(--warning);
        }

        .status-pill--manager {
          background: rgba(37, 99, 235, 0.15);
          color: var(--accent);
        }

        .status-pill--suspended {
          background: rgba(239, 68, 68, 0.15);
          color: var(--danger);
        }

        .row-actions {
          display: flex;
          gap: 0.25rem;
        }

        .link-button {
          background: none;
          border: none;
          color: var(--accent);
          cursor: pointer;
          font-size: 0.8rem;
        }

        .card-side h2 {
          margin-top: 0;
          font-size: 1rem;
        }

        .side-block {
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          padding: 0.8rem 0.9rem;
          margin-top: 0.8rem;
        }

        .side-block--primary {
          border-color: #dbeafe;
          background: #eff6ff;
        }

        .side-block-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .side-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .side-sub {
          margin: 0.25rem 0 0;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .side-note {
          margin: 0.5rem 0 0;
          font-size: 0.78rem;
          color: #1d4ed8;
        }

        .mini-chart {
          height: 26px;
          border-radius: 999px;
          background: linear-gradient(90deg, #dbeafe, #2563eb);
        }

        .mini-chart--pink {
          background: linear-gradient(90deg, #ffe4f1, #ec4899);
        }

        .mini-chart--green {
          background: linear-gradient(90deg, #bbf7d0, #16a34a);
        }

        .simple-list {
          list-style: none;
          padding-left: 0;
          margin: 0.4rem 0 0;
          font-size: 0.85rem;
          color: var(--text-main);
        }

        .simple-list li + li {
          margin-top: 0.35rem;
        }

        .reports-main-card {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .reports-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .reports-subtitle {
          margin: 0.2rem 0 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .reports-actions {
          display: flex;
          gap: 0.5rem;
        }

        .reports-tabs {
          display: flex;
          gap: 0.5rem;
          margin: 0.8rem 0 0.5rem;
        }

        .reports-tab {
          border: none;
          background: #f3f4f6;
          border-radius: 999px;
          padding: 0.25rem 0.8rem;
          font-size: 0.78rem;
          cursor: pointer;
          color: var(--text-muted);
        }

        .reports-tab--active {
          background: #111827;
          color: #ffffff;
        }

        .report-stats-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .report-stat-card {
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          padding: 0.7rem 0.8rem;
          background: #f9fafb;
        }

        .report-stat-title {
          margin: 0;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .report-stat-main {
          margin: 0.3rem 0 0.15rem;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .report-stat-sub {
          margin: 0;
          font-size: 0.75rem;
        }

        .report-stat-sub--up {
          color: var(--success);
        }

        .report-stat-sub--down {
          color: var(--danger);
        }

        .chart-card {
          border-radius: 14px;
          border: 1px solid var(--border-subtle);
          padding: 0.9rem 1rem;
          background: #ffffff;
        }

        .chart-card--secondary {
          margin-top: 0.6rem;
        }

        .chart-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.6rem;
        }

        .chart-header-row h3 {
          margin: 0;
          font-size: 0.95rem;
        }

        .chart-tabs {
          display: flex;
          gap: 0.4rem;
        }

        .chart-tab {
          border: none;
          background: transparent;
          border-radius: 999px;
          padding: 0.25rem 0.7rem;
          font-size: 0.75rem;
          cursor: pointer;
          color: var(--text-muted);
        }

        .chart-tab--active {
          background: #e5edff;
          color: #2563eb;
        }

        .chart-area {
          display: flex;
          margin-top: 0.4rem;
        }

        .chart-y-axis {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          margin-right: 0.6rem;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .chart-line-wrapper {
          flex: 1;
          border-radius: 12px;
          background: linear-gradient(to top, #e0edff 0%, #eff4ff 60%, #ffffff 100%);
          position: relative;
          overflow: hidden;
        }

        .chart-line-fill {
          position: absolute;
          inset: 40% 0 0 0;
          background: linear-gradient(180deg, rgba(37, 99, 235, 0.5), rgba(37, 99, 235, 0));
        }

        .chart-x-axis {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          margin-top: 0.45rem;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .chart-x-axis span {
          text-align: center;
        }

        .report-list {
          margin-top: 0.8rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .report-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6rem 0.8rem;
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          background: #f9fafb;
        }

        .report-name {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .report-date {
          margin: 0.2rem 0 0;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .security-log-list {
          list-style: none;
          padding-left: 0;
          margin: 0.7rem 0 0;
        }

        .security-log-item {
          display: flex;
          gap: 0.55rem;
          padding: 0.45rem 0;
          font-size: 0.8rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        .security-log-item:last-child {
          border-bottom: none;
        }

        .security-log-time {
          width: 70px;
          color: var(--text-muted);
        }

        .security-log-text {
          flex: 1;
        }

        @media (max-width: 1024px) {
          .admin-shell {
            padding: 1rem;
          }
          .content-grid {
            grid-template-columns: 1fr;
          }
          .report-stats-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .admin-shell {
            flex-direction: row;
          }
          .admin-sidebar {
            width: 220px;
            flex-direction: column;
            margin-bottom: 0;
          }
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area,
          #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .admin-shell {
            background: #fff !important;
            padding: 0 !important;
          }
          .admin-main {
            box-shadow: none !important;
            background: #fff !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
          .card,
          .stat-card {
            box-shadow: none !important;
          }
        }
      `}</style>
    </>
  );
}