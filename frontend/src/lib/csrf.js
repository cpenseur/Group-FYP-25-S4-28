// frontend/src/lib/csrf.js

/**
 * Get CSRF token from browser cookies
 * @param {string} name - Cookie name (usually 'csrftoken')
 * @returns {string|null} - CSRF token value or null if not found
 */
export function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}