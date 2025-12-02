// frontend/src/pages/landingPage.tsx
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        TripMate – Plan, Share & Relive Your Trips
      </h1>
      <p style={{ maxWidth: 600, color: "#9ca3af", marginBottom: "1.5rem" }}>
        Smart itineraries, AI planning, collaboration and more — all in one place.
      </p>

      <button
        onClick={() => navigate("/login-page")}
        style={{
          padding: "0.7rem 1.6rem",
          borderRadius: "999px",
          border: "none",
          background: "linear-gradient(135deg, #4ade80, #22c55e)",
          color: "#020617",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Get started – Log in / Sign up
      </button>
    </div>
  );
}
