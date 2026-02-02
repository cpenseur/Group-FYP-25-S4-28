// frontend/src/pages/AiPreferencePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

const AiPreferencePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [tripInfo, setTripInfo] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Extract token from query string
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setToken(params.get("token"));
  }, [location.search]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Not logged in - save token and redirect to login
        if (token) {
          localStorage.setItem("pendingAiPreferenceToken", token);
        }
        setIsLoggedIn(false);
        navigate("/signin");
        return;
      }
      setIsLoggedIn(true);
    };
    if (token) {
      checkAuth();
    }
  }, [token, navigate]);

  // On mount, check if there's a pending token from before login
  useEffect(() => {
    const pendingToken = localStorage.getItem("pendingAiPreferenceToken");
    if (pendingToken && !token) {
      localStorage.removeItem("pendingAiPreferenceToken");
      navigate(`/ai-preference?token=${pendingToken}`);
    }
  }, []);

  // Fetch invitation details
  useEffect(() => {
    if (!token || isLoggedIn !== true) return;
    const fetchInvite = async () => {
      setLoading(true);
      try {
        const invite = await apiFetch(`/f1/trip-invitation/${token}/accept/`, { method: "GET" });
        setTripInfo(invite);
      } catch (err: any) {
        setError(err.message || "Invalid or expired invitation");
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token, isLoggedIn]);

  // Handle preference form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      // Save preferences (replace with your actual fields)
      await apiFetch(`/f1/trip-invitation/${token}/preferences/`, {
        method: "POST",
        body: JSON.stringify(preferences),
      });
      // Accept invitation after preferences are saved
      await apiFetch(`/f1/trip-invitation/${token}/accept/`, { method: "POST" });
      // Redirect to group wait page or next AI step
      navigate(`/groupWaitForFriends?token=${token}`);
    } catch (err: any) {
      setError(err.message || "Failed to save preferences or accept invitation");
    } finally {
      setSaving(false);
    }
  };

  // Example preference fields (replace with your actual fields)
  const handlePrefChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPreferences({ ...preferences, [e.target.name]: e.target.value });
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading invitation...</div>;
  if (error) return <div style={{ padding: 40, color: "#ef4444", textAlign: "center" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.08)", padding: 32 }}>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Share Your Preferences</h2>
      <div style={{ marginBottom: 24, color: "#64748b" }}>
        {tripInfo?.trip_title ? `You're invited to join: ${tripInfo.trip_title}` : "Trip Invitation"}
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 500 }}>Diet Preference:</label>
          <select name="diet_preference" value={preferences.diet_preference || ""} onChange={handlePrefChange} style={{ marginLeft: 12 }} required>
            <option value="">Select...</option>
            <option value="none">No Preference</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="halal">Halal</option>
            <option value="kosher">Kosher</option>
            <option value="gluten_free">Gluten Free</option>
          </select>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 500 }}>Travel Style:</label>
          <select name="travel_style" value={preferences.travel_style || ""} onChange={handlePrefChange} style={{ marginLeft: 12 }} required>
            <option value="">Select...</option>
            <option value="relaxed">Relaxed</option>
            <option value="adventure">Adventure</option>
            <option value="cultural">Cultural</option>
            <option value="luxury">Luxury</option>
          </select>
        </div>
        {/* Add more preference fields as needed */}
        <button type="submit" disabled={saving} style={{ width: "100%", padding: 14, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 16, marginTop: 12 }}>
          {saving ? "Saving..." : "Save Preferences & Join"}
        </button>
      </form>
      {error && <div style={{ color: "#ef4444", marginTop: 16 }}>{error}</div>}
    </div>
  );
};

export default AiPreferencePage;
