import React, { useState } from "react";
import tripmateLogo from "../assets/tripmate_logo.png"; // ✅ your imported logo

const AiTripGeneratorStep1: React.FC = () => {
  const [groupMembers, setGroupMembers] = useState(["plum_soda"]);
  const [inputValue, setInputValue] = useState("");

  // Add username to the group list
  const addMember = () => {
    const name = inputValue.trim();
    if (!name) return;
    if (groupMembers.includes(name)) return;
    setGroupMembers([...groupMembers, name]);
    setInputValue("");
  };

  // Remove username
  const removeMember = (name: string) => {
    setGroupMembers(groupMembers.filter((m) => m !== name));
  };

  // Navigation
  const goSolo = () => {
    window.location.href = "/ai-trip-generator-step2";
  };

  const goGroup = () => {
    window.location.href = "/ai-trip-generator-group";
  };

  // -------- INLINE CSS STYLES (your original sizing kept exactly) --------
  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      width: "100%",
      overflowX: "hidden",
      margin: 0,
      padding: 0,
      background:
        "linear-gradient(180deg, #eff3ff 0%, #ede8ff 45%, #d5e7ff 100%)",
      fontFamily: "Inter, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },

    // OUTER NAVBAR (full width)
    navOuter: {
      width: "100%",
      background: "white",
      borderBottom: "2px solid #d0d7ff",
      display: "flex",
      justifyContent: "center",
      boxSizing: "border-box",
    },

    // INNER NAVBAR (centered content)
    navInner: {
      width: "100%",
      maxWidth: "1400px",
      height: "70px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 40px",
      boxSizing: "border-box",
    },

    navRight: {
      display: "flex",
      gap: "28px",
      alignItems: "center",
      color: "#3b3b55",
      fontSize: "15px",
    },

    logoutBtn: {
      padding: "10px 20px",
      background: "#1e3a8a",
      color: "white",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
    },

    container: {
      width: "100%",
      maxWidth: "1200px",
      padding: "40px 80px",
      boxSizing: "border-box",
    },

    pageTitle: {
      fontSize: "34px",
      fontWeight: 600,
      marginBottom: "40px",
      color: "#1e1e2f",
    },

    card: {
      background: "white",
      padding: "35px",
      borderRadius: "20px",
      maxWidth: "950px",
      boxShadow: "0px 10px 25px rgba(0,0,0,0.08)",
      border: "1px solid #e5e7eb",
      marginBottom: "40px",
    },

    soloCardWrapper: {
      position: "relative",
      width: "100%",
    },

    soloButton: {
      width: "100%",
      background: "#ffffff",
      padding: "22px 30px",
      borderRadius: "16px",
      border: "2px solid #dbeafe",
      fontSize: "22px",
      textAlign: "left",
      cursor: "pointer",
    },

    arrowRight: {
      position: "absolute",
      right: "25px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "45px",
      height: "45px",
      borderRadius: "50%",
      background: "#4f46e5",
      color: "white",
      border: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      fontSize: "20px",
    },

    divider: {
      height: "2px",
      background: "#b9c4ff",
      width: "100%",
      maxWidth: "1000px",
      margin: "40px 0",
    },

    groupHeader: {
      fontSize: "24px",
      fontWeight: 600,
      marginBottom: "20px",
    },

    inviteBox: {
      background: "#e8edff",
      borderRadius: "18px",
      padding: "20px",
      border: "1px solid #c7d2fe",
      marginBottom: "20px",
    },

    inputArea: {
      display: "flex",
      gap: "12px",
      marginTop: "12px",
      alignItems: "center",
    },

    input: {
      flex: 1,
      padding: "12px 16px",
      borderRadius: "10px",
      border: "1px solid #b0b7ff",
      fontSize: "14px",
    },

    tagList: {
      marginTop: "15px",
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
    },

    tag: {
      padding: "6px 12px",
      background: "#e0e7ff",
      color: "#4f46e5",
      borderRadius: "20px",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
    },

    groupBtnWrapper: {
      width: "100%",
      display: "flex",
      justifyContent: "flex-end",
      marginTop: "10px",
    },

    groupBtn: {
      padding: "14px 26px",
      background: "#4338ca",
      color: "white",
      borderRadius: "30px",
      border: "none",
      cursor: "pointer",
      fontSize: "16px",
    },
  };

  return (
    <div style={styles.page}>

      {/* NAVIGATION BAR */}
      <div style={styles.navOuter}>
        <div style={styles.navInner}>

          {/* LOGO (your required final version) */}
          <img
            src={tripmateLogo}
            alt="TripMate"
            style={{ height: "150px", objectFit: "contain" }}
          />

          <div style={styles.navRight}>
            <span>Dashboard</span>
            <span>Trips</span>
            <span>Explore</span>
            <span>Profile</span>
            <button style={styles.logoutBtn}>Log Out</button>
          </div>

        </div>
      </div>

      {/* PAGE CONTENT */}
      <div style={styles.container}>

        <div style={styles.pageTitle}>Choose an Option</div>

        {/* SOLO TRAVELER CARD */}
        <div style={styles.card}>
          <div style={styles.soloCardWrapper}>
            <button style={styles.soloButton} onClick={goSolo}>
              Solo Traveler
            </button>

            <button style={styles.arrowRight} onClick={goSolo}>
              →
            </button>
          </div>
        </div>

        {/* DIVIDER */}
        <div style={styles.divider}></div>

        {/* GROUP TRIP CARD */}
        <div style={styles.card}>
          <div style={styles.groupHeader}>Group Trip</div>

          <div style={styles.inviteBox}>
            <div style={{ fontWeight: 600, fontSize: "15px" }}>Invite tripmates</div>
            <div style={{ fontSize: "13px", color: "#606080" }}>
              Add your friends and family to plan together
            </div>

            <div style={styles.inputArea}>
              <input
                style={styles.input}
                placeholder="Type TripMate username"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
              />
            </div>

            <div style={styles.tagList}>
              {groupMembers.map((name) => (
                <div key={name} style={styles.tag}>
                  {name}
                  <button
                    onClick={() => removeMember(name)}
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* BUTTON INSIDE WHITE CARD */}
          <div style={styles.groupBtnWrapper}>
            <button style={styles.groupBtn} onClick={goGroup}>
              → Create Group Session
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AiTripGeneratorStep1;
