import React, { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripTitle?: string;
};

export default function ShareTripModal({
  isOpen,
  onClose,
  tripId,
  tripTitle,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate the shareable link (adjust the base URL to match your domain)
  const shareableLink = `${window.location.origin}/trip/${tripId}/view`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 16,
          padding: "2rem",
          maxWidth: 500,
          width: "90%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#111827",
              margin: 0,
            }}
          >
            Share Trip
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6b7280",
              fontSize: 24,
              lineHeight: "24px",
              padding: 0,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Trip Title */}
        {tripTitle && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem",
              backgroundColor: "#f9fafb",
              borderRadius: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.95rem",
                color: "#6b7280",
              }}
            >
              Sharing:{" "}
              <span style={{ fontWeight: 600, color: "#111827" }}>
                {tripTitle}
              </span>
            </p>
          </div>
        )}

        {/* Description */}
        <p
          style={{
            fontSize: "0.95rem",
            color: "#6b7280",
            marginBottom: "1rem",
            lineHeight: 1.5,
          }}
        >
          Anyone with this link can view the itinerary. They won't be able to
          make changes.
        </p>

        {/* Link Display and Copy Button */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: "1.5rem",
          }}
        >
          <input
            type="text"
            value={shareableLink}
            readOnly
            style={{
              flex: 1,
              borderRadius: 8,
              border: "1px solid #d1d5db",
              padding: "0.75rem",
              fontSize: "0.9rem",
              backgroundColor: "#f9fafb",
              color: "#111827",
              outline: "none",
            }}
          />
          <button
            onClick={copyToClipboard}
            style={{
              borderRadius: 8,
              border: "1px solid #111827",
              background: copied ? "#10b981" : "#111827",
              color: "white",
              padding: "0.75rem 1.25rem",
              fontWeight: 650,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background-color 0.2s",
              fontSize: "0.95rem",
            }}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        {/* Additional sharing options */}
        <div style={{ marginBottom: "1rem" }}>
          <p
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#6b7280",
              marginBottom: "0.75rem",
            }}
          >
            Share via
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => {
                const subject = encodeURIComponent(
                  `Check out this trip: ${tripTitle || "Trip Itinerary"}`
                );
                const body = encodeURIComponent(
                  `I wanted to share this trip itinerary with you:\n\n${shareableLink}`
                );
                window.open(`mailto:?subject=${subject}&body=${body}`);
              }}
              style={{
                flex: "1 1 auto",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#111827",
                padding: "0.65rem 1rem",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              📧 Email
            </button>
            <button
              onClick={() => {
                const text = encodeURIComponent(
                  `Check out this trip: ${shareableLink}`
                );
                window.open(
                  `https://wa.me/?text=${text}`,
                  "_blank"
                );
              }}
              style={{
                flex: "1 1 auto",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#111827",
                padding: "0.65rem 1rem",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              💬 WhatsApp
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "white",
            color: "#111827",
            padding: "0.75rem",
            fontWeight: 650,
            cursor: "pointer",
            fontSize: "0.95rem",
            marginTop: "0.5rem",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
