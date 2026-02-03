import { useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import LandingNavbar from "../components/landingNavbar";
import LandingFooter from "../components/landingFooter";

// Maps
import sgMap from "../assets/sgMap.jpg";
import tokyoMap from "../assets/tokyoMap.png";
import kyotoMap from "../assets/kyotoMap.png";
import osakaMap from "../assets/osakaMap.png";
import beijingMap from "../assets/beijingMap.png";
import shanghaiMap from "../assets/shanghaiMap.png";
import guilinMap from "../assets/guilinMap.png";

// images
import honglim from "../assets/honglim.jpg";
import mbs from "../assets/mbs.jpg";
import maxwell from "../assets/maxwell.jpg";
import sentosa from "../assets/sentosa.jpg";
import gbtb from "../assets/gbtb.jpg";
import floral from "../assets/floral.jpg";
import hill from "../assets/hill.jpg";
import supertree from "../assets/supertree.jpg";
import cloudForest from "../assets/cloudForest.jpg";
import garden from "../assets/garden.jpg";
import siloso from "../assets/siloso.jpg";
import luge from "../assets/luge.jpg";
import WOT from "../assets/WOT.jpeg";
import tokyo from "../assets/tokyo.jpg";
import shibuya from "../assets/shibuya.jpeg";
import shinjuku from "../assets/shinjuku.jpg";
import skytree from "../assets/skytree.jpg";
import omoide from "../assets/omoide.jpg";
import akihabara from "../assets/akihabara.jpg";
import sensoji from "../assets/sensoji.jpeg";
import kyoto from "../assets/kyoto.jpg";
import fushimi from "../assets/fushimi.jpg";
import nishiki from "../assets/nishiki.jpeg";
import gion from "../assets/gion.jpg";
import arashiyama from "../assets/arashiyama.jpg";
import kinkakuji from "../assets/kinkakuji.jpg";
import philosopher from "../assets/philosopher.jpg";
import osaka from "../assets/osaka.png";
import namba from "../assets/namba.jpg";
import shinsaibashi from "../assets/shinsaibashi.jpg";
import dotonbori from "../assets/dotonbori.jpg";
import osakaCastle from "../assets/osakaCastle.jpeg";
import umeda from "../assets/umeda.jpg";
import kuromon from "../assets/kuromon.jpg";
import beijing from "../assets/beijing.jpg";
import jingshan from "../assets/jingshan.jpg";
import tiananmen from "../assets/tiananmen.jpg";
import hutong from "../assets/hutong.jpg";
import greatwall from "../assets/greatwall.jpg";
import wangfujing from "../assets/wangfujing.JPG";
import peking from "../assets/peking.png";
import shanghai from "../assets/shanghai.jpg";
import pudong from "../assets/pudong.jpg";
import bund from "../assets/bund.jpeg";
import formerFrench from "../assets/formerFrench.jpg";
import huangpu from "../assets/huangpu.jpeg";
import nanjing from "../assets/nanjing.jpg";
import yuyuan from "../assets/yuyuan.jpeg";
import guilin from "../assets/guilin.jpg";
import karst from "../assets/karst.jpg";
import xianggong from "../assets/xianggong.jpg";
import liRiver from "../assets/liRiver.jpg";
import yangshuo from "../assets/yangshuo.jpg";

import itinerariesData from "../data/itinerary.json";

type TravelGuidesTutorialProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
};

// Types inferred from the JSON
type ItinerariesFile = typeof itinerariesData;
type Itinerary = ItinerariesFile["itineraries"][number];
type Day = Itinerary["days"][number];
type Activity = Day["activities"][number];

