import { useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [userInfo, setUserInfo] = useState<SupabaseUser | null>(null);

  const handleSignUp = async (e: MouseEvent<HTMLButtonElement> | FormEvent) => {
    e.preventDefault();
    setStatus("Signing up...");
    setUserInfo(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error(error);
      setStatus(`Sign up error: ${error.message}`);
    } else {
      console.log("Sign up data:", data);
      setStatus("Sign up successful! Check your email for verification (if enabled).");
    }
  };

  const handleSignIn = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setStatus("Signing in...");
    setUserInfo(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(error);
      setStatus(`Login error: ${error.message}`);
    } else {
      console.log("Sign in data:", data);
      setStatus("Login successful!");
    }
  };

  const handleGetUser = async () => {
    setStatus("Checking current user...");
    setUserInfo(null);

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error(error);
      setStatus(`Error getting user: ${error.message}`);
    } else if (!data?.user) {
      setStatus("No user logged in.");
    } else {
      setStatus("User loaded.");
      setUserInfo(data.user);
    }
  };

  const handleSignOut = async () => {
    setStatus("Signing out...");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error(error);
      setStatus(`Logout error: ${error.message}`);
    } else {
      setUserInfo(null);
      setStatus("Logged out.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "420px", padding: "2rem", background: "#020617", borderRadius: "0.75rem", boxShadow: "0 0 0 1px #1f2937" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "0.25rem" }}>TripMate Login</h1>
        <p style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "1.5rem" }}>
          Sign up or log in with email & password (Supabase Auth).
        </p>

        <form style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
              Email
            </label>
            <input
              type="email"
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
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
              Password
            </label>
            <input
              type="password"
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
              placeholder="********"
            />
          </div>

          <button
            onClick={handleSignIn}
            style={{
              marginTop: "0.5rem",
              width: "100%",
              padding: "0.65rem",
              borderRadius: "999px",
              border: "none",
              background:
                "linear-gradient(135deg, #4ade80, #22c55e)",
              color: "#020617",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Log In
          </button>

          <button
            onClick={handleSignUp}
            type="button"
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "999px",
              border: "1px solid #4b5563",
              background: "transparent",
              color: "#e5e7eb",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Sign Up
          </button>
        </form>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <button
            onClick={handleGetUser}
            type="button"
            style={{
              flex: 1,
              padding: "0.45rem",
              borderRadius: "999px",
              border: "1px solid #4b5563",
              background: "transparent",
              color: "#e5e7eb",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Check Current User
          </button>
          <button
            onClick={handleSignOut}
            type="button"
            style={{
              flex: 1,
              padding: "0.45rem",
              borderRadius: "999px",
              border: "1px solid #7f1d1d",
              background: "#7f1d1d",
              color: "#fee2e2",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        <div style={{ minHeight: "2rem", fontSize: "0.8rem", color: "#93c5fd" }}>
          {status}
        </div>

        {userInfo && (
          <pre
            style={{
              marginTop: "0.75rem",
              background: "#020617",
              borderRadius: "0.5rem",
              padding: "0.75rem",
              fontSize: "0.7rem",
              color: "#e5e7eb",
              border: "1px solid #1f2937",
              maxHeight: "200px",
              overflow: "auto",
            }}
          >
{JSON.stringify(userInfo, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
