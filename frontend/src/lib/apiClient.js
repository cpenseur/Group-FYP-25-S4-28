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
    let message = `API error ${res.status}`;

    const contentType = res.headers.get("content-type") || "";

    try {
      if (contentType.includes("application/json")) {
        const data = await res.json();
        message =
          typeof data === "string"
            ? data
            : data?.detail || JSON.stringify(data);
      } else {
        message = await res.text();
      }
    } catch (e) {
      // do nothing, keep default message
    }

    throw new Error(message);
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
window.supabase = supabase;

export default apiClient;
