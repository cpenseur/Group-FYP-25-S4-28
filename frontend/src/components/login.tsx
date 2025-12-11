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
  max-height: 90vh;      /* ⬅️ add this */
  overflow-y: auto;      /* ⬅️ and this */
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
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setStatus(`Sign-up error: ${error.message}`);
          return;
        }

        setStatus("Sign-up successful! Check your email for verification.");
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signup" ? "Create an account" : "Log in to your account";
  const primaryButtonText = mode === "signup" ? "Create account" : "Log in";

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
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
          aria-label="Close"
        >
          ×
        </button>

        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 700,
            marginBottom: "1.5rem",
          }}
        >
          {title}
        </h1>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {/* Email */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.9rem",
                marginBottom: "0.35rem",
              }}
            >
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

          {/* Password */}
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
      </Modal>
    </Overlay>
  );
}
