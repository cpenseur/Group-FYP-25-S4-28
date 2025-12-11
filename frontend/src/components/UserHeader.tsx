// frontend/src/components/UserHeader.tsx
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function UserHeader() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/signin"; // redirect after logout
  };

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <img
          src="/tripmate-logo.png"
          alt="TripMate Logo"
          style={{ height: "32px", marginRight: "8px" }}
        />
        <span style={styles.logoText}>TripMate</span>
      </div>

      <nav style={styles.nav}>
        <Link to="/dashboard" style={styles.link}>Dashboard</Link>
        <Link to="/ai-trip-generator-step1" style={styles.link}>Trips</Link>
        <Link to="/explore" style={styles.link}>Explore</Link>
        <Link to="/profile" style={styles.link}>Profile</Link>

        <button onClick={handleLogout} style={styles.logoutBtn}>
          Log Out
        </button>
      </nav>
    </header>
  );
}

const styles = {
  header: {
    width: "100%",
    display: "flex",
    padding: "14px 32px",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
  },
  left: {
    display: "flex",
    alignItems: "center",
  },
  logoText: {
    fontSize: "1.3rem",
    fontWeight: 700,
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
  },
  link: {
    color: "#034078",
    textDecoration: "none",
    fontSize: "1rem",
    fontWeight: 500,
  },
  logoutBtn: {
    padding: "10px 18px",
    backgroundColor: "#0b4a74",
    color: "white",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
  },
};
