// src/pages/adminDashboard.tsx (or wherever yours lives)
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { isAdminEmail } from "../api/adminList";
import AdminNavbar from "../components/adminNavbar";
import AdminSidebar from "../components/adminSidebar";
import { exportPDF as ExportPDF } from "../components/exportPDF";

// --- mock data --------------------------------------------------------------
const initialUsers = [
  { name: "Sarah Owen", email: "sarah@dreamplanner.com", status: "Active", date: "2023-06-11" },
  { name: "Liam Park", email: "liam@exploreinc.com", status: "Pending", date: "2023-05-22" },
  { name: "Vince Gomez", email: "vince@backpacker.io", status: "Manager", date: "2023-03-30" },
  { name: "Emma Thompson", email: "emma@blueskyapp.com", status: "Suspended", date: "2022-12-09" },
];

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

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeSidebarItem, setActiveSidebarItem] = useState("dashboard");
  const [activeTab, setActiveTab] = useState<"users" | "moderation">("moderation");
  const [moderationItems, setModerationItems] = useState(initialModerationItems);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [reviewClicked, setReviewClicked] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // controls Export PDF modal
  const [pdfOpen, setPdfOpen] = useState(false);

  // optional: show logged-in admin email on the UI pill
  const [userEmail, setUserEmail] = useState("");

  // ✅ IMPORTANT: Protect the page (no URL bypass)
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      // if session read fails, treat as not authorized
      if (error) {
        navigate("/login", { replace: true });
        return;
      }

      const email = (data.session?.user?.email ?? "").toLowerCase();

      // not logged in OR not admin => kick out
      if (!data.session || !isAdminEmail(email)) {
        navigate("/login", { replace: true });
        return;
      }

      setUserEmail(email);
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const filteredModerationItems = useMemo(() => {
    return showPendingOnly
      ? moderationItems.filter((item) => item.state === "pending")
      : moderationItems;
  }, [showPendingOnly, moderationItems]);

  const users = initialUsers;

  const handleApprove = (index: number) => {
    setModerationItems((items) =>
      items.map((item, i) => (i === index ? { ...item, state: "approved" } : item))
    );
  };

  const handleReject = (index: number) => {
    setModerationItems((items) =>
      items.map((item, i) => (i === index ? { ...item, state: "rejected" } : item))
    );
  };

  // what actually happens when user confirms "Export to PDF"
  const handleExportPDF = async () => {
    setPdfOpen(false);
    requestAnimationFrame(() => {
      window.print();
    });
  };

  return (
    <>
      <AdminNavbar
        onProfileClick={() => navigate("/profile")}
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
            {/* HEADER – ONLY ON DASHBOARD */}
            {activeSidebarItem === "dashboard" && (
              <header className="admin-header">
                <div>
                  <h1>Admin Dashboard</h1>
                  <p>
                    User Account Management, Destination Data, System Monitoring & Content Moderation
                  </p>
                </div>

                <div className="header-actions">
                  <button className="btn btn-outline" onClick={() => setPdfOpen(true)}>
                    Export Reports
                  </button>
                  <button className="btn btn-primary">↻ Refresh</button>

                  <div className="admin-user-pill">
                    <span className="avatar">AD</span>
                    <div>
                      <span className="pill-label">Admin User</span>
                      <span className="pill-name">
                        {userEmail ? userEmail : "Administrator"}
                      </span>
                    </div>
                  </div>
                </div>
              </header>
            )}

            {/* STATS – only for dashboard */}
            {activeSidebarItem === "dashboard" && (
              <section className="stats-row">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">TOTAL USERS</span>
                    <span className="stat-icon">👥</span>
                  </div>
                  <div className="stat-value">2,847</div>
                  <div className="stat-meta stat-meta--up">↑ 12.5% increase</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">ITINERARIES CREATED</span>
                    <span className="stat-icon stat-icon--pink">🧳</span>
                  </div>
                  <div className="stat-value">5,632</div>
                  <div className="stat-meta stat-meta--up">↑ 8.3% increase</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">PENDING VERIFICATIONS</span>
                    <span className="stat-icon stat-icon--red">⚠️</span>
                  </div>
                  <div className="stat-value">24</div>
                  <div className="stat-meta stat-meta--down">↑ 3 new today</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">DESTINATIONS</span>
                    <span className="stat-icon stat-icon--yellow">📍</span>
                  </div>
                  <div className="stat-value">187</div>
                  <div className="stat-meta stat-meta--up">↑ 5.7% increase</div>
                </div>
              </section>
            )}

            {/* GRID BELOW – SWITCH BY SIDEBAR ITEM */}
            <section className="content-grid">
              {/* DASHBOARD VIEW */}
              {activeSidebarItem === "dashboard" && (
                <>
                  <div className="card card-moderation">
                    <div className="card-header card-header--space">
                      <div>
                        <h2>
                          {activeTab === "moderation" ? "Content Moderation" : "User Accounts"}
                        </h2>
                      </div>

                      {activeTab === "moderation" && (
                        <button
                          className={
                            "btn btn-outline btn-small " + (showPendingOnly ? "btn-filter-active" : "")
                          }
                          onClick={() => setShowPendingOnly((prev) => !prev)}
                        >
                          ⌕ Filter
                        </button>
                      )}
                    </div>

                    <div className="tabs tabs--underline">
                      <button
                        className={"tab " + (activeTab === "users" ? "tab--underline-active" : "")}
                        onClick={() => setActiveTab("users")}
                      >
                        User Management
                      </button>
                      <button
                        className={
                          "tab " + (activeTab === "moderation" ? "tab--underline-active" : "")
                        }
                        onClick={() => setActiveTab("moderation")}
                      >
                        Content Moderation
                      </button>
                    </div>

                    {activeTab === "moderation" ? (
                      <div className="moderation-list">
                        {filteredModerationItems.length === 0 ? (
                          <p className="empty-text">No items to review. 🎉 Everything is up to date!</p>
                        ) : (
                          filteredModerationItems.map((item, idx) => {
                            const isPending = item.state === "pending";
                            const isApproved = item.state === "approved";
                            const isRejected = item.state === "rejected";

                            let stateLabel = item.statusText;
                            if (isApproved) stateLabel = "Approved";
                            if (isRejected) stateLabel = "Rejected";

                            return (
                              <div
                                key={idx}
                                className={
                                  "moderation-item " +
                                  (isApproved ? "moderation-item--approved" : "") +
                                  (isRejected ? " moderation-item--rejected" : "")
                                }
                              >
                                <div className="moderation-main">
                                  <div className="moderation-title-row">
                                    <span className="moderation-title">{item.title}</span>

                                    {item.severity === "red" && (
                                      <span className="moderation-tag moderation-tag--red">!</span>
                                    )}
                                    {item.severity === "orange" && (
                                      <span className="moderation-tag moderation-tag--orange">•</span>
                                    )}
                                    {isApproved && (
                                      <span className="moderation-tag moderation-tag--approved">
                                        Approved
                                      </span>
                                    )}
                                    {isRejected && (
                                      <span className="moderation-tag moderation-tag--rejected">
                                        Rejected
                                      </span>
                                    )}
                                  </div>

                                  <p className="moderation-sub">
                                    {stateLabel} • Submitted by {item.user}
                                  </p>
                                </div>

                                <div className="moderation-actions">
                                  <button
                                    className="btn btn-approve"
                                    onClick={() => handleApprove(idx)}
                                    disabled={!isPending}
                                  >
                                    ✓ Approve
                                  </button>
                                  <button
                                    className="btn btn-reject"
                                    onClick={() => handleReject(idx)}
                                    disabled={!isPending}
                                  >
                                    ✕ Reject
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <div className="user-table-wrapper">
                        <div className="table-toolbar">
                          <div className="input-wrapper">
                            <input placeholder="Search by name, email..." className="search-input" />
                          </div>
                          <button className="btn btn-outline">Search</button>
                        </div>

                        <table className="user-table">
                          <thead>
                            <tr>
                              <th>User</th>
                              <th>Email</th>
                              <th>Status</th>
                              <th>Joined</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map((user) => (
                              <tr key={user.email}>
                                <td>
                                  <div className="user-cell">
                                    <span className="avatar avatar--small">{user.name[0]}</span>
                                    <span>{user.name}</span>
                                  </div>
                                </td>
                                <td>{user.email}</td>
                                <td>
                                  <span
                                    className={
                                      "status-pill status-pill--" + user.status.toLowerCase()
                                    }
                                  >
                                    {user.status}
                                  </span>
                                </td>
                                <td>{user.date}</td>
                                <td>
                                  <div className="row-actions">
                                    <button className="link-button">View</button>
                                    <button className="link-button">Edit</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: PENDING ACTIONS */}
                  <aside className="card card-side">
                    <h2>Pending Actions</h2>

                    <div className="side-block side-block--primary">
                      <div className="side-block-header">
                        <div>
                          <span className="side-title">User Verifications</span>
                          <p className="side-sub">
                            24 new users
                            <br />
                            awaiting approval
                          </p>
                        </div>
                        <button
                          className="btn btn-primary btn-small"
                          onClick={() => setReviewClicked(true)}
                        >
                          Review
                        </button>
                      </div>
                      {reviewClicked && (
                        <p className="side-note">Opened verification queue (demo behavior).</p>
                      )}
                    </div>
                  </aside>
                </>
              )}

              {/* ANALYTICS VIEW */}
              {activeSidebarItem === "analytics" && (
                <>
                  <div className="card card-analytics">
                    <div className="card-header">
                      <h2>Analytics Overview</h2>
                    </div>

                    <div className="analytics-grid">
                      <div className="analytics-card">
                        <p className="analytics-label">Daily Active Users</p>
                        <p className="analytics-number">1,284</p>
                        <div className="mini-chart" />
                      </div>
                      <div className="analytics-card">
                        <p className="analytics-label">New Signups</p>
                        <p className="analytics-number">92</p>
                        <div className="mini-chart mini-chart--pink" />
                      </div>
                      <div className="analytics-card">
                        <p className="analytics-label">Avg. Session Length</p>
                        <p className="analytics-number">7.4 min</p>
                        <div className="mini-chart mini-chart--green" />
                      </div>
                    </div>
                  </div>

                  <aside className="card card-side">
                    <h2>Top Destinations</h2>
                    <ul className="simple-list">
                      <li>Bali, Indonesia</li>
                      <li>Tokyo, Japan</li>
                      <li>Barcelona, Spain</li>
                    </ul>
                  </aside>
                </>
              )}

              {/* USER MANAGEMENT VIEW */}
              {activeSidebarItem === "users" && (
                <>
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h2>User Accounts</h2>
                        <p>Search, filter and manage admin-level users.</p>
                      </div>
                      <button className="btn btn-primary">+ Add user</button>
                    </div>

                    <div className="user-table-wrapper">
                      <div className="table-toolbar">
                        <div className="input-wrapper">
                          <input placeholder="Search by name, email..." className="search-input" />
                        </div>
                        <button className="btn btn-outline">Search</button>
                      </div>

                      <table className="user-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.email}>
                              <td>
                                <div className="user-cell">
                                  <span className="avatar avatar--small">{user.name[0]}</span>
                                  <span>{user.name}</span>
                                </div>
                              </td>
                              <td>{user.email}</td>
                              <td>
                                <span
                                  className={"status-pill status-pill--" + user.status.toLowerCase()}
                                >
                                  {user.status}
                                </span>
                              </td>
                              <td>{user.date}</td>
                              <td>
                                <div className="row-actions">
                                  <button className="link-button">View</button>
                                  <button className="link-button">Edit</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <aside className="card card-side">
                    <h2>Roles Summary</h2>
                    <ul className="simple-list">
                      <li>3 Admins</li>
                      <li>12 Managers</li>
                      <li>245 Regular Users</li>
                    </ul>
                  </aside>
                </>
              )}

              {/* CONTENT MODERATION VIEW (from sidebar) */}
              {activeSidebarItem === "content" && (
                <>
                  <div className="card card-moderation">
                    <div className="card-header">
                      <h2>Content Moderation</h2>
                    </div>

                    <div className="moderation-list">
                      {moderationItems.map((item, idx) => {
                        const isPending = item.state === "pending";
                        const isApproved = item.state === "approved";
                        const isRejected = item.state === "rejected";

                        let stateLabel = item.statusText;
                        if (isApproved) stateLabel = "Approved";
                        if (isRejected) stateLabel = "Rejected";

                        return (
                          <div
                            key={idx}
                            className={
                              "moderation-item " +
                              (isApproved ? "moderation-item--approved" : "") +
                              (isRejected ? " moderation-item--rejected" : "")
                            }
                          >
                            <div className="moderation-main">
                              <div className="moderation-title-row">
                                <span className="moderation-title">{item.title}</span>
                                {item.severity === "red" && (
                                  <span className="moderation-tag moderation-tag--red">!</span>
                                )}
                                {item.severity === "orange" && (
                                  <span className="moderation-tag moderation-tag--orange">•</span>
                                )}
                                {isApproved && (
                                  <span className="moderation-tag moderation-tag--approved">
                                    Approved
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="moderation-tag moderation-tag--rejected">
                                    Rejected
                                  </span>
                                )}
                              </div>
                              <p className="moderation-sub">
                                {stateLabel} • Submitted by {item.user}
                              </p>
                            </div>

                            <div className="moderation-actions">
                              <button
                                className="btn btn-approve"
                                onClick={() => handleApprove(idx)}
                                disabled={!isPending}
                              >
                                ✓ Approve
                              </button>
                              <button
                                className="btn btn-reject"
                                onClick={() => handleReject(idx)}
                                disabled={!isPending}
                              >
                                ✕ Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <aside className="card card-side">
                    <h2>Guidelines</h2>
                    <ul className="simple-list">
                      <li>No hate speech or harassment</li>
                      <li>No explicit adult content</li>
                      <li>Flag suspicious links</li>
                    </ul>
                  </aside>
                </>
              )}

              {/* REPORTS VIEW */}
              {activeSidebarItem === "reports" && (
                <>
                  <div className="card reports-main-card">
                    <div className="reports-topbar">
                      <div>
                        <h2>Reports</h2>
                        <p className="reports-subtitle">
                          Overview of generated and scheduled admin reports.
                        </p>
                      </div>

                      <div className="reports-actions">
                        <button className="btn btn-outline btn-small">⚙ Filters</button>
                        <button className="btn btn-outline btn-small">
                          Jan 01, 2025 – Feb 09, 2025
                        </button>
                        <button
                          className="btn btn-primary btn-small"
                          onClick={() => setPdfOpen(true)}
                        >
                          Generate Report
                        </button>
                      </div>
                    </div>

                    <div className="reports-tabs">
                      <button className="reports-tab reports-tab--active">Overview</button>
                      <button className="reports-tab">Usage</button>
                      <button className="reports-tab">Content</button>
                      <button className="reports-tab">Security</button>
                    </div>

                    <div className="report-stats-row">
                      <div className="report-stat-card">
                        <p className="report-stat-title">Reports generated</p>
                        <p className="report-stat-main">36</p>
                        <p className="report-stat-sub report-stat-sub--up">↑ 10% vs last month</p>
                      </div>
                      <div className="report-stat-card">
                        <p className="report-stat-title">Downloads</p>
                        <p className="report-stat-main">128</p>
                        <p className="report-stat-sub report-stat-sub--up">↑ 18% vs last week</p>
                      </div>
                      <div className="report-stat-card">
                        <p className="report-stat-title">Scheduled reports</p>
                        <p className="report-stat-main">5</p>
                        <p className="report-stat-sub report-stat-sub--up">↑ 1 new this week</p>
                      </div>
                      <div className="report-stat-card">
                        <p className="report-stat-title">Failed deliveries</p>
                        <p className="report-stat-main">2</p>
                        <p className="report-stat-sub report-stat-sub--down">↓ 3 vs last month</p>
                      </div>
                    </div>

                    <div className="chart-card">
                      <div className="chart-header-row">
                        <h3>Report Activity</h3>
                        <div className="chart-tabs">
                          <button className="chart-tab chart-tab--active">Time Weighted</button>
                          <button className="chart-tab">Volume</button>
                          <button className="chart-tab">Exports</button>
                          <button className="chart-tab">Errors</button>
                        </div>
                      </div>

                      <div className="chart-area">
                        <div className="chart-y-axis">
                          <span>100</span>
                          <span>80</span>
                          <span>60</span>
                          <span>40</span>
                          <span>20</span>
                          <span>0</span>
                        </div>
                        <div className="chart-line-wrapper">
                          <div className="chart-line-fill" />
                        </div>
                      </div>

                      <div className="chart-x-axis">
                        <span>Jan</span>
                        <span>Feb</span>
                        <span>Mar</span>
                        <span>Apr</span>
                        <span>May</span>
                        <span>Jun</span>
                        <span>Jul</span>
                        <span>Aug</span>
                        <span>Sep</span>
                        <span>Oct</span>
                        <span>Nov</span>
                        <span>Dec</span>
                      </div>
                    </div>

                    <div className="chart-card chart-card--secondary">
                      <div className="chart-header-row">
                        <h3>Available Reports</h3>
                      </div>

                      <div className="report-list">
                        {reportItems.map((r) => (
                          <div key={r.name} className="report-item">
                            <div>
                              <p className="report-name">{r.name}</p>
                              <p className="report-date">Generated {r.date}</p>
                            </div>
                            <button className="btn btn-outline btn-small">Download</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <aside className="card card-side">
                    <h2>Scheduled Reports</h2>
                    <ul className="simple-list">
                      <li>Weekly Activity – every Monday</li>
                      <li>Monthly Summary – 1st of month</li>
                      <li>Quarterly Performance – last business day</li>
                    </ul>
                  </aside>
                </>
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

      {/* PDF MODAL (always mounted; returns null if open=false) */}
      <ExportPDF open={pdfOpen} onClose={() => setPdfOpen(false)} onExport={handleExportPDF} />

      {/* CSS INLINE */}
      <style>{`
        /* (KEEP YOUR EXISTING CSS EXACTLY AS-IS) */
        ${""}
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
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
            sans-serif;
        }

        body {
          margin: 0;
          background: #e5e7eb;
        }

        /* LAYOUT */
        .admin-shell {
          display: flex;
          min-height: 100vh;
          background: linear-gradient(135deg, #dde4ff, #f5f7fb);
          padding: 2rem;
          box-sizing: border-box;
        }

        /* SIDEBAR */
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

        /* Collapsible sidebar */
        .admin-sidebar--collapsed {
          width: 76px;
          padding: 1.25rem 0.8rem;
        }

        /* top row */
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

        /* hide labels + section headers when collapsed */
        .admin-sidebar--collapsed .nav-label {
          display: none;
        }

        .admin-sidebar--collapsed .sidebar-section,
        .admin-sidebar--collapsed .sidebar-divider {
          display: none;
        }

        /* center icons when collapsed */
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

        /* MAIN */
        .admin-main {
          flex: 1;
          background: var(--bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
          padding: 1.75rem 2rem 2rem;
          display: flex;
          flex-direction: column;
        }

        /* HEADER */
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

        /* BUTTONS */
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

        /* USER PILL */
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

        /* AVATAR */
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

        /* STATS */
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

        .stat-icon--yellow {
          background: #fef3c7;
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

        /* GRID BELOW */
        .content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.2rem;
          align-items: flex-start;
        }

        /* CARDS */
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

        /* TABS (underline style) */
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

        /* MODERATION LIST */
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

        /* USER TABLE */
        .user-table-wrapper {
          margin-top: 0.7rem;
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

        .user-table {
          width: 100%;
          border-collapse: collapse;
        }

        .user-table th {
          font-size: 0.8rem;
          color: var(--text-muted);
          text-align: left;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 0.5rem;
        }

        .user-table td {
          padding: 0.6rem 0.3rem;
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
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

        /* RIGHT PANEL */
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

        /* ANALYTICS VIEW */
        .card-analytics {
          min-height: 180px;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 0.8rem;
        }

        .analytics-card {
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          padding: 0.7rem 0.8rem;
          background: #f9fafb;
        }

        .analytics-label {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin: 0 0 0.2rem;
        }

        .analytics-number {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.4rem;
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

        /* Simple lists */
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

        /* Reports – analytics-style layout */
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

        /* stat row in reports */
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

        /* main chart card */
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

        /* fake chart area */
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

        /* bottom report list inside reports */
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

        /* Security */
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

        /* RESPONSIVE */
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