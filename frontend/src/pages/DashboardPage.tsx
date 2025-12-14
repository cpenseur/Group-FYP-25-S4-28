// frontend/src/pages/DashboardPage.tsx
import { useEffect, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../lib/apiClient";

type BackendUser = { username?: string; email?: string };

export default function DashboardPage() {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<string>("Loading…");
  const [backendStatus, setBackendStatus] = useState<string>("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      setSupabaseStatus("Checking Supabase session…");

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        console.warn("Supabase getUser error / no user:", error);
        setSupabaseUser(null);
        setSupabaseStatus("No Supabase user. Please log in first.");
        setBackendUser(null);
        setBackendStatus("");
        return;
      }

      setSupabaseUser(user);
      setSupabaseStatus("Supabase user loaded.");

      // Optional: call backend
      try {
        const data = await apiFetch("/auth/whoami/");
        setBackendUser(data);
        setBackendStatus("Backend recognized you successfully.");
      } catch (err) {
        console.error("Backend /auth/whoami/ error:", err);
        setBackendUser(null);
        setBackendStatus(
          "Backend connection not configured yet (this is optional for now)."
        );
      }
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    setSupabaseStatus("Logging out from Supabase…");
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      setSupabaseStatus(`Logout error: ${error.message}`);
    } else {
      setSupabaseUser(null);
      setBackendUser(null);
      setBackendStatus("");
      setSupabaseStatus("Logged out. You can log in again.");
    }
  };

  const goToLogin = () => {
    navigate("/signin");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          marginBottom: "0.5rem",
        }}
      >
        TripMate Dashboard
      </h1>

      <p style={{ color: "#9ca3af", marginBottom: "1rem" }}>{supabaseStatus}</p>

      {supabaseUser && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            border: "1px solid #1f2937",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>
            Supabase User
          </h2>
          <p style={{ fontSize: "0.9rem" }}>
            <strong>Email:</strong> {supabaseUser.email}
          </p>
          <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
            ID: {supabaseUser.id}
          </p>
        </div>
      )}

      {supabaseUser && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            border: "1px solid #1f2937",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>
            Backend (Django) Status
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
            {backendStatus || "Not called yet."}
          </p>

          {backendUser && (
            <div style={{ fontSize: "0.9rem" }}>
              <p>
                <strong>Username:</strong> {backendUser.username}
              </p>
              <p>
                <strong>Email:</strong> {backendUser.email || "N/A"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      {supabaseUser ? (
        <button
          onClick={handleLogout}
          style={{
            padding: "0.6rem 1.2rem",
            borderRadius: "999px",
            border: "1px solid #7f1d1d",
            background: "#7f1d1d",
            color: "#fee2e2",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      ) : (
        <button
          onClick={goToLogin}
          style={{
            padding: "0.6rem 1.4rem",
            borderRadius: "999px",
            border: "1px solid #22c55e",
            background: "#22c55e",
            color: "#022c22",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Go to Login
        </button>
      )}
    </div>
  );
}
