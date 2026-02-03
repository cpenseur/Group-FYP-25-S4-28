// src/components/TripCard.tsx
import React from "react";
import { pickTripCover } from "../lib/tripCovers";

export type Collaborator = { id: number; initials: string };

export type TripOverview = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  start_date: string | null;
  end_date: string | null;
  travel_type?: string;
  collaborators?: Collaborator[];
  owner_initials?: string;
  planned_total?: string | null;
  currency_symbol?: string;
  location_label?: string;
};

type Props = {
  trip: TripOverview;
  onClick: () => void;
  variant?: "grid" | "mini";
  width?: number; // optional override if you ever need it
};

function AvatarPills({ collabs = [] }: { collabs?: Collaborator[] }) {
  const shown = collabs.slice(0, 4);
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {shown.map((c) => (
        <div
          key={c.id}
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "#111827",
            background: "#e5e7eb",
            border: "1px solid rgba(17,24,39,0.10)",
          }}
          title={c.initials}
        >
          {c.initials}
        </div>
      ))}
    </div>
  );
}

export default function TripCard({
  trip,
  onClick,
  variant = "grid",
  width,
}: Props) {
  // Clean up city label - remove country suffix if present (e.g., "Tokyo, Japan" -> "Tokyo")
  const rawCity = trip.location_label || trip.main_city || "—";
  const countryLabel = trip.main_country || "—";
  
  let cityLabel = rawCity;
  if (rawCity.includes(",") && countryLabel !== "—") {
    const parts = rawCity.split(",").map((p) => p.trim());
    // If the last part matches the country, remove it
    if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === countryLabel.toLowerCase()) {
      cityLabel = parts.slice(0, -1).join(", ");
    }
  }

  const budget =
    trip.planned_total && trip.currency_symbol
      ? `${trip.currency_symbol}${trip.planned_total}`
      : trip.planned_total
      ? `${trip.planned_total}`
      : "$—";

  const cover = pickTripCover(trip.main_country);

  const isMini = variant === "mini";
  const cardWidth = width ?? (isMini ? 240 : "100%");

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        width: cardWidth,
        minWidth: 0,
        overflow: "hidden",
        display: "block",
      }}
    >
      <div
        style={{
          width: "100%",
          borderRadius: 16,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
          border: "1px solid rgba(17,24,39,0.06)",
        }}
      >
        <div style={{ height: 120, background: "#e5e7eb" }}>
          <img
            src={cover}
            alt={trip.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/trip-covers/default.jpg";
            }}
          />
        </div>

        <div style={{ padding: isMini ? 12 : "10px 12px", minWidth: 0 }}>
          <div 
            style={{ 
              fontWeight: 700, 
              color: "#111827", 
              fontSize: 14, 
              lineHeight: 1.3,
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={trip.title}
          >
            {trip.title || "Untitled Trip"}
          </div>
          <div 
            style={{ 
              color: "#6b7280", 
              fontSize: 12, 
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={cityLabel !== "—" && countryLabel !== "—" 
              ? (cityLabel.toLowerCase() === countryLabel.toLowerCase() 
                  ? cityLabel 
                  : `${cityLabel}, ${countryLabel}`)
              : cityLabel !== "—" 
                ? cityLabel 
                : countryLabel !== "—" 
                  ? countryLabel 
                  : "No location set"}
          >
            {cityLabel !== "—" && countryLabel !== "—" 
              ? (cityLabel.toLowerCase() === countryLabel.toLowerCase() 
                  ? cityLabel 
                  : `${cityLabel}, ${countryLabel}`)
              : cityLabel !== "—" 
                ? cityLabel 
                : countryLabel !== "—" 
                  ? countryLabel 
                  : "No location set"}
          </div>

          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid rgba(17,24,39,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Budget: <span style={{ color: "#111827", fontWeight: 700 }}>{budget}</span>
            </div>
            <AvatarPills collabs={trip.collaborators} />
          </div>
        </div>
      </div>
    </button>
  );
}
