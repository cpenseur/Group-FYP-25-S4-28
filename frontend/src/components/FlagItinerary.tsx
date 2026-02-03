import React, { useEffect, useState } from "react";

export type FlagCategory =
  | ""
  | "spam"
  | "inappropriate"
  | "hate_harassment"
  | "misinformation"
  | "copyright"
  | "scam"
  | "other";

export function FlagItineraryModal({
  isOpen,
  tripTitle,
  onClose,
  onSubmit,
  flagging,
}: {
  isOpen: boolean;
  tripTitle: string;
  onClose: () => void;
  onSubmit: (payload: { flag_category: FlagCategory; flag_reason: string }) => void;
  flagging: boolean;
}) {
  const [category, setCategory] = useState<FlagCategory>("");
  const [reason, setReason] = useState<string>("");
  const [touched, setTouched] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCategory("");
      setReason("");
      setTouched(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const reasonTrimmed = reason.trim();
  const isValid = category !== "" && reasonTrimmed.length >= 5;

  const showCategoryError = touched && category === "";
  const showReasonError = touched && reasonTrimmed.length < 5;

  const handleSubmit = () => {
    setTouched(true);
    if (!isValid) return;
    onSubmit({ flag_category: category, flag_reason: reasonTrimmed });
  };

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
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "520px",
          maxWidth: "100%",
          background: "white",
          borderRadius: "18px",
          padding: "1.4rem 1.4rem 1.2rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          position: "relative",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#111827" }}>Flag Itinerary</div>
            <div style={{ marginTop: "0.25rem", fontSize: "0.9rem", color: "#6b7280" }}>
              <span style={{ color: "#111827", fontWeight: 600 }}>{tripTitle}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={flagging}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.5rem",
              cursor: flagging ? "not-allowed" : "pointer",
              color: "#6b7280",
              lineHeight: 1,
              padding: "0.25rem",
              opacity: flagging ? 0.6 : 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: "1.2rem" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#111827" }}>Category</label>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FlagCategory)}
            disabled={flagging}
            style={{
              marginTop: "0.45rem",
              width: "100%",
              padding: "0.75rem 0.9rem",
              borderRadius: "12px",
              border: showCategoryError ? "1px solid #ef4444" : "1px solid #d1d5db",
              background: flagging ? "#f9fafb" : "#fff",
              color: "#111827",
              fontSize: "0.9rem",
              outline: "none",
              boxSizing: "border-box",
              display: "block",
            }}
          >
            <option value="">Select a category</option>
            <option value="spam">Spam / Advertising</option>
            <option value="inappropriate">Inappropriate content</option>
            <option value="hate_harassment">Hate / Harassment</option>
            <option value="misinformation">Misinformation</option>
            <option value="copyright">Copyright / Intellectual Property</option>
            <option value="scam">Scam / Fraud</option>
            <option value="other">Other</option>
          </select>

          {showCategoryError && (
            <div style={{ marginTop: "0.45rem", fontSize: "0.8rem", color: "#ef4444" }}>Please choose a category.</div>
          )}
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#111827" }}>Reason</label>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={flagging}
            placeholder="Tell us what's wrong with this itinerary…"
            rows={5}
            style={{
              marginTop: "0.45rem",
              width: "100%",
              maxWidth: "100%",
              display: "block",
              boxSizing: "border-box",
              padding: "0.75rem 0.9rem",
              borderRadius: "12px",
              border: showReasonError ? "1px solid #ef4444" : "1px solid #d1d5db",
              background: flagging ? "#f9fafb" : "#fff",
              color: "#111827",
              fontSize: "0.9rem",
              outline: "none",
              resize: "vertical",
              minHeight: "120px",
            }}
          />

          <div style={{ marginTop: "0.45rem", display: "flex", justifyContent: "space-between" }}>
            {showReasonError ? (
              <div style={{ fontSize: "0.8rem", color: "#ef4444" }}>Please provide a short reason (at least 5 characters).</div>
            ) : (
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Include details that help moderators review quickly.</div>
            )}

            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{reasonTrimmed.length}/500</div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={flagging}
          style={{
            marginTop: "1.15rem",
            width: "100%",
            padding: "0.85rem 1rem",
            borderRadius: "14px",
            border: "none",
            background: flagging ? "#e5e7eb" : "#111827",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 800,
            cursor: flagging ? "not-allowed" : "pointer",
            opacity: flagging ? 0.7 : 1,
            boxShadow: flagging ? "none" : "0 10px 24px rgba(17,24,39,0.18)",
          }}
        >
          {flagging ? "Submitting..." : "Submit report"}
        </button>
      </div>
    </div>
  );
}
