// frontend/src/pages/createTrip.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";

type NewTripPayload = {
  title: string;
  main_city: string;
  main_country: string;
  start_date: string | null; // "YYYY-MM-DD"
  end_date: string | null;
};

export default function CreateTrip() {
  const navigate = useNavigate();

  const [destinationCountry, setDestinationCountry] = useState("Singapore");
  const [mainCity, setMainCity] = useState("Singapore");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!destinationCountry.trim()) {
      setErrorMsg("Please enter a destination country.");
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg("Please choose trip start and end dates.");
      return;
    }

    const payload: NewTripPayload = {
      title: `Trip to ${destinationCountry}`,
      main_city: mainCity || destinationCountry,
      main_country: destinationCountry,
      start_date: startDate,
      end_date: endDate,
    };

    try {
      setIsSubmitting(true);
      const data = await apiFetch("/f1/trips/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const tripId = data.id;
      if (!tripId) {
        throw new Error("Trip ID missing in response");
      }

      // Redirect to itinerary editor for this trip
      navigate(`/trip/${tripId}/itinerary`);
    } catch (err: any) {
      console.error("Error creating trip:", err);
      setErrorMsg(err.message || "Failed to create trip. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #ffe4d9 0%, #f4e1ff 40%, #e0f2ff 100%)",
        paddingTop: "80px",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "2.5rem 2rem 4rem",
        }}
      >
        <p style={{ color: "#4b5563", marginBottom: "0.5rem" }}>
          Share your preferences
        </p>
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            marginBottom: "2rem",
            color: "#111827",
          }}
        >
          Create a New Trip
        </h1>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {/* Destination country + main city */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "1.5rem 1.75rem",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#6b7280",
                marginBottom: "0.5rem",
              }}
            >
              Destination country
            </label>
            <input
              type="text"
              placeholder="e.g. Japan"
              value={destinationCountry}
              onChange={(e) => setDestinationCountry(e.target.value)}
              style={{
                width: "100%",
                borderRadius: "999px",
                border: "1px solid #cbd5f5",
                padding: "0.75rem 1.25rem",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />

            <div style={{ height: "0.75rem" }} />

            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#6b7280",
                marginBottom: "0.5rem",
              }}
            >
              Main city (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Tokyo"
              value={mainCity}
              onChange={(e) => setMainCity(e.target.value)}
              style={{
                width: "100%",
                borderRadius: "999px",
                border: "1px solid #cbd5f5",
                padding: "0.75rem 1.25rem",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>

          {/* Dates row */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "1.5rem 1.75rem",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.5rem",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#6b7280",
                  marginBottom: "0.5rem",
                }}
              >
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: "999px",
                  border: "1px solid #cbd5f5",
                  padding: "0.6rem 1.1rem",
                  fontSize: "0.95rem",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#6b7280",
                  marginBottom: "0.5rem",
                }}
              >
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: "999px",
                  border: "1px solid #cbd5f5",
                  padding: "0.6rem 1.1rem",
                  fontSize: "0.95rem",
                }}
              />
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "12px",
                padding: "0.75rem 1rem",
                fontSize: "0.9rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Submit button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                border: "none",
                borderRadius: "999px",
                padding: "0.9rem 1.8rem",
                fontWeight: 600,
                fontSize: "0.95rem",
                color: "white",
                background:
                  "linear-gradient(135deg, #f97316 0%, #fb923c 50%, #f97316 100%)",
                boxShadow: "0 12px 30px rgba(249,115,22,0.35)",
                cursor: isSubmitting ? "default" : "pointer",
              }}
            >
              {isSubmitting ? "Creating..." : "Create New Trip →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
