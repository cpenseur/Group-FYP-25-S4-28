// ==============================================================================
// FILE: frontend/src/pages/groupWaitForFriends.tsx
// PURPOSE: Waiting page with REAL-TIME updates + Beautiful animated background
// ==============================================================================

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

type Collaborator = {
  email: string;
  status: "confirmed" | "pending";
  user_id?: string;
  is_owner?: boolean;
};

export default function GroupWaitForFriends() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  // ✅ Fetch collaborators
  const fetchCollaborators = async (showLoading = true) => {
    if (!tripId) return;

    try {
      if (showLoading) setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }

      const tripData = await apiFetch(`/f1/trips/${tripId}/`, {
        method: "GET",
      });

      let preferencesData: any[] = [];
      try {
        preferencesData = await apiFetch(`/f1/trips/${tripId}/group-preferences/`, {
          method: "GET",
        });
      } catch (prefError) {
        console.error("Failed to fetch preferences:", prefError);
      }

      const currentUserIsOwner = tripData.collaborators?.some(
        (collab: any) => 
          collab.user_id === user.id && 
          collab.role === "owner"
      );
      setIsOwner(currentUserIsOwner || false);

      const collaboratorList: Collaborator[] = (tripData.collaborators || []).map((collab: any) => {
        const hasPreferences = preferencesData.some(
          (pref: any) => pref.user_id === (collab.user_id || collab.user?.id)
        );

        return {
          email: collab.invited_email || collab.user?.email || collab.email || "Unknown",
          status: hasPreferences ? "confirmed" : "pending",
          user_id: collab.user_id || collab.user?.id,
          is_owner: collab.role === "owner",
        };
      });

      setFriends(collaboratorList);
      if (showLoading) setLoading(false);
    } catch (error) {
      console.error("Failed to fetch collaborators:", error);
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
  }, [tripId]);

  // ✅ POLL 1: Update collaborator statuses
  useEffect(() => {
    if (!tripId || loading) return;

    const statusPoll = setInterval(async () => {
      await fetchCollaborators(false);
    }, 3000);

    return () => clearInterval(statusPoll);
  }, [tripId, loading]);

  // ✅ POLL 2: Check for trip generation status
  useEffect(() => {
    if (!tripId || isOwner || loading) return;

    const generationPoll = setInterval(async () => {
      try {
        const tripData = await apiFetch(`/f1/trips/${tripId}/`, {
          method: "GET",
        });

        if (tripData.travel_type === "group_generating") {
          clearInterval(generationPoll);
          navigate(`/group-ai-wait/${tripId}`);
        } else if (tripData.travel_type === "group_ai") {
          clearInterval(generationPoll);
          navigate(`/group-trip/${tripId}/summary`);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    return () => clearInterval(generationPoll);
  }, [tripId, isOwner, loading]);

  const removeFriend = async (email: string) => {
    if (!window.confirm(`Remove ${email} from this trip?`)) {
      return;
    }

    try {
      setFriends((prev) => prev.filter((f) => f.email !== email));
    } catch (error) {
      console.error("Failed to remove friend:", error);
      alert("Failed to remove friend. Please try again.");
    }
  };

  const handleStartSearch = () => {
    if (!tripId) {
      alert("No trip ID found. Cannot proceed.");
      return;
    }

    if (!isOwner) {
      alert("Only the trip owner can start the search.");
      return;
    }

    const allConfirmed = friends.every((f) => f.status === "confirmed");
    if (!allConfirmed) {
      const proceed = window.confirm(
        "Not all friends have submitted their preferences. Do you want to proceed without them?"
      );
      if (!proceed) return;
    }

    navigate(`/group-ai-wait/${tripId}`);
  };

  // ✅ Add CSS animations
  React.useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        25% { background-position: 25% 50%; }
        50% { background-position: 50% 50%; }
        75% { background-position: 75% 50%; }
        100% { background-position: 0% 50%; }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        background: "linear-gradient(135deg, #e0f2fe 0%, #ddd6fe 20%, #fce7f3 40%, #fed7aa 60%, #fef3c7 80%, #e0f2fe 100%)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 15s ease infinite",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1
        style={{
          fontSize: "48px",
          fontWeight: 700,
          marginBottom: "10px",
          color: "#1e1e2f",
        }}
      >
        Waiting for your{" "}
        <span style={{ color: "#7C5CFF" }}>friends.</span>
      </h1>

      <p
        style={{
          fontSize: "16px",
          color: "#6B7280",
          marginBottom: "40px",
        }}
      >
        {loading ? "Loading..." : isOwner ? "You can start when ready!" : "Waiting for trip owner to start..."}
      </p>

      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "60px",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "800px",
        }}
      >
        {loading ? (
          <div style={{ color: "#6B7280", fontSize: "14px" }}>Loading collaborators...</div>
        ) : friends.length === 0 ? (
          <div style={{ color: "#6B7280", fontSize: "14px" }}>No collaborators found.</div>
        ) : (
          friends.map((f, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 20px",
                background: f.status === "confirmed" 
                  ? "#FFFFFF" 
                  : "rgba(167, 139, 250, 0.15)",
                backdropFilter: "blur(10px)",
                borderRadius: "50px",
                boxShadow:
                  f.status === "confirmed"
                    ? "0px 2px 8px rgba(0, 0, 0, 0.08)"
                    : "0px 2px 6px rgba(139, 92, 246, 0.1)",
                border:
                  f.status === "confirmed"
                    ? "1px solid #E5E7EB"
                    : "1px solid rgba(167, 139, 250, 0.3)",
                transition: "all 0.3s ease",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  marginRight: "12px",
                  color: "#3B3B3B",
                  fontWeight: 500,
                }}
              >
                {f.email}
                {f.is_owner && " (Owner)"}
              </span>

              {f.status === "confirmed" && (
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#7C5CFF",
                    display: "inline-block",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "5px",
                      top: "3px",
                      fontSize: "10px",
                      color: "white",
                    }}
                  >
                    ✓
                  </span>
                </span>
              )}

              {f.status === "pending" && isOwner && (
                <button
                  onClick={() => removeFriend(f.email)}
                  style={{
                    marginLeft: "8px",
                    background: "transparent",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    color: "#8B5CF6",
                    fontWeight: 700,
                  }}
                  title="Remove friend"
                >
                  ×
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {isOwner && (
        <button
          style={{
            padding: "18px 60px",
            background: loading ? "#9CA3AF" : "#A78BFA",
            color: "white",
            border: "none",
            borderRadius: "40px",
            fontSize: "18px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0px 4px 12px rgba(139, 92, 246, 0.25)",
            transition: "all 0.3s ease",
          }}
          onClick={handleStartSearch}
          disabled={loading}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0px 6px 16px rgba(139, 92, 246, 0.35)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0px 4px 12px rgba(139, 92, 246, 0.25)";
          }}
        >
          <span style={{ fontSize: "18px" }}>✨</span>
          Start the search
        </button>
      )}
    </div>
  );
}