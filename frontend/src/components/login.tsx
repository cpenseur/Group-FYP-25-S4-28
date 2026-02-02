// src/components/login.tsx
import React, { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import styled from "styled-components";

type Mode = "login" | "signup";

type LoginProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: Mode;
};

/* ========= styled components ========= */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 2000;
  backdrop-filter: blur(4px);
`;

const Modal = styled.div`
  width: 100%;
  max-width: 380px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 2rem 2.25rem;
  background: #ffffff;
  border-radius: 1.25rem;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  color: #111827;
  position: relative;
`;

/* ===================================== */

export default function Login({
  isOpen,
  onClose,
  defaultMode = "signup",
}: LoginProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleForgotPassword = async () => {
    if (!email) {
      setStatus("Enter your email first.");
      return;
    }
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setStatus(`Reset error: ${error.message}`);
      return;
    }
    setStatus("Check your email for the reset link.");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus(mode === "login" ? "Signing in..." : "Creating account...");

    try {
      if (mode === "login") {
        // 1) Auth Sign In
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInErr) {
          setStatus(`Login error: ${signInErr.message}`);
          return;
        }

        // 2) Get Session User
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          setStatus("Login successful, but session not found.");
          navigate("/dashboard", { replace: true });
          onClose();
          return;
        }

        // 3) Fetch Profile (robust: match either id or auth_user_id)
        const { data: userData, error: profileError } = await supabase
          .from("app_user")
          .select("role, status")
          .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
          .maybeSingle();

        // --- DEBUG LOGS (check F12) ---
        console.log("Supabase Auth ID:", user.id);
        console.log("Database Response:", userData);
        console.log("Database Error (if any):", profileError);

        // 4) If profile not found / blocked by RLS, fallback to dashboard
        if (profileError || !userData) {
          setStatus("Profile not found. Defaulting to Dashboard...");
          navigate("/dashboard", { replace: true });
          onClose();
          return;
        }

        // 5) Suspended check
        const normalizedStatus = userData.status?.toString().trim().toLowerCase();
        if (normalizedStatus === "suspended") {
          await supabase.auth.signOut();
          setStatus("Your account is suspended.");
          return;
        }

        // Optional: allow "verified" to pass (since your DB has verified/admin)
        const isAllowedStatus =
          normalizedStatus === "active" || normalizedStatus === "verified" || !normalizedStatus;

        if (!isAllowedStatus) {
          await supabase.auth.signOut();
          setStatus("Your account is not active yet.");
          return;
        }

        // 6) Role-based redirect
        const normalizedRole = userData.role?.toString().trim().toLowerCase();

        // Check if there's a pending invitation - if so, don't redirect
        // The invitation page will handle the accept flow
        const pendingInvitation = sessionStorage.getItem('pendingInvitation');
        if (pendingInvitation) {
          console.log("Pending invitation found, staying on current page for auto-accept");
          onClose();
          return;
        }

        if (normalizedRole === "admin") {
          console.log("Redirecting to ADMIN Dashboard");
          navigate("/admin-dashboard", { replace: true });
        } else {
          console.log("Redirecting to USER Dashboard");
          navigate("/dashboard", {
            replace: true,
            state: { showOnboarding: true },
          });
        }

        onClose();
      } else {
        // Sign Up Logic
        const { error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) {
          setStatus(`Sign-up error: ${signUpErr.message}`);
          return;
        }
        setStatus("Check your email for verification.");
        setMode("login");
      }
    } catch (err) {
      console.error(err);
      setStatus("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signup" ? "Create an account" : "Log in to your account";
  const primaryButtonText = mode === "signup" ? "Create account" : "Log in";

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "0.9rem",
            right: "1rem",
            border: "none",
            background: "none",
            fontSize: "1.25rem",
            cursor: "pointer",
            opacity: 0.6,
          }}
        >
          ×
        </button>

        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          {title}
        </h1>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "0.35rem" }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.35rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Password</span>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  border: "none",
                  background: "none",
                  fontSize: "0.8rem",
                  color: "#3b82f6",
                  cursor: "pointer",
                }}
              >
                Forgot?
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
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
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.6rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

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
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {primaryButtonText}
          </button>
        </form>

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
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                style={{
                  border: "none",
                  background: "none",
                  color: "#2563eb",
                  cursor: "pointer",
                }}
              >
                Log In
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                style={{
                  border: "none",
                  background: "none",
                  color: "#2563eb",
                  cursor: "pointer",
                }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        <div style={{ minHeight: "1.5rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "#1d4ed8" }}>
          {status}
        </div>
      </Modal>
    </Overlay>
  );
}