// Map activity image filenames → imported assets
const imageMap: Record<string, string> = {
  "honglim.jpg": honglim,
  "mbs.jpg": mbs,
  "maxwell.jpg": maxwell,
  "sentosa.jpg": sentosa,
  "gbtb.jpg": gbtb,
  "floral.jpg": floral,
  "hill.jpg": hill,
  "supertree.jpg": supertree,
  "cloudForest.jpg": cloudForest,
  "garden.jpg": garden,
  "siloso.jpg": siloso,
  "luge.jpg": luge,
  "WOT.jpeg": WOT,
  "tokyo.jpg": tokyo,
  "shibuya.jpeg": shibuya,
  "shinjuku.jpg": shinjuku,
  "omoide.jpg": omoide,
  "skytree.jpg": skytree,
  "akihabara.jpg": akihabara,
  "sensoji.jpeg": sensoji,            
  "kyoto.jpg": kyoto,
  "nishiki.jpg": nishiki,
  "philosopher.jpg": philosopher,
  "arashiyama.jpg": arashiyama,
  "fushimi.jpg": fushimi,
  "kinkakuji.jpg": kinkakuji,
  "gion.jpg": gion,
  "osaka.png": osaka,
  "umeda.jpg": umeda,
  "kuromon.jpg": kuromon,
  "shinsaibashi.jpg": shinsaibashi,
  "namba.jpg": namba,
  "osakaCastle.jpeg": osakaCastle,
  "dotonbori.jpg": dotonbori,
  "beijing.jpg": beijing,
  "wangfujing.jpg": wangfujing,
  "peking.png": peking,
  "greatwall.jpg": greatwall,
  "hutong.jpg": hutong,
  "tiananmen.jpg": tiananmen,
  "shanghai.jpg": shanghai,
  "bund.jpeg": bund,
  "nanjing.jpg": nanjing,
  "pudong.jpg": pudong,
  "yuyuan.jpeg": yuyuan,
  "formerFrench.jpg": formerFrench,
  "huangpu.jpeg": huangpu,
  "jingshan.jpg": jingshan,
  "guilin.jpg": guilin,
  "karst.jpg": karst,
  "yangshuo.jpg": yangshuo,
  "liRiver.jpg": liRiver,
  "xianggong.jpg": xianggong,
};

// Map itinerary.mapImage → map asset
const mapImageMap: Record<string, string> = {
  "sgMap.jpg": sgMap,
  "tokyoMap.png": tokyoMap,
  "kyotoMap.png": kyotoMap,
  "osakaMap.png": osakaMap,
  "beijingMap.png": beijingMap,
  "shanghaiMap.png": shanghaiMap,
  "guilinMap.png": guilinMap,
};

function resolveImage(imageName: Activity["image"]): string {
  return imageMap[imageName] || "";
}

