// frontend/src/api/auth.js

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

export async function loginUser(username, password) {
    const response = await fetch(`${API_BASE}/auth/login/`, {
        method: "POST",
        credentials: "include",   // important for session cookies
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
    });
    return response.json();
}

export async function logoutUser() {
    const response = await fetch(`${API_BASE}/auth/logout/`, {
        method: "POST",
        credentials: "include",
    });
    return response.json();
}

export async function getCurrentUser() {
    const response = await fetch(`${API_BASE}/auth/me/`, {
        method: "GET",
        credentials: "include",
    });
    return response.json();
}
