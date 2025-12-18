// frontend/src/pages/groupWaitForFriends.tsx

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function GroupWaitForFriends() {
  // Get tripId from URL params
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  // Simulated list of participants
  // In production, this would be fetched from the backend
  const [friends, setFriends] = useState([
    { email: "max04trompete@web.de", status: "confirmed" },
    { email: "johannes@gmail.com", status: "pending" },
    { email: "antoniaherrlich@icloud.com", status: "pending" },
  ]);

  // Remove a pending friend from the list
  const removeFriend = (email: string) => {
    setFriends((prev) => prev.filter((f) => f.email !== email));
  };

  // Handle "Start the search" button click
  const handleStartSearch = () => {
    if (tripId) {
      // Navigate to group itinerary summary with tripId
      navigate(`/group-trip/${tripId}/summary`);
    } else {
      // Show error if tripId is missing
      alert("No trip ID found. Cannot proceed.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #FFFFFF 0%, #F5F2FF 35%, #E7E3FF 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "140px",
      }}
    >
      {/* Main Title */}
      <h1
        style={{
          fontSize: "48px",
          fontWeight: 700,
          marginBottom: "10px",
          color: "#1C1C1C",
        }}
      >
        Waiting for your{" "}
        <span style={{ color: "#7C5CFF" }}>friends.</span>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: "16px",
          color: "#6B6B6B",
          marginBottom: "40px",
        }}
      >
        Nothing left to do for you.
      </p>

      {/* Friend tags row */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "60px",
        }}
      >
        {friends.map((f, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 20px",
              background: f.status === "confirmed" ? "#FFFFFF" : "#EDE7FF",
              borderRadius: "50px",
              boxShadow:
                f.status === "confirmed"
                  ? "0px 2px 6px rgba(0,0,0,0.12)"
                  : "none",
              border:
                f.status === "confirmed"
                  ? "1px solid #E5E5E5"
                  : "1px solid #D6C8FF",
            }}
          >
            {/* Friend email */}
            <span
              style={{
                fontSize: "14px",
                marginRight: "12px",
                color: "#3B3B3B",
              }}
            >
              {f.email}
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

            {/* Pending: X button to remove */}
            {f.status === "pending" && (
              <button
                onClick={() => removeFriend(f.email)}
                style={{
                  marginLeft: "8px",
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  cursor: "pointer",
                  color: "#8D73FF",
                }}
                title="Remove friend"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Start the search button */}
      <button
        style={{
          padding: "18px 60px",
          background: "#A78BFA",
          color: "white",
          border: "none",
          borderRadius: "40px",
          fontSize: "18px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
        onClick={handleStartSearch}
      >
        <span style={{ fontSize: "18px" }}>✨</span>
        Start the search
      </button>
    </div>
  );
}