import { useRef, useState, useCallback } from "react"; 
import jsPDF from "jspdf";                            
import html2canvas from "html2canvas";                 
import LandingNavbar from "../components/landingNavbar";
import LandingFooter from "../components/landingFooter";
import map from "../assets/sgMap.jpg";
import honglim from "../assets/honglim.jpg";
import mbs from "../assets/mbs.jpg";
import maxwell from "../assets/maxwell.jpg";
import sentosa from "../assets/sentosa.jpg";
import gbtb from "../assets/gbtb.jpg";
import floral from "../assets/floral.jpg";
import hill from "../assets/hill.jpg";
import { useNavigate } from "react-router-dom";

type TravelGuidesTutorialProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
};
export default function TravelGuidesTutorial({ onLoginClick, onSignupClick, }: TravelGuidesTutorialProps) {
  const navigate = useNavigate();
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [showExportPopup, setShowExportPopup] = useState(false);
  const handleExportPDF = useCallback(async () => {
    if (!exportRef.current) return;

    const canvas = await html2canvas(exportRef.current, {
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("trip-itinerary.pdf");
  }, []);

  const navLinks = [
    { name: 'Home', path: '/landing-page#hero' },
    { name: 'About Us', path: '/landing-page#about' },
    { name: 'Travel Guides', path: '/travel-guides-tutorial' },
    { name: 'FAQ', path: '/guest-faq' },
  ];

  const activities = [
    { time: "10:00", name: "Hong Lim Food Centre", img: honglim },
    { time: "13:00", name: "Marina Bay Sands", img: mbs },
    { time: "15:00", name: "Gardens by the Bay", img: gbtb},
    { time: "18:00", name: "Maxwell Food Centre", img: maxwell },
    { time: "10:00", name: "Floral Fantasy", img: floral },
    { time: "18:00", name: "Sentosa", img: sentosa },
    { time: "20:00", name: "Hiking Trail", img: hill },
  ];

  // Coordinates from your code
  const mapPoints = [
    { top: 25, left: 30 },
    { top: 40, left: 70 },
    { top: 60, left: 80 },
    { top: 75, left: 35 },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fff", fontFamily: "'Inter', sans-serif", color: "#333" }}>
      
      {/* 1. NAVBAR */}
      <LandingNavbar navLinks={navLinks} onLoginClick={onLoginClick} onSignupClick={onSignupClick} />
    <div ref={exportRef}>
      {/* 2. HEADER - Stats Section */}
      <div style={{ backgroundColor: "white", padding: "20px 40px" }}>
        <div style={{ maxWidth: "1600px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>      
          {/* Title and Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>Trip to Singapore</h1>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ padding: "8px 16px", backgroundColor: "#5b4ddb", color: "white", border: "none", borderRadius: "999px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} onClick={() => onSignupClick()}>+ invite collaborators</button>
              <button style={{ padding: "8px 16px", backgroundColor: "#ede9fe", color: "#5b4ddb", border: "none", borderRadius: "999px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} onClick={() => onSignupClick()}>Share</button>
              <button style={{ padding: "8px 16px", backgroundColor: "#a855f7", color: "white", border: "none", borderRadius: "999px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }} onClick={() => setShowExportPopup(true)}>Export</button>
            </div>
          </div>

          {/* Stats Section with Location/Duration Icons */}
          <div style={{ display: "flex", gap: "50px" }} onClick={() => onSignupClick()}>
            
            {/* Location */}
            <div>
               <div style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: "bold", marginBottom: "5px", letterSpacing: "0.5px" }}>LOCATION</div>
               <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "18px", fontWeight: "bold", color: "#1F2937" }}>
                  {/* Pin Icon */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  Singapore
               </div>
            </div>

            {/* Duration - UPDATED 6-DOT CALENDAR */}
            <div>
               <div style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: "bold", marginBottom: "5px", letterSpacing: "0.5px" }}>DURATION</div>
               <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "18px", fontWeight: "bold", color: "#1F2937" }}>
                  {/* Detailed 6-Dot Calendar Icon */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 2V6" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 2V6" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 10H21" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    {/* The 6 Dots */}
                    <path d="M8 14H8.01" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 14H12.01" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 14H16.01" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 18H8.01" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 18H12.01" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 18H16.01" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  2 days - 1 nights
               </div>
            </div>

            {/* Currency */}
            <div>
               <div style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: "bold", marginBottom: "5px", letterSpacing: "0.5px" }}>CURRENCY</div>
               <div style={{ fontSize: "18px", fontWeight: "bold", color: "#1F2937" }}>
                  SGD$ 800
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
            maxWidth: "1600px",
            margin: "0 auto",
            padding: "0 40px",
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
            {["Itinerary", "Notes & Checklists", "Budget", "Media Highlights", "Recommendations"].map(
              (tab) => {
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
              }
            )}
          </div>
        </div>
      </div>
      {/* 4. MAIN GRID LAYOUT - 3 Columns */}
      <div style={{ display: "flex", maxWidth: "1600px", margin: "0 auto", padding: "12px 40px 30px", gap: "30px" }}>
        
        {/* COLUMN 1: Map */}
        <div style={{ width: "500px", flexShrink: 0 }} onClick={() => onSignupClick()}>
          <div style={{ 
            position: "relative", 
            width: "100%", 
            height: "750px", 
            backgroundColor: "#e5e7eb", 
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
          }}>
            <img src={map} alt="Map" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }} />

            {/* SVG Lines */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
                <polyline
                  points={mapPoints.map(p => `${p.left},${p.top}`).join(" ")} 
                  fill="none"
                  stroke="#333" 
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Markers */}
            {activities.slice(0, 4).map((act, i) => (
              <div key={i} style={{
                position: "absolute",
                top: `${mapPoints[i].top}%`,
                left: `${mapPoints[i].left}%`,
                transform: "translate(-50%, -50%)",
                width: "32px", height: "32px",
                zIndex: 20
              }}>
                {/* Number Badge */}
                <div style={{
                  width: "32px", height: "32px",
                  backgroundColor: "white", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: "bold", fontSize: "14px", color: "#1f2937",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)", border: "2px solid #fff",
                  position: "relative", zIndex: 2
                }}>
                  {i + 1}
                </div>

                {/* Floating Image */}
                <img
                  src={act.img}
                  alt={act.name}
                  style={{
                    position: "absolute",
                    top: "50%",
                    transform: "translateY(-50%)",
                    left: i % 2 === 0 ? "42px" : "auto", 
                    right: i % 2 !== 0 ? "42px" : "auto", 
                    width: "90px", height: "65px",
                    borderRadius: "8px", border: "3px solid white",
                    boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
                    objectFit: "cover", backgroundColor: "white", zIndex: 1
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 2: Timeline */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0px" }} onClick={() => onSignupClick()}>
            <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>Itinerary Planner</h2>
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              
              {/* "Optimise route" with Orange/Purple Sparkles SVG */}
              <button style={{ background: "none", border: "none", color: "#7c3aed", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L14.5 7.5L20 10L14.5 12.5L12 18L9.5 12.5L4 10L9.5 7.5L12 2Z" fill="#F97316"/>
                  <path d="M19 17L20 19L22 20L20 21L19 23L18 21L16 20L18 19L19 17Z" fill="#F97316"/>
                </svg>
                Optimise route
              </button>

            </div>
          </div>

          {/* Day 1 Section */}
          <div style={{ marginBottom: "30px" }} onClick={() => onSignupClick()}>
            <div style={{ 
              backgroundColor: "#ede9fe", color: "#5b4ddb", 
              padding: "15px 20px", borderRadius: "12px", 
              fontWeight: "bold", display: "flex", justifyContent: "space-between", 
              marginBottom: "20px" 
            }}>
              <span>DAY 1 • Thursday, 20 October 2025</span>
              <span>▼</span>
            </div>

            <div style={{ position: "relative", paddingLeft: "15px" }}>
              <div style={{ position: "absolute", left: "93px", top: "10px", bottom: "10px", borderLeft: "2px dashed #e5e7eb", zIndex: 0 }}></div>

              {activities.slice(0, 4).map((act, i) => (
                <div key={i} style={{ display: "flex", marginBottom: "25px", position: "relative", zIndex: 1 }}>
                  <div style={{ width: "80px", paddingTop: "15px", fontSize: "13px", fontWeight: "600", color: "#666" }}>{act.time}</div>
                  <div style={{ width: "26px", display: "flex", justifyContent: "center", paddingTop: "20px" }}>
                     <div style={{ width: "8px", height: "8px", backgroundColor: "#7c3aed", borderRadius: "50%" }}></div>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "15px", paddingLeft: "15px" }}>
                    <img src={act.img} alt="" style={{ width: "60px", height: "60px", borderRadius: "12px", objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "4px" }}>{act.name}</div>
                      <div style={{ color: "#999", fontSize: "13px" }}>Location Singapore</div>
                    </div>
                    <button style={{ padding: "6px 20px", backgroundColor: "#f3e8ff", color: "#7c3aed", border: "none", borderRadius: "999px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }} onClick={() => onSignupClick()}>Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Day 2 Section */}
           <div onClick={() => onSignupClick()}>
            <div style={{ 
              backgroundColor: "#f3f4f6", color: "#374151", 
              padding: "15px 20px", borderRadius: "12px", 
              fontWeight: "bold", display: "flex", justifyContent: "space-between", 
              marginBottom: "20px" 
            }}>
              <span>DAY 2 • Friday, 21 October 2025</span>
              <span>▼</span>
            </div>
             
             <div style={{ position: "relative", paddingLeft: "15px" }}>
              <div style={{ position: "absolute", left: "93px", top: "10px", bottom: "10px", borderLeft: "2px dashed #e5e7eb", zIndex: 0 }}></div>
               {activities.slice(4).map((act, i) => (
                <div key={i} style={{ display: "flex", marginBottom: "25px", position: "relative", zIndex: 1 }}>
                  <div style={{ width: "80px", paddingTop: "15px", fontSize: "13px", fontWeight: "600", color: "#666" }}>{act.time}</div>
                  <div style={{ width: "26px", display: "flex", justifyContent: "center", paddingTop: "20px" }}>
                     <div style={{ width: "8px", height: "8px", backgroundColor: "#7c3aed", borderRadius: "50%" }}></div>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "15px", paddingLeft: "15px" }}>
                    <img src={act.img} alt="" style={{ width: "60px", height: "60px", borderRadius: "12px", objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "4px" }}>{act.name}</div>
                      <div style={{ color: "#999", fontSize: "13px" }}>Location Singapore</div>
                    </div>
                    <button style={{ padding: "6px 20px", backgroundColor: "#f3e8ff", color: "#7c3aed", border: "none", borderRadius: "999px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}>Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

{/* COLUMN 3: Right Sidebar (Planbot) */}
<div style={{ width: "130px", position: "relative" }}>

  {/* Planbot pill */}
  <button onClick={() => onSignupClick()}
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
      <path d="M12 2L14.5 7.5L20 10L14.5 12.5L12 18L9.5 12.5L4 10L9.5 7.5L12 2Z" fill="white" />
      <path d="M19 17L20 19L22 20L20 21L19 23L18 21L16 20L18 19L19 17Z" fill="white" />
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
    <div onClick={() => onSignupClick()}
      style={{
        fontSize: "15px",
        fontWeight: "700",
        color: "#1d4ed8", // blue like screenshot
        marginBottom: "4px",
      }}
    >
      Itinerary
    </div>

    {/* Day 1 */}
    <div style={{ fontSize: "11px", lineHeight: 1.4 }} onClick={() => onSignupClick()}>
      <div style={{ color: "#6b7280", letterSpacing: "0.08em", fontWeight: 600 }}>
        THU&nbsp;&nbsp;20/10
      </div>
      <div style={{ color: "#9ca3af", marginTop: "2px" }}>Day 1</div>
    </div>

    {/* Day 2 */}
    <div style={{ fontSize: "11px", lineHeight: 1.4 }} onClick={() => onSignupClick()}>
      <div style={{ color: "#6b7280", letterSpacing: "0.08em", fontWeight: 600 }}>
        FRI&nbsp;&nbsp;21/10
      </div>
      <div style={{ color: "#cbd5f5", marginTop: "2px" }}>Day 2</div>
    </div>
  </div>
</div>
      </div>
      </div>
            {/* Export PDF Popup */}
      {showExportPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setShowExportPopup(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "18px",
              padding: "1.75rem 2.25rem",
              minWidth: "260px",
              textAlign: "center",
              boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
            }}
          >
            <p
              style={{
                margin: "0 0 1.5rem",
                fontSize: "1.05rem",
                fontWeight: 600,
              }}
            >
              Want to export as PDF?
            </p>

            <button
              onClick={async () => {
                await handleExportPDF();
                setShowExportPopup(false);
              }}
              style={{
                padding: "0.7rem 1.4rem",
                borderRadius: "999px",
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
                marginBottom: "0.5rem",
              }}
            >
              Export to PDF
            </button>

            <button
              onClick={() => setShowExportPopup(false)}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "999px",
                border: "none",
                background: "transparent",
                color: "#6b7280",
                fontSize: "0.85rem",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <LandingFooter />
    </div>
  );
}