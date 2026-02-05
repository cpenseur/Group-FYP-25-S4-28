import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");      // ✅ now empty by default
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false); // ✅ NEW
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
          setStatus(`Login error: ${error.message}`);
          return;
        }

        setStatus("Login successful. Redirecting to dashboard…");
        navigate("/dashboard");
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, name: fullName } },
        });

        if (error) {
          setStatus(`Sign-up error: ${error.message}`);
          return;
        }

        const authUserId = signUpData.user?.id;
        if (authUserId) {
          const { error: appUserErr } = await supabase.from("app_user").upsert(
            {
              id: authUserId,
              auth_user_id: authUserId,
              email,
              full_name: fullName,
            },
            { onConflict: "id" }
          );

          const { error: profileErr } = await supabase.from("profiles").upsert(
            {
              id: authUserId,
              name: fullName,
            },
            { onConflict: "id" }
          );

          if (appUserErr || profileErr) {
            setStatus("Account created. Profile setup may be delayed.");
          } else {
            setStatus("Sign-up successful! Check your email for verification.");
          }
        } else {
          setStatus("Sign-up successful! Check your email for verification.");
        }
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signup" ? "Create an account" : "Log in to your account";
  const primaryButtonText = mode === "signup" ? "Create account" : "Log in";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        backgroundColor: "rgba(0, 0, 0, 0.5)", // Darker backdrop like in image
        zIndex: 50,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "2rem 2.25rem",
          background: "#ffffff",
          borderRadius: "1.25rem",
          boxShadow: "0 15px 40px rgba(0,0,0,0.15)",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#111827",
        }}
      >
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          {title}
        </h1>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {mode === "signup" && (
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "0.35rem" }}>
                Full name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e5e7eb",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          {/* ✅ Email */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "0.35rem" }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"   // ✅ no prefilled email anymore
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                borderRadius: "0.5rem",
                border: "1px solid #e5e7eb",
                fontSize: "0.9rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* ✅ Password with visibility toggle */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.35rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Password</span>
              <button
                type="button"
                style={{
                  border: "none",
                  background: "none",
                  fontSize: "0.8rem",
                  color: "#3b82f6",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Forgot ?
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"} // ✅ toggle here
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: "100%",
                  padding: "0.65rem 2.4rem 0.65rem 0.85rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e5e7eb",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />

              {/* ✅ Clickable eye toggle */}
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: "absolute",
                  right: "0.6rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  opacity: 0.7,
                }}
                aria-label="Toggle password visibility"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* ✅ Primary button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.75rem",
              width: "100%",
              padding: "0.7rem",
              borderRadius: "999px",
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {primaryButtonText}
          </button>
        </form>

        {/* ✅ Bottom toggle */}
        <div
          style={{
            marginTop: "1.25rem",
            textAlign: "center",
            fontSize: "0.85rem",
            color: "#9ca3af",
          }}
        >
          {mode === "signup" ? (
            <>
              Already Have An Account ?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                style={{
                  border: "none",
                  background: "none",
                  color: "#2563eb",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                Log In
              </button>
            </>
          ) : (
            <>
              Don&apos;t Have An Account ?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                style={{
                  border: "none",
                  background: "none",
                  color: "#2563eb",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        {/* ✅ Status */}
        <div
          style={{
            minHeight: "1.5rem",
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            color: "#1d4ed8",
          }}
        >
          {status}
        </div>
      </div>
    </div>
  );
}