import React from "react";

type SidebarItem =
  | "dashboard"
  | "analytics"
  | "users"
  | "itineraries"
  | "content"
  | "faqs"
  | "reports"
  | "faq";

type TabKey = "users" | "moderation";

type Props = {
  activeSidebarItem: SidebarItem;
  onSelect: (item: SidebarItem, tab?: TabKey) => void;
  collapsed: boolean;
  onToggle: () => void;
};

export default function AdminSidebar({
  activeSidebarItem,
  onSelect,
  collapsed,
  onToggle,
}: Props) {
  return (
    <aside className={"admin-sidebar " + (collapsed ? "admin-sidebar--collapsed" : "")}>
      {/* top toggle row */}
      <div className="sidebar-top">
        {!collapsed && <div className="sidebar-brand">Admin</div>}
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="sidebar-nav">
        <p className="sidebar-section">MAIN</p>

        <button
          className={"nav-item " + (activeSidebarItem === "dashboard" ? "nav-item--active" : "")}
          onClick={() => onSelect("dashboard", "moderation")}
        >
          <span className="nav-icon">◎</span>
          <span className="nav-label">Dashboard</span>
        </button>

        <button
          className={"nav-item " + (activeSidebarItem === "analytics" ? "nav-item--active" : "")}
          onClick={() => onSelect("analytics")}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Analytics</span>
        </button>

        <button
          className={"nav-item " + (activeSidebarItem === "users" ? "nav-item--active" : "")}
          onClick={() => onSelect("users", "users")}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">User Management</span>
        </button>

        <div className="sidebar-divider" />

        <p className="sidebar-section">CONTENT</p>

        <button
          className={"nav-item " + (activeSidebarItem === "content" ? "nav-item--active" : "")}
          onClick={() => onSelect("content", "moderation")}
        >
          <span className="nav-icon">✏️</span>
          <span className="nav-label">Content Moderation</span>
        </button>

        <button
          className={"nav-item " + (activeSidebarItem === "itineraries" ? "nav-item--active" : "")}
          onClick={() => onSelect("itineraries")}
        >
          <span className="nav-icon">🗺️</span>
          <span className="nav-label">Itineraries</span>
        </button>

        <button
          className={"nav-item " + (activeSidebarItem === "faq" ? "nav-item--active" : "")}
          onClick={() => onSelect("faq")}
        >
          <span className="nav-icon">❓</span>
          <span className="nav-label">FAQ Management</span>
        </button>

        <div className="sidebar-divider" />

        <p className="sidebar-section">SYSTEM</p>

        <button
          className={"nav-item " + (activeSidebarItem === "reports" ? "nav-item--active" : "")}
          onClick={() => onSelect("reports")}
        >
          <span className="nav-icon">📄</span>
          <span className="nav-label">Reports</span>
        </button>
      </nav>
    </aside>
  );
}
