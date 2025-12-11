// frontend/src/lib/apiClient.js
import { supabase } from "./supabaseClient";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

export async function apiFetch(path, options = {}) {
  // IMPORTANT: path should be like "/f1/trips/5/overview/"
  // NOT "/api/f1/..." because API_BASE_URL already has "/api"

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Error getting Supabase session:", sessionError);
  }

  const token = session?.access_token;

  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // ---------- handle non-OK responses ----------
  if (!res.ok) {
    let message;

    try {
      // try JSON first
      const data = await res.json();
      if (typeof data === "string") {
        message = data;
      } else if (data && data.detail) {
        message = data.detail;
      } else {
        message = JSON.stringify(data);
      }
    } catch {
      // fall back to plain text
      const text = await res.text();
      message = text || `API error ${res.status}`;
    }

    throw new Error(`API error ${res.status}: ${message}`);
  }

  // ---------- handle successful responses ----------
  // DELETE endpoints often return 204 No Content
  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type") || "";

  // If not JSON, just return text (or null if empty)
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    return text || null;
  }

  // Normal JSON response
  return res.json();
}

// Small convenience wrapper so we can do apiClient.get(...)
const apiClient = {
  get(path) {
    return apiFetch(path);
  },
  post(path, body) {
    return apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  // you can add put/patch/delete later if needed
};

export default apiClient;
