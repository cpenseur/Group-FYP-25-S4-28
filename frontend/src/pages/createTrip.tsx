import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import CountryCityPicker from "../components/CountryCityPicker";
import InviteTripmates, { toInvitePayload } from "../components/InviteTripmates";

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

  const [invites, setInvites] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function inviteCollaborators(tripId: number) {
    if (!invites.length) return;

    // NOTE: this endpoint must exist on your backend.
    // If your URL differs, change it here only (component stays the same).
    await Promise.all(
      invites.map((raw) =>
        apiFetch(`/f1/trips/${tripId}/collaborators/`, {
          method: "POST",
          body: JSON.stringify(toInvitePayload(raw)),
        })
      )
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!destinationCountry.trim()) {
      setErrorMsg("Please select a destination country.");
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg("Please choose trip start and end dates.");
      return;
    }

    const payload: NewTripPayload = {
      title: `Trip to ${destinationCountry}`,
      main_city: (mainCity || destinationCountry).trim(),
      main_country: destinationCountry.trim(),
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
      if (!tripId) throw new Error("Trip ID missing in response");

      // invite after trip exists (so backend has trip FK)
      await inviteCollaborators(tripId);

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
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "2.5rem 1.25rem 4rem",
        }}
      >
        <p style={{ color: "#4b5563", marginBottom: "0.5rem" }}>
          Share your preferences
        </p>

        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 750,
            marginBottom: "1.25rem",
            color: "#111827",
            letterSpacing: "-0.02em",
          }}
        >
          Create a New Trip
        </h1>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {/* Card: Country + City */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "18px",
              padding: "1.25rem 1.25rem",
              boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)",
              overflow: "visible",
            }}
          >
            <div style={{ padding: "0.25rem 0.25rem" }}>
              <CountryCityPicker
              country={destinationCountry}
              city={mainCity}
              onCountryChange={(c) => setDestinationCountry(c)}
              onCityChange={(c) => setMainCity(c)}
            />
            </div>
          </div>
            

          {/* Card: Dates + Invite */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "18px",
              padding: "1.25rem 1.25rem",
              boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)",
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "1rem",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                minWidth: 0,
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
                  Start date <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ minWidth: 0 }}>
                  <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: "94%",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    padding: "0.7rem 0.95rem",
                    fontSize: "0.95rem",
                  }}
                  />
                </div>
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
                  End date <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ minWidth: 0 }}>
                  <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: "93.5%",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    padding: "0.7rem 0.95rem",
                    fontSize: "0.95rem",
                  }}
                  />
                </div>
              </div>
            </div>

            <InviteTripmates invites={invites} setInvites={setInvites} />
          </div>

          {/* Error */}
          {errorMsg && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "14px",
                padding: "0.85rem 1rem",
                fontSize: "0.95rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                border: "none",
                borderRadius: "999px",
                padding: "0.95rem 1.9rem",
                fontWeight: 750,
                fontSize: "0.98rem",
                color: "white",
                background:
                  "linear-gradient(135deg, #f97316 0%, #fb923c 50%, #f97316 100%)",
                boxShadow: "0 14px 34px rgba(249,115,22,0.30)",
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
