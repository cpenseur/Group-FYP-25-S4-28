import LandingNavbar from "../components/landingNavbar";
import LandingFooter from "../components/landingFooter";
import map from "../assets/sgMap.jpg";
import { useState } from "react";

export default function TravelGuidesTutorial() {
  const navLinks = [
    { name: 'Home', path: '/landing-page#hero' },
    { name: 'About Us', path: '/landing-page#about' },
    { name: 'Travel Guides', path: '/travel-guides-tutorial' },
    { name: 'FAQ', path: '/guest-faq' },
  ];

  const activities = [
    { time: "10:00", name: "Hong Lim Food Centre", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Kaya_toast_on_a_plate.jpg/1200px-Kaya_toast_on_a_plate.jpg" },
    { time: "13:00", name: "Marina Bay Sands", img: "https://www.marinabaysands.com/content/dam/marinabaysands/guides/exceptional-experiences/architecture-of-mbs/masthead-m.jpg" },
    { time: "15:00", name: "Gardens by the Bay", img: "data:image/jpeg;base64,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"},
    { time: "18:00", name: "Maxwell Food Centre", img: "https://sethlui.com/wp-content/uploads/2019/06/maxwell-food-centre-ah-tai-tian-tian-hainanese-chicken-rice-chinatown-25.jpg" },
    { time: "10:00", name: "Floral Fantasy", img: "https://www.gardensbythebay.com.sg/content/dam/gbb-2021/image/things-to-do/attractions/floral-fantasy/main/floral-fantasy-main.jpg" },
    { time: "18:00", name: "Sentosa", img: "https://media.cnn.com/api/v1/images/stellar/prod/220905203459-05-old-sentosa-island.jpg?c=original" },
    { time: "20:00", name: "Hiking Trail", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400" },
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
      <LandingNavbar navLinks={navLinks} />

      {/* 2. HEADER - Stats Section */}
      <div style={{ backgroundColor: "white", padding: "20px 40px" }}>
        <div style={{ maxWidth: "1600px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          
          {/* Title and Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>Trip to Singapore</h1>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ padding: "8px 16px", backgroundColor: "#5b4ddb", color: "white", border: "none", borderRadius: "999px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>+ invite collaborators</button>
              <button style={{ padding: "8px 16px", backgroundColor: "#ede9fe", color: "#5b4ddb", border: "none", borderRadius: "999px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Share</button>
              <button style={{ padding: "8px 16px", backgroundColor: "#a855f7", color: "white", border: "none", borderRadius: "999px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Export</button>
            </div>
          </div>

          {/* Stats Section with Location/Duration Icons */}
          <div style={{ display: "flex", gap: "50px" }}>
            
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
                  $ 800
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. TABS */}
      <div style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 40px" }}>
          <div style={{ display: "flex", gap: "40px" }}>
            {["Itinerary", "Notes & Checklists", "Budget", "Media Highlights", "Recommendations"].map(tab => (
              <button key={tab} style={{
                padding: "16px 0",
                border: "none",
                background: "none",
                fontSize: "14px",
                fontWeight: tab === "Itinerary" ? "bold" : "500",
                color: tab === "Itinerary" ? "#111" : "#666",
                borderBottom: tab === "Itinerary" ? "3px solid #111" : "3px solid transparent",
                cursor: "pointer"
              }}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. MAIN GRID LAYOUT - 3 Columns */}
      <div style={{ display: "flex", maxWidth: "1600px", margin: "0 auto", padding: "30px 40px", gap: "30px" }}>
        
        {/* COLUMN 1: Map */}
        <div style={{ width: "500px", flexShrink: 0 }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
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
          <div style={{ marginBottom: "30px" }}>
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
                    <button style={{ padding: "6px 20px", backgroundColor: "#f3e8ff", color: "#7c3aed", border: "none", borderRadius: "999px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}>Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Day 2 Section */}
           <div>
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
  <button
    style={{
      position: "absolute",
      top: 10,
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
      marginTop: "32px",
      minHeight: "730px", // similar to map height
      borderRadius: "20px 0 0 20px",
      background: "linear-gradient(to bottom, #ffffff, #e5efff)",
      boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
      padding: "70px 18px 24px", // space below pill
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
    <div style={{ fontSize: "11px", lineHeight: 1.4 }}>
      <div style={{ color: "#6b7280", letterSpacing: "0.08em", fontWeight: 600 }}>
        THU&nbsp;&nbsp;20/10
      </div>
      <div style={{ color: "#9ca3af", marginTop: "2px" }}>Day 1</div>
    </div>

    {/* Day 2 */}
    <div style={{ fontSize: "11px", lineHeight: 1.4 }}>
      <div style={{ color: "#6b7280", letterSpacing: "0.08em", fontWeight: 600 }}>
        FRI&nbsp;&nbsp;21/10
      </div>
      <div style={{ color: "#cbd5f5", marginTop: "2px" }}>Day 2</div>
    </div>
  </div>
</div>

      </div>
      <LandingFooter />
    </div>
  );
}