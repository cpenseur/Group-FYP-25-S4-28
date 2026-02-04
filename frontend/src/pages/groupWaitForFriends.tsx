// frontend/src/pages/groupWaitForFriends.tsx

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTripId } from "../hooks/useDecodedParams";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import { encodeId } from "../lib/urlObfuscation";

type Collaborator = {
  email: string;
  status: "confirmed" | "pending";
  user_id?: string;
  is_owner?: boolean;
};

export default function GroupWaitForFriends() {
  const tripId = useTripId();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const hasInitialized = useRef(false);

  // Fetch collaborators and their status
  const fetchCollaboratorStatus = async () => {
    if (!tripId) return;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }

      // Fetch trip details with collaborators
      const tripData = await apiFetch(`/f1/trips/${tripId}/`);

      // Check if trip has been generated
      console.log("Trip travel_type:", tripData.travel_type);
      
      if (tripData.travel_type === "group_ai") {
        console.log("Trip already generated! Navigating to summary...");
        navigate(`/v/${encodeId(tripId)}/gs`);
        return;
      }
      
      if (tripData.travel_type === "group_generating") {
        console.log("🔄 Trip is generating! Navigating to wait page...");
        navigate(`/v/${encodeId(tripId)}/gaw`);
        return;
      }

      let preferencesData: any[] = [];
      try {
        preferencesData = await apiFetch(`/f1/trips/${tripId}/group-preferences/`);
        console.log("📋 Preferences data:", preferencesData);
      } catch (prefError) {
        console.error("❌ Failed to fetch preferences:", prefError);
      }

      // Check if current user is the owner
      const currentUserIsOwner = tripData.collaborators?.some(
        (collab: any) => 
          collab.user_id === user.id && 
          collab.role === "owner"
      );
      setIsOwner(currentUserIsOwner || false);

      // Map collaborators to include preference status
      const collaboratorList: Collaborator[] = (tripData.collaborators || []).map((collab: any) => {
        const collaboratorUserId = collab.user_id || collab.user?.id;
        
        // Check if this collaborator has saved preferences
        const hasPreferences = preferencesData.some(
          (pref: any) => pref.user_id === collaboratorUserId
        );

        console.log(`👤 ${collab.invited_email || collab.email}: hasPreferences = ${hasPreferences}`);

        return {
          email: collab.invited_email || collab.user?.email || collab.email || "Unknown",
          status: hasPreferences ? "confirmed" : "pending",
          user_id: collaboratorUserId,
          is_owner: collab.role === "owner",
        };
      });

      console.log("✅ Updated collaborator list:", collaboratorList);
      setFriends(collaboratorList);
      setLoading(false);
      hasInitialized.current = true;

    } catch (error) {
      console.error("❌ Failed to fetch collaborators:", error);
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCollaboratorStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  useEffect(() => {
    if (!tripId || loading) return;

    console.log("🔄 Starting status polling (every 10 seconds)...");

    const pollInterval = setInterval(() => {
      console.log("🔄 Polling for updates...");
      fetchCollaboratorStatus();
    }, 10000);  // ✅ Changed from 3000 to 10000 (10 seconds)

    return () => {
      console.log("🛑 Stopping status polling");
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, loading]);

  // Remove a pending friend from the list
  const removeFriend = async (email: string) => {
    if (!window.confirm(`Remove ${email} from this trip?`)) {
      return;
    }

    try {
      // TODO: Call API to remove collaborator
      setFriends((prev) => prev.filter((f) => f.email !== email));
    } catch (error) {
      console.error("Failed to remove friend:", error);
      alert("Failed to remove friend. Please try again.");
    }
  };

  // Handle "Start the search" button click
  const handleStartSearch = async () => {
    if (!tripId) {
      alert("No trip ID found. Cannot proceed.");
      return;
    }

    if (!isOwner) {
      alert("Only the trip owner can start the search.");
      return;
    }

    // Check if all friends have confirmed
    const allConfirmed = friends.every((f) => f.status === "confirmed");
    if (!allConfirmed) {
      const proceed = window.confirm(
        "Not all friends have submitted their preferences. Do you want to proceed without them?"
      );
      if (!proceed) return;
    }

    setIsStarting(true);

    try {
      console.log("🚀 Starting AI trip generation for group trip:", tripId);

      // Call F2.2 endpoint to generate trip based on everyone's preferences
      const aiResponse = await apiFetch(`/f2/trips/${tripId}/generate-group-itinerary/`, {
        method: "POST",
      });

      console.log("✅ AI generation started:", aiResponse);

      // Navigate to AI generation wait page (obfuscated route)
      navigate(`/v/${encodeId(tripId)}/gaw`);
      
    } catch (error: any) {
      console.error("❌ Failed to start search:", error);
      alert(`Failed to generate trip: ${error.message || "Please try again."}`);
      setIsStarting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        background: "linear-gradient(180deg, #eff3ff 0%, #ede8ff 45%, #d5e7ff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Main Title */}
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

      {/* Subtitle */}
      <p
        style={{
          fontSize: "16px",
          color: "#6B7280",
          marginBottom: "40px",
        }}
      >
        {loading ? "Loading..." : isOwner ? "You can start when ready!" : "Waiting for trip owner to start..."}
      </p>

      {/* Friend tags row */}
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
              {/* Friend email */}
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

              {/* Confirmed: Purple check circle */}
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

              {/* Pending: X button to remove (only owner can remove) */}
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

      {/* Start the search button - ONLY VISIBLE FOR OWNER */}
      {isOwner && (
        <button
          style={{
            padding: "18px 60px",
            background: isStarting 
              ? "#9CA3AF" 
              : "#A78BFA",
            color: "white",
            border: "none",
            borderRadius: "40px",
            fontSize: "18px",
            fontWeight: 700,
            cursor: isStarting || loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            opacity: isStarting || loading ? 0.7 : 1,
            boxShadow: "0px 4px 12px rgba(139, 92, 246, 0.25)",
            transition: "all 0.3s ease",
          }}
          onClick={handleStartSearch}
          disabled={isStarting || loading}
          onMouseEnter={(e) => {
            if (!isStarting && !loading) {
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
          {isStarting ? "Starting generation..." : "Start the search"}
        </button>
      )}
    </div>
  );
}