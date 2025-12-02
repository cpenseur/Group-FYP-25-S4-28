// frontend/src/pages/LoginPage.tsx
import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus(mode === "login" ? "Signing in..." : "Creating account...");

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error(error);
          setStatus(`Login error: ${error.message}`);
          return;
        }

        setStatus("Login successful. Redirecting to dashboard…");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          console.error(error);
          setStatus(`Sign-up error: ${error.message}`);
          return;
        }

        setStatus(
          "Sign-up successful! Check your email for verification (if enabled), then log in."
        );
        // After successful sign-up, flip back to login mode
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "2rem",
          background: "#020617",
          borderRadius: "0.75rem",
          boxShadow: "0 0 0 1px #1f2937",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          {mode === "login" ? "Log in to TripMate" : "Create a TripMate account"}
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "1.5rem" }}>
          Using Supabase email + password authentication.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                marginBottom: "0.25rem",
              }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                marginBottom: "0.25rem",
              }}
            >
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.5rem",
              width: "100%",
              padding: "0.65rem",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(135deg, #4ade80, #22c55e)",
              color: "#020617",
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {mode === "login" ? "Log In" : "Sign Up"}
          </button>
        </form>

        {/* Toggle between Login / Sign Up */}
        <div
          style={{
            marginTop: "1rem",
            fontSize: "0.85rem",
            color: "#9ca3af",
          }}
        >
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                style={{
                  border: "none",
                  background: "none",
                  color: "#60a5fa",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Sign up
              </button>
              .
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                style={{
                  border: "none",
                  background: "none",
                  color: "#60a5fa",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Log in
              </button>
              .
            </>
          )}
        </div>

        {/* Status / errors */}
        <div
          style={{
            minHeight: "2rem",
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            color: "#93c5fd",
          }}
        >
          {status}
        </div>
      </div>
    </div>
  );
}
