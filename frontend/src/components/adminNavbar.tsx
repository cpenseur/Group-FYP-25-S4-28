import React from "react";
import logo from "../assets/logo.png";

type AdminNavbarProps = {
  onProfileClick: () => void;
  onLogoutClick: () => void;
};

export default function AdminNavbar({
  onProfileClick,
  onLogoutClick,
}: AdminNavbarProps) {
  return (
    <>
      <header className="tm-nav">
        <div className="tm-nav-left">
          <img src={logo} alt="TripMate logo" className="tm-nav-logo" />
        </div>

        <div className="tm-nav-right">
          <button className="tm-nav-link" onClick={onProfileClick}>
            Profile
          </button>
          <button className="tm-nav-primary" onClick={onLogoutClick}>
            Log Out
          </button>
        </div>
      </header>

      <style>{`
        .tm-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          box-sizing: border-box;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
          font-family: system-ui, -apple-system, BlinkMacSystemFont,
            "SF Pro Text", "Segoe UI", sans-serif;
        }

        .tm-nav-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tm-nav-logo {
          height: 40px;
          width: auto;
          display: block;
        }

        .tm-nav-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .tm-nav-link {
          border: none;
          background: transparent;
          font-size: 0.85rem;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
        }

        .tm-nav-link:hover {
          color: #111827;
        }

        .tm-nav-primary {
          border: none;
          cursor: pointer;
          padding: 0.4rem 1.1rem;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 500;
          background: #0f4c81;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.25);
        }

        .tm-nav-primary:hover {
          background: #0c3c65;
        }
      `}</style>
    </>
  );
}
