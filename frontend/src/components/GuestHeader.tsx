// frontend/src/components/GuestHeader.tsx
import { Link } from "react-router-dom";

export default function GuestHeader() {
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
        <Link to="/" style={styles.link}>Home</Link>
        <Link to="/about" style={styles.link}>About Us</Link>
        <Link to="/travel-guides-tutorial" style={styles.link}>Travel Guides</Link>
        <Link to="/guest-faq" style={styles.link}>FAQ</Link>

        <Link to="/signin" style={styles.signupBtn}>
          Sign Up Now →
        </Link>
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
    color: "#475569",
    textDecoration: "none",
    fontSize: "1rem",
    fontWeight: 500,
  },
  signupBtn: {
    padding: "10px 18px",
    backgroundColor: "#0b4a74",
    color: "white",
    borderRadius: "8px",
    textDecoration: "none",
  },
};
