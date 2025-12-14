import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) setStatus(`Invalid or expired link: ${error.message}`);
      }
    };
    run();
  }, []);

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setStatus("Updating password...");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus(`Update failed: ${error.message}`);
      setLoading(false);
      return;
    }

    setStatus("Password updated! You can now log in.");
    setLoading(false);

    // Optional: go back to home/login after a short moment
    // setTimeout(() => (window.location.href = "/"), 800);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(37,99,235,0.12), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(59,130,246,0.10), transparent 55%), #f8fafc",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 18px 50px rgba(0,0,0,0.10)",
          border: "1px solid rgba(229,231,235,0.9)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "28px 28px 18px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(37,99,235,0.08)",
              color: "#1d4ed8",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            🔐 Password Recovery
          </div>

          <h1
            style={{
              margin: "14px 0 6px",
              fontSize: 26,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            Reset your password
          </h1>

          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            Enter a new password for your account.
          </p>
        </div>

        {/* Body */}
        <form onSubmit={updatePassword} style={{ padding: "0 28px 26px" }}>
          <div style={{ marginTop: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              New password
            </label>

            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                style={{
                  width: "100%",
                  padding: "12px 44px 12px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                aria-label="Toggle password visibility"
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 16,
                  opacity: 0.75,
                }}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              Tip: use 8+ characters with a mix of letters, numbers, and symbols.
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "12px 14px",
              borderRadius: 999,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.8 : 1,
              boxShadow: "0 10px 22px rgba(37,99,235,0.25)",
            }}
          >
            {loading ? "Setting..." : "Set new password"}
          </button>

          {status && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 12,
                background: status.toLowerCase().includes("failed") ||
                  status.toLowerCase().includes("invalid")
                  ? "rgba(239,68,68,0.10)"
                  : "rgba(37,99,235,0.08)",
                color: status.toLowerCase().includes("failed") ||
                  status.toLowerCase().includes("invalid")
                  ? "#b91c1c"
                  : "#1d4ed8",
                fontSize: 13,
                lineHeight: 1.35,
              }}
            >
              {status}
            </div>
          )}

          <div style={{ marginTop: 16, textAlign: "center" }}>
            <a
              href="/"
              style={{
                fontSize: 13,
                color: "#2563eb",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Back to login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
