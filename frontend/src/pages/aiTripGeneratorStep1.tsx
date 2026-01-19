// frontend/src/pages/aiTripGeneratorStep1.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";

const AiTripGeneratorStep1: React.FC = () => {
  const navigate = useNavigate();
  
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);
  const [error, setError] = useState("");
  const [hoveredCard, setHoveredCard] = useState<"solo" | "group" | null>(null);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addMember = () => {
    const email = inputValue.trim();
    
    if (!email) {
      setError("Please enter an email address");
      return;
    }
    
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    if (groupMembers.includes(email)) {
      setError("This email has already been added");
      return;
    }
    
    setGroupMembers([...groupMembers, email]);
    setInputValue("");
    setError("");
  };

  const removeMember = (email: string) => {
    setGroupMembers(groupMembers.filter((m) => m !== email));
  };

  const goSolo = () => {
    window.location.href = "/ai-trip-generator-step-2";
  };

  const goGroup = async () => {
    if (groupMembers.length === 0) {
      setError("Please add at least one email address");
      return;
    }

    setSendingInvites(true);
    setError("");

    try {
      console.log("🚀 Creating group trip...");
      
      // Create trip
      const tripResponse = await apiFetch("/f1/trips/", {
        method: "POST",
        body: JSON.stringify({
          title: "New Group Trip",
          travel_type: "group_ai_pending",
          visibility: "private",
        }),
      });

      const tripId = tripResponse.id;
      console.log("✅ Trip created:", tripId);

      console.log("📧 Sending invitations...");
      
      for (const email of groupMembers) {
        await apiFetch(`/f1/trips/${tripId}/invite/`, {
          method: "POST",
          body: JSON.stringify({
            email: email,
            role: "editor",
          }),
        });
        console.log(`✅ Invited ${email}`);
      }
      
      console.log("✅ All invitations sent successfully!");

      navigate(`/ai-trip-generator-group?tripId=${tripId}`);
      
    } catch (err: any) {
      console.error("❌ Failed to create group trip:", err);
      setError(err.message || "Failed to send invitations. Please try again.");
      setSendingInvites(false);
    }
  };

  const ArrowIcon = () => (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transition: "transform 0.3s ease",
        transform: hoveredCard === "solo" ? "translateX(4px)" : "translateX(0)",
      }}
    >
      <path 
        d="M5 12H19M19 12L12 5M19 12L12 19" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      width: "100%",
      overflowX: "hidden",
      margin: 0,
      padding: 0,
      background: "linear-gradient(135deg, #fef3c7 0%, #fce7f3 50%, #dbeafe 100%)",
      backgroundSize: "300% 300%",
      animation: "colorShift 20s ease infinite",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    },

    container: {
      width: "100%",
      maxWidth: "1100px",
      padding: "60px 40px",
      boxSizing: "border-box",
      position: "relative",
      zIndex: 1,
    },

    pageTitle: {
      fontSize: "48px",
      fontWeight: 700,
      marginBottom: "50px",
      color: "#1e1e2f",
      textAlign: "center",
      textShadow: "0 2px 10px rgba(0,0,0,0.1)",
      letterSpacing: "-0.5px",
    },

    card: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      padding: "40px",
      borderRadius: "24px",
      boxShadow: hoveredCard === "solo" 
        ? "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(102,126,234,0.2)"
        : "0 10px 40px rgba(0,0,0,0.08)",
      border: "1px solid rgba(102,126,234,0.1)",
      marginBottom: "40px",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: hoveredCard === "solo" ? "translateY(-8px) scale(1.02)" : "translateY(0) scale(1)",
    },

    soloCardWrapper: {
      position: "relative",
      width: "100%",
    },

    soloButton: {
      width: "100%",
      background: "linear-gradient(135deg, #e8edff 0%, #dfe8ff 100%)",
      padding: "28px 35px",
      borderRadius: "18px",
      border: "2px solid #c7d2fe",
      fontSize: "28px",
      fontWeight: 600,
      textAlign: "left",
      cursor: "pointer",
      color: "#4f46e5",
      transition: "all 0.3s ease",
      boxShadow: hoveredCard === "solo"
        ? "0 8px 25px rgba(102, 126, 234, 0.25)"
        : "0 4px 15px rgba(102, 126, 234, 0.15)",
    },

    arrowRight: {
      position: "absolute",
      right: "30px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      background: "white",
      color: "#4f46e5",
      border: "2px solid #c7d2fe",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: hoveredCard === "solo"
        ? "0 8px 20px rgba(102, 126, 234, 0.2)"
        : "0 4px 12px rgba(102, 126, 234, 0.15)",
    },

    divider: {
      height: "2px",
      background: "linear-gradient(90deg, transparent, #b9c4ff, transparent)",
      width: "100%",
      margin: "50px 0",
    },

    groupCard: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      padding: "40px",
      borderRadius: "24px",
      boxShadow: hoveredCard === "group"
        ? "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(102,126,234,0.2)"
        : "0 10px 40px rgba(0,0,0,0.08)",
      border: "1px solid rgba(102,126,234,0.1)",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: hoveredCard === "group" ? "translateY(-8px) scale(1.02)" : "translateY(0) scale(1)",
    },

    groupHeader: {
      fontSize: "32px",
      fontWeight: 700,
      marginBottom: "30px",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    },

    inviteBox: {
      background: "linear-gradient(135deg, #f5f7ff 0%, #e8edff 100%)",
      borderRadius: "20px",
      padding: "28px",
      border: "1px solid #d0d9ff",
      marginBottom: "25px",
      transition: "all 0.3s ease",
    },

    inviteTitle: {
      fontWeight: 600,
      fontSize: "18px",
      marginBottom: "18px",
      color: "#1e293b",
    },

    inputArea: {
      display: "flex",
      gap: "14px",
      alignItems: "stretch",
    },

    input: {
      flex: 1,
      padding: "16px 20px",
      borderRadius: "14px",
      border: "2px solid #e2e8f0",
      fontSize: "15px",
      fontFamily: "inherit",
      transition: "all 0.3s ease",
      background: "white",
      outline: "none",
    },

    addButton: {
      padding: "16px 32px",
      background: "linear-gradient(135deg, #e8edff 0%, #dfe8ff 100%)",
      color: "#4f46e5",
      borderRadius: "14px",
      border: "2px solid #c7d2fe",
      cursor: "pointer",
      fontSize: "15px",
      fontWeight: 600,
      transition: "all 0.3s ease",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.15)",
      whiteSpace: "nowrap",
    },

    tagList: {
      marginTop: "20px",
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
    },

    tag: {
      padding: "10px 18px",
      background: "white",
      color: "#667eea",
      borderRadius: "30px",
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      fontSize: "14px",
      fontWeight: 500,
      border: "2px solid #e0e7ff",
      transition: "all 0.3s ease",
      boxShadow: "0 2px 8px rgba(102, 126, 234, 0.1)",
    },

    groupBtnWrapper: {
      width: "100%",
      display: "flex",
      justifyContent: "flex-end",
      marginTop: "15px",
    },

    groupBtn: {
      padding: "18px 40px",
      background: "linear-gradient(135deg, #e8edff 0%, #dfe8ff 100%)",
      color: "#4f46e5",
      borderRadius: "50px",
      border: "2px solid #c7d2fe",
      cursor: "pointer",
      fontSize: "17px",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: "12px",
      transition: "all 0.3s ease",
      boxShadow: "0 8px 25px rgba(102, 126, 234, 0.25)",
      opacity: sendingInvites ? 0.7 : 1,
    },

    errorMessage: {
      color: "#ef4444",
      fontSize: "14px",
      marginTop: "12px",
      padding: "12px 16px",
      background: "rgba(239, 68, 68, 0.1)",
      borderRadius: "12px",
      border: "1px solid rgba(239, 68, 68, 0.2)",
      fontWeight: 500,
    },

    successMessage: {
      color: "#10b981",
      fontSize: "14px",
      marginTop: "12px",
      padding: "12px 16px",
      background: "rgba(16, 185, 129, 0.1)",
      borderRadius: "12px",
      border: "1px solid rgba(16, 185, 129, 0.2)",
      fontWeight: 500,
    },

    spinner: {
      width: "18px",
      height: "18px",
      border: "3px solid rgba(79, 70, 229, 0.2)",
      borderTopColor: "#4f46e5",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    },
  };

  React.useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes colorShift {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }

      input:focus {
        border-color: #667eea !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
      }

      button:hover {
        transform: translateY(-2px);
      }

      button:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.pageTitle}>Choose Your Adventure</div>

        <div 
          style={styles.card}
          onMouseEnter={() => setHoveredCard("solo")}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={styles.soloCardWrapper}>
            <button style={styles.soloButton} onClick={goSolo}>
              Solo Traveler
            </button>

            <button style={styles.arrowRight} onClick={goSolo}>
              <ArrowIcon />
            </button>
          </div>
        </div>

        <div style={styles.divider}></div>

        <div 
          style={styles.groupCard}
          onMouseEnter={() => setHoveredCard("group")}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div style={styles.groupHeader}>Group Trip</div>

          <div style={styles.inviteBox}>
            <div style={styles.inviteTitle}>
              Invite tripmates via email
            </div>

            <div style={styles.inputArea}>
              <input
                style={styles.input}
                placeholder="Enter email address (e.g., friend@example.com)"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addMember();
                }}
              />
              <button style={styles.addButton} onClick={addMember}>
                Add
              </button>
            </div>

            {error && <div style={styles.errorMessage}>⚠️ {error}</div>}

            <div style={styles.tagList}>
              {groupMembers.map((email) => (
                <div key={email} style={styles.tag}>
                  {email}
                  <button
                    onClick={() => removeMember(email)}
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "#667eea",
                      fontWeight: 700,
                      fontSize: "16px",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#fee2e2";
                      e.currentTarget.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "none";
                      e.currentTarget.style.color = "#667eea";
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {groupMembers.length > 0 && !error && (
              <div style={styles.successMessage}>
                ✓ {groupMembers.length} {groupMembers.length === 1 ? "person" : "people"} will be invited
              </div>
            )}
          </div>

          <div style={styles.groupBtnWrapper}>
            <button 
              style={styles.groupBtn} 
              onClick={goGroup}
              disabled={sendingInvites || groupMembers.length === 0}
            >
              {sendingInvites ? (
                <>
                  <div style={styles.spinner} />
                  Sending invitations...
                </>
              ) : (
                "Send Invitations"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiTripGeneratorStep1;