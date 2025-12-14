import React, { useMemo, useState } from "react";

type Props = {
  invites: string[]; // emails only
  setInvites: (next: string[]) => void;
};

// simple, sufficient email validation for UI
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type InvitePayload = { email: string };

export function toInvitePayload(email: string): InvitePayload {
  return { email: email.trim().toLowerCase() };
}

export default function InviteTripmates({ invites, setInvites }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalized = useMemo(() => {
    return invites.map((x) => x.trim().toLowerCase()).filter(Boolean);
  }, [invites]);

  const add = (value: string) => {
    const v = value.trim().toLowerCase();
    if (!v) return;

    if (!isValidEmail(v)) {
      setError("Please enter a valid email address.");
      return;
    }

    const exists = normalized.includes(v);
    if (exists) {
      setError("This email has already been added.");
      return;
    }

    setError(null);
    setInvites([...normalized, v]);
    setDraft("");
  };

  const remove = (value: string) => {
    setInvites(normalized.filter((x) => x !== value));
  };

  return (
    <div
      style={{
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
        Invite Tripmates (optional)
      </label>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type email and press Enter"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          style={{
            flex: "1 1 320px",
            minWidth: 260,
            borderRadius: 12,
            border: "1px solid #d1d5db",
            padding: "0.7rem 0.95rem",
            fontSize: "0.95rem",
            outline: "none",
          }}
        />

        <button
          type="button"
          onClick={() => add(draft)}
          style={{
            borderRadius: 12,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            padding: "0.68rem 1rem",
            fontWeight: 650,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Add
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 8, color: "#b91c1c", fontSize: "0.9rem" }}>
          {error}
        </div>
      ) : (
        <div style={{ marginTop: 8, color: "#6b7280", fontSize: "0.9rem" }}>
          We’ll invite them after the trip is created.
        </div>
      )}

      {normalized.length > 0 && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {normalized.map((email) => (
            <span
              key={email}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "0.35rem 0.6rem",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "white",
                boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                maxWidth: "100%",
              }}
              title={email}
            >
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 280,
                }}
              >
                {email}
              </span>

              <button
                type="button"
                onClick={() => remove(email)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#6b7280",
                  fontSize: 16,
                  lineHeight: "16px",
                }}
                aria-label={`Remove ${email}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