export default function TravelGuidesTutorial({
  onLoginClick,
  onSignupClick,
}: TravelGuidesTutorialProps) {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const locationObj = useLocation();
  const fromRegion = (locationObj.state as { fromRegion?: string } | null)
    ?.fromRegion;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const navLinks = [
    { name: "Home", path: "/landing-page#hero" },
    { name: "About Us", path: "/landing-page#about" },
    { name: "Travel Guides", path: "/demo" }, 
    { name: "FAQ", path: "/guest-faq" },
  ];

  // Pick itinerary based on URL :guideId
  const allItineraries: Itinerary[] = itinerariesData.itineraries;
  const itinerary = allItineraries.find((it) => String(it.id) === guideId);

  if (!itinerary) {
    // If you clicked a guide that has no itinerary defined yet
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#fff",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: "#333",
        }}
      >
        <LandingNavbar
          navLinks={navLinks}
          onLoginClick={onLoginClick}
          onSignupClick={onSignupClick}
        />
        <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            Itinerary coming soon
          </h1>
          <p>We haven&apos;t created a detailed itinerary for this guide yet.</p>
        </div>
        <LandingFooter />
      </div>
    );
  }

  const { title, location, currency, duration, days, mapImage } = itinerary;

  const day1: Day | undefined = days[0];
  const day2: Day | undefined = days[1];

  const day1Activities: Activity[] = day1?.activities || [];
  const day2Activities: Activity[] = day2?.activities || [];

  const mapPoints =
    day1Activities
      .map((a) => a.mapPoint)
      .filter(
        (p): p is { top: number; left: number } =>
          !!p && typeof p.top === "number" && typeof p.left === "number"
      ) || [];

  const mapSrc = (mapImage && mapImageMap[mapImage]) || sgMap;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        color: "#333",
      }}
    >
      {/* 1. NAVBAR */}
      <LandingNavbar
        navLinks={navLinks}
        onLoginClick={onLoginClick}
        onSignupClick={onSignupClick}
      />

      {/* 2. HEADER - Stats Section */}
      <div style={{ backgroundColor: "white" }}>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "24px 24px 16px",
          }}
        >
          {/* Row 1: back button */}
          <div style={{ marginBottom: "20px" }}>
            <button
              style={{
                padding: "8px 18px",
                borderRadius: "999px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#fff",
                fontSize: "13px",
                cursor: "pointer",
              }}
              onClick={() =>
                fromRegion
                  ? navigate("/demo", { state: { initialRegion: fromRegion } })
                  : navigate("/demo")
              }
            >
              ← Back to all guides
            </button>
          </div>

          {/* Row 2: title + action buttons (left) and stats (right) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "32px",
            }}
          >
            {/* LEFT: title + buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap",
                maxWidth: "65%",                
              }}
            >
              <h1
                style={{
                  fontSize: "36px",
                  fontWeight: 800,
                  margin: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </h1>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#5b4ddb",
                    color: "white",
                    border: "none",
                    borderRadius: "999px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => onSignupClick()}
                >
                  + invite collaborators
                </button>

                <button
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#ede9fe",
                    color: "#5b4ddb",
                    border: "none",
                    borderRadius: "999px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => onSignupClick()}
                >
                  Share
                </button>

                <button
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#a855f7",
                    color: "white",
                    border: "none",
                    borderRadius: "999px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => onSignupClick()}
                >
                  Export
                </button>
              </div>
            </div>

            {/* RIGHT: stats */}
            <div
              style={{
                display: "flex",
                gap: "40px",
                flexShrink: 0,
              }}
              onClick={() => onSignupClick()}
            >
              {/* LOCATION */}
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#9CA3AF",
                    fontWeight: "bold",
                    marginBottom: "5px",
                    letterSpacing: "0.5px",
                  }}
                >
                  LOCATION
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#1F2937",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#1F2937"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {location}
                </div>
              </div>

              {/* DURATION */}
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#9CA3AF",
                    fontWeight: "bold",
                    marginBottom: "5px",
                    letterSpacing: "0.5px",
                  }}
                >
                  DURATION
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#1F2937",
                  }}
                >
                  {duration}
                </div>
              </div>

              {/* CURRENCY */}
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#9CA3AF",
                    fontWeight: "bold",
                    marginBottom: "5px",
                    letterSpacing: "0.5px",
                  }}
                >
                  CURRENCY
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#1F2937",
                  }}
                >
                  {currency}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TABS */}
      <div
        style={{
          background: "linear-gradient(90deg, #e0f2ff, #f5e9ff)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "52px",
              gap: "40px",
            }}
          >
            {[
              "Itinerary",
              "Notes & Checklists",
              "Budget",
              "Media Highlights",
              "Recommendations",
            ].map((tab) => {
              const isActive = tab === "Itinerary";

              return (
                <div
                  key={tab}
                  onClick={() => onSignupClick()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    background: isActive ? "#111827" : "transparent",
                    color: isActive ? "#ffffff" : "#6b7280",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: isActive ? "6px 18px" : "0",
                    borderRadius: isActive ? "999px" : "0",
                    cursor: "pointer",
                    boxShadow: isActive
                      ? "0 4px 10px rgba(15, 23, 42, 0.35)"
                      : "none",
                    transition: "all 0.15s ease",
                    textDecoration: "none",
                    outline: "none",
                    lineHeight: 1,
                  }}
                >
                  {tab}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. MAIN GRID LAYOUT - 3 Columns */}
      <div
        style={{
          display: "flex",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "24px 24px 40px",
          gap: "30px",
        }}
      >
        {/* COLUMN 1: Map */}
        <div
          style={{ width: "500px", flexShrink: 0 }}
          onClick={() => onSignupClick()}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "750px",
              backgroundColor: "#e5e7eb",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)",
            }}
          >
            <img
              src={mapSrc}
              alt={`${location} map`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.9,
              }}
            />

            {/* SVG Lines */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              <svg
                viewBox="0 0 100 100"
                style={{ width: "100%", height: "100%" }}
                preserveAspectRatio="none"
              >
                <polyline
                  points={mapPoints
                    .map((p) => `${p.left},${p.top}`)
                    .join(" ")}
                  fill="none"
                  stroke="#333"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Markers */}
            {day1Activities.map((act, i) => {
              const point = mapPoints[i];
              if (!point) return null;

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: `${point.top}%`,
                    left: `${point.left}%`,
                    transform: "translate(-50%, -50%)",
                    width: "32px",
                    height: "32px",
                    zIndex: 20,
                  }}
                >
                  {/* Number Badge */}
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      backgroundColor: "white",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      fontSize: "14px",
                      color: "#1f2937",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                      border: "2px solid #fff",
                      position: "relative",
                      zIndex: 2,
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Floating Image */}
                  <img
                    src={resolveImage(act.image)}
                    alt={act.name}
                    style={{
                      position: "absolute",
                      top: "50%",
                      transform: "translateY(-50%)",
                      left: i % 2 === 0 ? "42px" : "auto",
                      right: i % 2 !== 0 ? "42px" : "auto",
                      width: "90px",
                      height: "65px",
                      borderRadius: "8px",
                      border: "3px solid white",
                      boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)",
                      objectFit: "cover",
                      backgroundColor: "white",
                      zIndex: 1,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: Timeline */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0px",
            }}
            onClick={() => onSignupClick()}
          >
            <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>
              Itinerary Planner
            </h2>
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "#7c3aed",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "15px",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2L14.5 7.5L20 10L14.5 12.5L12 18L9.5 12.5L4 10L9.5 7.5L12 2Z"
                    fill="#F97316"
                  />
                  <path
                    d="M19 17L20 19L22 20L20 21L19 23L18 21L16 20L18 19L19 17Z"
                    fill="#F97316"
                  />
                </svg>
                Optimise route
              </button>
            </div>
          </div>

          {/* Day 1 Section */}
          {day1 && (
            <div
              style={{ marginBottom: "30px" }}
              onClick={() => onSignupClick()}
            >
              <div
                style={{
                  backgroundColor: "#ede9fe",
                  color: "#5b4ddb",
                  padding: "15px 20px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "20px",
                }}
              >
                <span>
                  {day1.label} • {day1.date}
                </span>
                <span>▼</span>
              </div>

              <div style={{ position: "relative", paddingLeft: "15px" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "93px",
                    top: "10px",
                    bottom: "10px",
                    borderLeft: "2px dashed #e5e7eb",
                    zIndex: 0,
                  }}
                />
                {day1Activities.map((act, i) => (
                  <div
                    key={`${act.name}-${i}`}
                    style={{
                      display: "flex",
                      marginBottom: "25px",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        paddingTop: "15px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#666",
                      }}
                    >
                      {act.time}
                    </div>
                    <div
                      style={{
                        width: "26px",
                        display: "flex",
                        justifyContent: "center",
                        paddingTop: "20px",
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          backgroundColor: "#7c3aed",
                          borderRadius: "50%",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "15px",
                        paddingLeft: "15px",
                      }}
                    >
                      <img
                        src={resolveImage(act.image)}
                        alt={act.name}
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "12px",
                          objectFit: "cover",
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: "16px",
                            marginBottom: "4px",
                          }}
                        >
                          {act.name}
                        </div>
                        <div style={{ color: "#999", fontSize: "13px" }}>
                          Location {location}
                        </div>
                      </div>
                      <button
                        style={{
                          padding: "6px 20px",
                          backgroundColor: "#f3e8ff",
                          color: "#7c3aed",
                          border: "none",
                          borderRadius: "999px",
                          fontWeight: "600",
                          cursor: "pointer",
                          fontSize: "13px",
                        }}
                        onClick={() => onSignupClick()}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day 2 Section */}
          {day2 && (
            <div onClick={() => onSignupClick()}>
              <div
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  padding: "15px 20px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "20px",
                }}
              >
                <span>
                  {day2.label} • {day2.date}
                </span>
                <span>▼</span>
              </div>

              <div style={{ position: "relative", paddingLeft: "15px" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "93px",
                    top: "10px",
                    bottom: "10px",
                    borderLeft: "2px dashed #e5e7eb",
                    zIndex: 0,
                  }}
                />
                {day2Activities.map((act, i) => (
                  <div
                    key={`${act.name}-${i}`}
                    style={{
                      display: "flex",
                      marginBottom: "25px",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        paddingTop: "15px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#666",
                      }}
                    >
                      {act.time}
                    </div>
                    <div
                      style={{
                        width: "26px",
                        display: "flex",
                        justifyContent: "center",
                        paddingTop: "20px",
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          backgroundColor: "#7c3aed",
                          borderRadius: "50%",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "15px",
                        paddingLeft: "15px",
                      }}
                    >
                      <img
                        src={resolveImage(act.image)}
                        alt={act.name}
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "12px",
                          objectFit: "cover",
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: "16px",
                            marginBottom: "4px",
                          }}
                        >
                          {act.name}
                        </div>
                        <div style={{ color: "#999", fontSize: "13px" }}>
                          Location {location}
                        </div>
                      </div>
                      <button
                        style={{
                          padding: "6px 20px",
                          backgroundColor: "#f3e8ff",
                          color: "#7c3aed",
                          border: "none",
                          borderRadius: "999px",
                          fontWeight: "600",
                          cursor: "pointer",
                          fontSize: "13px",
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 3: Right Sidebar (Planbot) */}
        <div style={{ width: "130px", position: "relative" }}>
          {/* Planbot pill */}
          <button
            onClick={() => onSignupClick()}
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "10px 30px",
              background: "linear-gradient(135deg, #ff9f50, #ffc772)",
              color: "#ffffff",
              borderRadius: "999px",
              border: "none",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 6px 18px rgba(249, 115, 22, 0.35)",
              zIndex: 2,
              whiteSpace: "nowrap",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L14.5 7.5L20 10L14.5 12.5L12 18L9.5 12.5L4 10L9.5 7.5L12 2Z"
                fill="white"
              />
              <path
                d="M19 17L20 19L22 20L20 21L19 23L18 21L16 20L18 19L19 17Z"
                fill="white"
              />
            </svg>
            Planbot
          </button>

          {/* Vertical sidebar */}
          <div
            style={{
              marginTop: "8px",
              minHeight: "730px",
              borderRadius: "20px 0 0 20px",
              background: "linear-gradient(90deg, #e0f2ff, #f5e9ff)",
              boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
              padding: "70px 18px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "26px",
              borderLeft: "1px solid #f3f4f6",
            }}
          >
            {/* Title */}
            <div
              onClick={() => onSignupClick()}
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "#1d4ed8",
                marginBottom: "4px",
              }}
            >
              Itinerary
            </div>

            {/* Day 1 */}
            {day1 && (
              <div
                style={{ fontSize: "11px", lineHeight: 1.4 }}
                onClick={() => onSignupClick()}
              >
                <div
                  style={{
                    color: "#6b7280",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                >
                  {day1.label}
                </div>
                <div style={{ color: "#9ca3af", marginTop: "2px" }}>
                  {day1.date}
                </div>
              </div>
            )}

            {/* Day 2 */}
            {day2 && (
              <div
                style={{ fontSize: "11px", lineHeight: 1.4 }}
                onClick={() => onSignupClick()}
              >
                <div
                  style={{
                    color: "#6b7280",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                >
                  {day2.label}
                </div>
                <div style={{ color: "#cbd5f5", marginTop: "2px" }}>
                  {day2.date}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
