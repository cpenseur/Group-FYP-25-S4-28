import React, { useState } from "react";
import { Link2, Mail, MessageCircle, Copy, Check, X, Share2 } from "lucide-react";
import { encodeId } from "../lib/urlObfuscation";

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

  // Generate the shareable link with obfuscated trip ID
  const encodedTripId = encodeId(tripId);
  const shareableLink = `${window.location.origin}/v/${encodedTripId}/vw`;

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
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .share-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          .share-option:hover {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
            border-color: #6366f1 !important;
            transform: translateY(-1px);
          }
          .close-btn:hover {
            background: #f1f5f9 !important;
            color: #111827 !important;
          }
        `}
      </style>
      <div
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)",
          borderRadius: 20,
          padding: "1.75rem",
          maxWidth: 440,
          width: "92%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          animation: "slideUp 0.3s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.35)",
              }}
            >
              <Share2 size={20} color="white" strokeWidth={2.5} />
            </div>
            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "#111827",
                margin: 0,
              }}
            >
              Share Trip
            </h2>
          </div>
          <button
            onClick={onClose}
            className="close-btn"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#9ca3af",
              padding: "0.5rem",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Trip Title Card */}
        {tripTitle && (
          <div
            style={{
              marginBottom: "1.25rem",
              padding: "0.85rem 1rem",
              background: "linear-gradient(135deg, #f0f9ff 0%, #ede9fe 100%)",
              borderRadius: 12,
              border: "1px solid #e0e7ff",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.9rem",
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>✈️</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>
                {tripTitle}
              </span>
            </p>
          </div>
        )}

        {/* Description */}
        <p
          style={{
            fontSize: "0.88rem",
            color: "#64748b",
            marginBottom: "1.1rem",
            lineHeight: 1.6,
          }}
        >
          Anyone with this link can <strong style={{ color: "#475569" }}>view</strong> the itinerary. 
          They won't be able to make changes.
        </p>

        {/* Link Display and Copy Button */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: "1.5rem",
            padding: "0.5rem",
            background: "#f8fafc",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0.75rem",
              overflow: "hidden",
            }}
          >
            <Link2 size={16} color="#6366f1" strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: "0.85rem",
                color: "#475569",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {shareableLink}
            </span>
          </div>
          <button
            onClick={copyToClipboard}
            className="share-btn"
            style={{
              borderRadius: 10,
              border: "none",
              background: copied 
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" 
                : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "white",
              padding: "0.65rem 1.1rem",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s ease",
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              boxShadow: copied 
                ? "0 4px 12px rgba(16, 185, 129, 0.35)" 
                : "0 4px 12px rgba(99, 102, 241, 0.35)",
            }}
          >
            {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Divider */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "0.75rem", 
          marginBottom: "1.25rem" 
        }}>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            or share via
          </span>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        </div>

        {/* Share Options */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: "1.25rem",
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
            className="share-option"
            style={{
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              background: "white",
              color: "#374151",
              padding: "0.9rem 1rem",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.2s ease",
            }}
          >
            <Mail size={18} color="#ea580c" strokeWidth={2} />
            Email
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
            className="share-option"
            style={{
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              background: "white",
              color: "#374151",
              padding: "0.9rem 1rem",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.2s ease",
            }}
          >
            <MessageCircle size={18} color="#22c55e" strokeWidth={2} />
            WhatsApp
          </button>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            borderRadius: 12,
            border: "none",
            background: "#f1f5f9",
            color: "#475569",
            padding: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e2e8f0";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f1f5f9";
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
