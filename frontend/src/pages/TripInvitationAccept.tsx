// ==============================================================================
// FILE: frontend/src/pages/TripInvitationAccept.tsx
// PURPOSE: Handle trip invitation acceptance via email link
// ==============================================================================

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

const TripInvitationAccept: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tripInfo, setTripInfo] = useState<any>(null);

  useEffect(() => {
    acceptInvitation();
  }, []);

  const acceptInvitation = async () => {
    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Not logged in - save token and redirect to login
        localStorage.setItem("pendingInviteToken", token || "");
        navigate("/signin");
        return;
      }

      // User is logged in - verify and accept invitation
      const response = await apiFetch(`/f1/trip-invitation/${token}/accept/`, {
        method: "POST",
      });

      if (response.success) {
        setTripInfo(response.trip);
        
        // Success - redirect to trip page after 2 seconds
        setTimeout(() => {
          navigate(`/ai-trip-generator-group?tripId=${response.trip.id}`);
        }, 2000);
      } else {
        setError(response.error || "Failed to accept invitation");
      }
      
    } catch (err: any) {
      console.error("Error accepting invitation:", err);
      setError(err.message || "Invalid or expired invitation");
    } finally {
      setLoading(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "Inter, sans-serif",
    },
    card: {
      background: "white",
      padding: "48px",
      borderRadius: "24px",
      maxWidth: "500px",
      width: "90%",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      textAlign: "center",
    },
    icon: {
      fontSize: "64px",
      marginBottom: "24px",
    },
    title: {
      fontSize: "28px",
      fontWeight: 700,
      marginBottom: "16px",
      color: "#1e293b",
    },
    message: {
      fontSize: "16px",
      color: "#64748b",
      marginBottom: "24px",
    },
    spinner: {
      width: "48px",
      height: "48px",
      border: "4px solid #e2e8f0",
      borderTopColor: "#667eea",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      margin: "0 auto",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {loading && (
          <>
            <div style={styles.spinner} />
            <div style={styles.message}>Processing your invitation...</div>
          </>
        )}

        {!loading && error && (
          <>
            <div style={styles.icon}>❌</div>
            <div style={styles.title}>Invalid Invitation</div>
            <div style={styles.message}>{error}</div>
          </>
        )}

        {!loading && tripInfo && (
          <>
            <div style={styles.icon}>✅</div>
            <div style={styles.title}>Welcome to {tripInfo.title}!</div>
            <div style={styles.message}>
              You've successfully joined the trip. Redirecting...
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TripInvitationAccept;