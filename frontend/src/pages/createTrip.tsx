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

type InviteLink = { email: string; inviteUrl: string };

export default function CreateTrip() {
  const navigate = useNavigate();

  const [destinationCountry, setDestinationCountry] = useState("Singapore");
  const [mainCity, setMainCity] = useState("Singapore");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [invites, setInvites] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [pendingTripId, setPendingTripId] = useState<number | null>(null);

  async function inviteCollaborators(tripId: number, inviteList: string[]): Promise<InviteLink[]> {
    if (!inviteList.length) return [];
    const results = await Promise.all(
      inviteList.map(async (raw) => {
      try{  
        const res = await apiFetch(`/f1/trips/${tripId}/collaborators/`, {
          method: "POST",
          body: JSON.stringify(toInvitePayload(raw)),
        });

      if (res?.invite_token) {
        const inviteUrl = `${window.location.origin}/accept-invite?token=${res.invite_token}`;
        return { email: res.email ?? raw, inviteUrl };
      }
      return null;
    } catch (err) {
        console.error("Invite failed:", raw, err);
        return null;      
    }
  })
);  
  return results.filter(Boolean) as InviteLink[];
}

  const closeInviteModalAndMaybeNavigate = () => {
    setInviteModalOpen(false);
    // after closing, go to itinerary if trip was created
    if (pendingTripId) {
      navigate(`/trip/${pendingTripId}/itinerary`);
    }
  };


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

    const inviteList = [...invites];    
    try {
      setIsSubmitting(true);

      const data = await apiFetch("/f1/trips/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const tripId = data?.id;

      if (!tripId) throw new Error("Trip ID missing in response");

      const links = await inviteCollaborators(tripId, inviteList);
      if (inviteList.length) {
        // show popup, delay navigation until user closes it
        setInviteLinks(links);
        setInviteModalOpen(true);
        setPendingTripId(tripId);
        return;
      }

      // Redirect to itinerary editor for this trip
      navigate(`/trip/${tripId}/itinerary`);
    } catch (err: any) {
      console.error("Error creating trip:", err);
      setErrorMsg(err?.message || "Failed to create trip. Please try again.");
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
      {inviteModalOpen && (
        <div
          onClick={closeInviteModalAndMaybeNavigate}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 95vw)",
              background: "white",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: "1.25rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: "1.05rem", fontWeight: 750, color: "#111827" }}>
                  Invitation sent 🎉
                </div>
                <div style={{ marginTop: 6, color: "#6b7280", fontSize: "0.92rem" }}>
                  An invitation email has been sent. You can also copy the invite link below.
                </div>
              </div>

              <button
                type="button"
                onClick={closeInviteModalAndMaybeNavigate}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {inviteLinks.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: "0.92rem" }}>
                  No invite links were returned by the API. (Emails may still be
                  sent.) If you want links here, ensure your backend returns
                  <code>invite_token</code> in the response.
                </div>
              ) : (
                inviteLinks.map((x) => (
                  <div
                    key={x.email}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "0.75rem",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, color: "#111827" }}>{x.email}</div>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "0.88rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={x.inviteUrl}
                    >
                      {x.inviteUrl}
                    </div>

                    {copiedEmail === x.email && (
                      <div style={{ marginTop: 6, fontSize: "0.85rem", color: "#059669" }}>
                        Link copied ✅
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(x.inviteUrl);
                      setCopiedEmail(x.email);
                      window.setTimeout(() => setCopiedEmail(null), 1200);
                    }}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "white",
                      borderRadius: 10,
                      padding: "0.55rem 0.85rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Copy link
                  </button>
                </div>
              ))
            )}
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={async () => {
                  const text = inviteLinks.map((x) => `${x.email}\n${x.inviteUrl}`).join("\n\n");
                  await navigator.clipboard.writeText(text);
                  setCopiedEmail("ALL");
                  window.setTimeout(() => setCopiedEmail(null), 1200);
                }}
                style={{
                  border: "1px solid #d1d5db",
                  background: "white",
                  borderRadius: 999,
                  padding: "0.7rem 1.1rem",
                  fontWeight: 750,
                  cursor: "pointer",
                }}
              >
                Copy all
              </button>

              <button
                type="button"
                onClick={closeInviteModalAndMaybeNavigate}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "0.7rem 1.1rem",
                  fontWeight: 750,
                  color: "white",
                  background: "#111827",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}      
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
