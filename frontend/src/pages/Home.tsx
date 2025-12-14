import { Link } from "react-router-dom";
import { CSSProperties } from "react";

const col: CSSProperties = { flex: 1, minWidth: "240px" };
const name: CSSProperties = { fontSize: "1.6rem", fontWeight: 600, marginBottom: "1rem" };
const btn: CSSProperties = {
  display: "block",
  padding: "10px 16px",
  marginBottom: "10px",
  background: "#0b4a74",
  color: "white",
  borderRadius: "8px",
  textDecoration: "none",
  textAlign: "center",
  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
};

const smallLabel: CSSProperties = {
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#718096",
  marginTop: "0.75rem",
  marginBottom: "0.25rem",
};

export default function Home() {
  // demo trip id for testing the new sub-section bar layout
  const demoTripId = 1;

  return (
    <div style={{ minHeight: "100vh", background: "#edf2f7", padding: "3rem" }}>
      <h1 style={{ fontSize: "2.4rem", marginBottom: "0.5rem" }}>
        TripMate Frontend - Team Development Menu
      </h1>
      <p style={{ marginBottom: "2rem", color: "#4a5568" }}>
        Click any page to test individually. No flow dependencies.
      </p>

      <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
        {/* Vania */}
        <div style={col}>
          <div style={name}>Vania</div>

          {/* Original / standalone */}
          <span style={smallLabel}>Standalone pages</span>
          <Link to="/dashboard" style={btn}>Dashboard</Link>
          <Link to="/ai-trip-generator-step1" style={btn}>
            AI Trip Generator - Step 1 (F1.3 &amp; F2.2)
          </Link>
          <Link to="/ai-trip-generator-step2" style={btn}>
            AI Trip Generator - Step 2 (F1.3)
          </Link>
          <Link to="/create-trip" style={btn}>
            Create New Manual Trip (F1.1)
          </Link>
          {/* Use trip layout for itinerary editor */}
          <Link to={`/trip/${demoTripId}/itinerary`} style={btn}>
            Trip Itinerary Editor (F1.1 &amp; F1.2)
          </Link>
          <Link to="/chatbot" style={btn}>Chatbot (F1.3)</Link>
        </div>

        {/* PohYee */}
        <div style={col}>
          <div style={name}>PohYee</div>
          <Link to="/export-pdf" style={btn}>Export PDF (F6)</Link>
          <Link to="/signin" style={btn}>Sign In/Sign Up (F7.1)</Link>
          <Link to="/landing-page" style={btn}>Landing Page (F7.2)</Link>
          <Link to="/travel-guides-tutorial" style={btn}>Travel Guides Tutorial (F7.2)</Link>
          <Link to="/guest-faq" style={btn}>TripMate FAQ (F7.3)</Link>
          <Link to="/admin-dashboard" style={btn}>Admin Dashboard (F8)</Link>
          <Link to="/profile" style={btn}>Edit Profile</Link>
        </div>

        {/* KK */}
        <div style={col}>
          <div style={name}>KK</div>
          <Link to="/discovery-local" style={btn}>Discovery - Local (F2.4)</Link>
          <Link to="/discovery-international" style={btn}>Discovery - International (F2.4)</Link>
          <Link to="/discovery-faq" style={btn}>Discovery - FAQ (F2.4)</Link>
        </div>

        {/* Mingyu */}
        <div style={col}>
          <div style={name}>Mingyu</div>
          <Link to="/destination-faq-panel" style={btn}>Destination FAQ Panel (F1.6)</Link>
          <Link to="/local-info-panel" style={btn}>Travel Info &amp; Localisation (F4)</Link>
          <Link to="/group-wait-for-friends" style={btn}>Waiting For Friends (F2.2)</Link>
          <Link to="/group-itinerary-summary" style={btn}>Group Itinerary Summary (F2.2)</Link>
          {/* Use trip layout for these */}
          <Link to={`/trip/${demoTripId}/recommendations`} style={btn}>
            Itinerary Recommendation
          </Link>
          <Link to={`/trip/${demoTripId}/media`} style={btn}>
            Media Highlights
          </Link>
        </div>

        {/* Su */}
        <div style={col}>
          <div style={name}>Su</div>
          <Link to={`/trip/${demoTripId}/notes`} style={btn}>
            Notes &amp; Checklists (F3.2 &amp; F3.3)
          </Link>
          <Link to={`/trip/${demoTripId}/budget`} style={btn}>
            Budgeting (F3.1)
          </Link>
        </div>
      </div>
    </div>
  );
}
