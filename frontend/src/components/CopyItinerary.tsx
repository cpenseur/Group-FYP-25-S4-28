import React, { useMemo } from "react";

type TripDayItem = {
  title: string;
};

type TripDay = {
  items: TripDayItem[];
};

export type TripDetailForCopy = {
  title: string;
  main_city: string | null;
  main_country: string | null;
  owner_name?: string;
  days?: TripDay[];
};

export function CopyItineraryModal({
  isOpen,
  trip,
  onClose,
  onConfirm,
  copying,
}: {
  isOpen: boolean;
  trip: TripDetailForCopy | null;
  onClose: () => void;
  onConfirm: () => void;
  copying: boolean;
}) {
  const destinations = useMemo(() => {
    if (!trip) return [];
    const list: string[] = [];
    (trip.days || []).forEach((day) => {
      (day.items || []).forEach((item) => {
        if (item.title && !list.includes(item.title)) list.push(item.title);
      });
    });
    return list;
  }, [trip]);

  if (!isOpen || !trip) return null;

  const totalDays = trip.days?.length || 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "480px",
          background: "white",
          borderRadius: "20px",
          padding: "2rem 2rem 1.5rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "transparent",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
            color: "#6b7280",
            padding: "0.25rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>
          {trip.title}
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            color: "#6b7280",
          }}
        >
          {trip.main_city && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span>📍</span>
              <span>{trip.main_city}</span>
            </div>
          )}
          {totalDays > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span>⏱️</span>
              <span>
                {totalDays} Day{totalDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", color: "#111827" }}>
            Destinations:
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {destinations.slice(0, 8).map((dest, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: "0.875rem",
                  color: "#374151",
                  paddingLeft: "1.25rem",
                  position: "relative",
                }}
              >
                <span style={{ position: "absolute", left: 0, color: "#6b7280" }}>•</span>
                {dest}
              </li>
            ))}
            {destinations.length > 8 && (
              <li style={{ fontSize: "0.875rem", color: "#6b7280", fontStyle: "italic" }}>
                +{destinations.length - 8} more destinations
              </li>
            )}
          </ul>
        </div>

        {trip.owner_name && (
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1.5rem" }}>Created by {trip.owner_name}</div>
        )}

        <button
          onClick={onConfirm}
          disabled={copying}
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            borderRadius: "12px",
            border: "none",
            background: copying ? "#e5e7eb" : "#6366f1",
            color: "white",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: copying ? "not-allowed" : "pointer",
            boxShadow: copying ? "none" : "0 8px 20px rgba(99,102,241,0.35)",
            opacity: copying ? 0.6 : 1,
          }}
        >
          {copying ? "Copying itinerary..." : "Copy itinerary"}
        </button>
      </div>
    </div>
  );
}
