import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LandingNavbar from "../components/landingNavbar";
import LandingFooter from "../components/landingFooter";

import mbs from "../assets/mbs.jpg";
import sentosa from "../assets/sentosa.jpg";
import gbtb from "../assets/gbtb.jpg";
import beijing from "../assets/beijing.jpg";
import shanghai from "../assets/shanghai.jpg";
import guilin from "../assets/guilin.jpg";
import tokyo from "../assets/tokyo.jpg";
import kyoto from "../assets/kyoto.jpg";
import osaka from "../assets/osaka.png";

// JSON data
import guidesData from "../data/guides.json";

type DemoProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
};

// map filename in JSON -> imported image
const imageMap: Record<string, string> = {
  "mbs.jpg": mbs,
  "sentosa.jpg": sentosa,
  "gbtb.jpg": gbtb,
  "beijing.jpg": beijing,
  "shanghai.jpg": shanghai,
  "guilin.jpg": guilin,
  "tokyo.jpg": tokyo,
  "kyoto.jpg": kyoto,
  "osaka.png": osaka,
};

type Region = "Singapore" | "Japan" | "China" | "All";

export default function Demo({ onLoginClick, onSignupClick }: DemoProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navLinks = [
    { name: "Home", path: "/landing-page#hero" },
    { name: "About Us", path: "/landing-page#about" },
    { name: "Travel Guides", path: "/demo" }, // main listing route
    { name: "FAQ", path: "/guest-faq" },
  ];

  // turn JSON into usable objects (swap filename for real image)
  const guides = (guidesData as any[]).map((g) => ({
    ...g,
    image: imageMap[g.image as string],
  }));

  const locationState = location.state as { initialRegion?: Region } | null;

  const [selectedRegion, setSelectedRegion] = useState<Region>(
    locationState?.initialRegion || "Singapore"
  );

  const chips: Region[] = ["Singapore", "Japan", "China", "All"];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const guidesByRegion =
    selectedRegion === "All"
      ? guides
      : guides.filter((g) => g.region === selectedRegion);
  const filteredGuides = guidesByRegion.filter((guide) => {
    if (!normalizedQuery) return true;
    return (
      guide.title?.toLowerCase().includes(normalizedQuery) ||
      guide.location?.toLowerCase().includes(normalizedQuery) ||
      guide.region?.toLowerCase().includes(normalizedQuery) ||
      guide.desc?.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f3f4f6",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",        
      }}
    >
      {/* NAVBAR */}
      <LandingNavbar
        navLinks={navLinks}
        onLoginClick={onLoginClick}
        onSignupClick={onSignupClick}
      />

      {/* MAIN CONTENT */}
      <main
        style={{
          flex: 1,
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 16px 60px",
        }}
      >
        {/* Title */}
        <h1
          style={{
            textAlign: "center",
            fontSize: "32px",
            fontWeight: 800,
            marginBottom: "24px",
          }}
        >
          Explore travel guides and itineraries
        </h1>

        {/* Search bar */}
        <div style={{ maxWidth: "560px", margin: "0 auto 16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              padding: "10px 16px",
              boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
              gap: "10px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <input
              type="text"
              placeholder="Search for a destination ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                flex: 1,
                fontSize: "14px",
                color: "#4b5563",
              }}
            />
          </div>
        </div>

        {/* subtitle */}
        <div
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "#9CA3AF",
            marginBottom: "10px",
          }}
        >
          Or browse our most popular destinations
        </div>

        {/* chips */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          {chips.map((label) => {
            const isActive = selectedRegion === label;
            return (
              <button
                key={label}
                style={{
                  borderRadius: "999px",
                  padding: "6px 18px",
                  border: isActive ? "none" : "1px solid #e5e7eb",
                  backgroundColor: isActive ? "#111827" : "#ffffff",
                  color: isActive ? "#ffffff" : "#4b5563",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: isActive
                    ? "0 8px 18px rgba(15,23,42,0.3)"
                    : "none",
                }}
                onClick={() => setSelectedRegion(label)}
              >
                {label === "All" ? "All" : label}
              </button>
            );
          })}
        </div>

        {/* hint line */}
        <div
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "#6b7280",
            marginBottom: "26px",
          }}
        >
          ✨ Click on any travel guide below to view full details and itinerary 😊
        </div>

        {/* GRID OF CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "22px",
          }}
        >
          {filteredGuides.map((guide: any) => (
            <button
              key={guide.id}
              onClick={() =>
                navigate(`/travel-guides/${guide.id}`, {
                  state: { fromRegion: selectedRegion },
                })
              }
              style={{
                textAlign: "left",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "22px",
                  boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                {/* Image */}
                <div style={{ position: "relative", height: "180px" }}>
                  <img
                    src={guide.image}
                    alt={guide.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      left: "14px",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(17,24,39,0.8)",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>{guide.days}</span>
                    <span
                      style={{
                        width: "3px",
                        height: "3px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(229,231,235,0.8)",
                      }}
                    />
                    <span>{guide.tripType}</span>
                  </div>
                </div>

                {/* Content */}
                <div
                  style={{
                    padding: "16px 18px 14px",
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      marginBottom: "4px",
                      color: "#111827",
                    }}
                  >
                    {guide.title}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      marginBottom: "8px",
                    }}
                  >
                    {guide.location}
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                      lineHeight: 1.6,
                      margin: 0,
                      marginBottom: "14px",
                    }}
                  >
                    {guide.desc}
                  </p>

                  {/* bottom row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "auto",
                    }}
                  >
                    {/* author */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "999px",
                          backgroundImage:
                            "linear-gradient(135deg,#f97316,#fb7185)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 700,
                          marginRight: "8px",
                        }}
                      >
                        {guide.author
                          .split(" ")
                          .map((w: string) => w[0])
                          .join("")}
                      </div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#4b5563",
                          fontWeight: 600,
                        }}
                      >
                        {guide.author}
                      </span>
                    </div>

                    {/* stats */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "11px",
                        color: "#6b7280",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#9ca3af"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="3" />
                          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                        </svg>
                        <span>{guide.views}</span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
                        </svg>
                        <span>{guide.saves}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
