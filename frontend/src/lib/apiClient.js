// frontend/src/lib/apiClient.js
import { supabase } from "/src/lib/supabaseClient.js";
import { getCookie } from "./csrf.js";  // ƒo. Import CSRF helper

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

// ƒo. In-memory CSRF token storage (for cross-origin scenarios)
let cachedCsrfToken = null;

/**
 * ƒo. Get CSRF token from cache or cookie
 */
function getCSRFToken() {
  // First check in-memory cache
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }
  // Fall back to cookie (same-origin scenarios)
  return getCookie('csrftoken');
}

/**
 * ƒo. Main API fetch function with CSRF token support
 */
export async function apiFetch(path, options = {}) {
  // IMPORTANT: path should be like "/f1/trips/5/overview/"
  // NOT "/api/f1/..." because API_BASE_URL already has "/api"
  
  // Get Supabase session for authentication
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Error getting Supabase session:", sessionError);
  }

  const token = session?.access_token;

  // ƒo. Prepare headers
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Add Supabase JWT token if available
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add CSRF token for non-GET requests (optional with JWT auth)
  const method = options.method?.toUpperCase() || 'GET';
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }
  }

  // ƒo. Make the request with credentials to send/receive cookies
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',  // ƒ+? CRITICAL: This sends cookies!
  });

  // ---------- Handle non-OK responses ----------
  if (!res.ok) {
    let message = `API error ${res.status}`;
    const contentType = res.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const data = await res.json();
        message =
          typeof data === "string"
            ? data
            : data?.detail || data?.error || JSON.stringify(data);
      } else {
        message = await res.text();
      }
    } catch (e) {
      // Keep default message
    }
    throw new Error(message);
  }

  // ---------- Handle successful responses ----------
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

/**
 * ƒo. Fetch CSRF token from backend (optional - JWT auth doesn't require it)
 */
export async function fetchCsrfToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/f1/csrf/`, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      // Not critical - JWT auth works without CSRF
      return null;
    }
    
    const data = await response.json();
    cachedCsrfToken = data.csrfToken;
    return data.csrfToken;
    
  } catch (error) {
    // Silent fail - CSRF is optional with JWT auth
    return null;
  }
}

/**
 * ƒo. Ensure CSRF token exists (optional with JWT auth)
 */
export async function ensureCsrfToken() {
  const existingToken = getCSRFToken();
  if (!existingToken) {
    await fetchCsrfToken();
  }
}

/**
 * ƒo. Clear cached CSRF token (call on logout)
 */
export function clearCsrfToken() {
  cachedCsrfToken = null;
}

/**
 * Small convenience wrapper for common HTTP methods
 */
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
  
  put(path, body) {
    return apiFetch(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  
  patch(path, body) {
    return apiFetch(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  
  delete(path) {
    return apiFetch(path, {
      method: "DELETE",
    });
  },
};

export default apiClient;
