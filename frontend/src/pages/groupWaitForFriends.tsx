// frontend/src/pages/groupWaitForFriends.tsx

import React, { useState } from "react";

export default function GroupWaitForFriends() {
  // Simulated list of participants
  const [friends, setFriends] = useState([
    { email: "max04trompete@web.de", status: "confirmed" },
    { email: "johannes@gmail.com", status: "pending" },
    { email: "antoniaherrlich@icloud.com", status: "pending" },
  ]);

  // Remove a pending friend
  const removeFriend = (email: string) => {
    setFriends((prev) => prev.filter((f) => f.email !== email));
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
      {/* Title */}
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

            {/* Pending: X button */}
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
        onClick={() => {
          window.location.href = "/group-itinerary-summary";
        }}
      >
        <span style={{ fontSize: "18px" }}> </span>
        Start the search
      </button>
    </div>
  );
}
