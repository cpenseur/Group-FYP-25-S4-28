// frontend/src/lib/apiClient.js
import { supabase } from "/src/lib/supabaseClient.js";
import { getCookie } from "./csrf.js";  // ✅ Import CSRF helper

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

/**
 * ✅ Main API fetch function with CSRF token support
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

  // ✅ Prepare headers
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Add Supabase JWT token if available
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // ✅ Add CSRF token for non-GET requests
  const method = options.method?.toUpperCase() || 'GET';
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
      console.log('🔐 Added CSRF token to request:', csrfToken.substring(0, 10) + '...');
    } else {
      console.warn('⚠️ No CSRF token found for', method, 'request to', path);
    }
  }

  // ✅ Make the request with credentials to send/receive cookies
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',  // ← CRITICAL: This sends cookies!
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
 * ✅ Fetch CSRF token from backend
 */
export async function fetchCsrfToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/f1/csrf/`, {
      method: 'GET',
      credentials: 'include',  // Important: saves the cookie
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ CSRF token fetched successfully');
    return data.csrfToken;
    
  } catch (error) {
    console.error('❌ Error fetching CSRF token:', error);
    throw error;
  }
}

/**
 * ✅ Ensure CSRF token exists (fetch if not present)
 */
export async function ensureCsrfToken() {
  const existingToken = getCookie('csrftoken');
  
  if (!existingToken) {
    console.log('🔄 No CSRF token found, fetching from backend...');
    await fetchCsrfToken();
  } else {
    console.log('✅ CSRF token already exists');
  }
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