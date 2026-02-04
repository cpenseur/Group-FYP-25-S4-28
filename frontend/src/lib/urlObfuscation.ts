// frontend/src/lib/urlObfuscation.ts
// URL obfuscation utilities to hide route names and sensitive IDs

/**
 * Simple encoding/decoding for IDs using base64 with a salt
 * This is NOT cryptographic security - it's obfuscation to prevent casual URL guessing
 */
const SALT = 'TrM8'; // Short salt prefix

// Encode a numeric ID to an obfuscated string
export function encodeId(id: number | string): string {
  const idStr = String(id);
  // Add salt and encode to base64, then make URL-safe
  const encoded = btoa(`${SALT}${idStr}`);
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Decode an obfuscated string back to the original ID
export function decodeId(encoded: string): string {
  try {
    // Restore base64 padding and characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    const decoded = atob(base64);
    // Remove salt prefix
    if (decoded.startsWith(SALT)) {
      return decoded.slice(SALT.length);
    }
    return decoded;
  } catch {
    return encoded; // Return as-is if decoding fails
  }
}

/**
 * Route code mappings - short codes to hide actual route purposes
 * Format: shortCode -> actualRouteName
 */
export const ROUTE_CODES = {
  // Main app routes
  'd': 'dashboard',
  't': 'trips',
  'p': 'profile',
  'c': 'create-trip',
  
  // Trip sub-routes (used as /v/{tripId}/{code})
  'i': 'itinerary',
  'b': 'budget',
  'n': 'notes',
  'ch': 'chatbot',
  'm': 'media',
  'h': 'highlight',
  'r': 'recommendations',
  'vw': 'view',
  
  // AI routes
  'ag1': 'ai-trip-generator-step-1',
  'ag2': 'ai-trip-generator-step-2',
  'agw': 'ai-trip-generator/wait',
  'agg': 'ai-trip-generator-group',
  'gaw': 'group-ai-wait',
  
  // Group routes
  'gw': 'group-wait-for-friends',
  'gs': 'group-trip-summary',
  
  // Discovery routes
  'dl': 'discovery-local',
  'di': 'discovery-international',
  'df': 'discovery-faq',
  'dit': 'discovery-itinerary',
  
  // Other
  'dfp': 'destination-faq-panel',
  'lip': 'local-info-panel',
  'inv': 'trip-invitation',
  'ainv': 'ai-invitation',
} as const;

// Reverse mapping for decoding
export const ROUTE_NAMES = Object.fromEntries(
  Object.entries(ROUTE_CODES).map(([code, name]) => [name, code])
) as Record<string, string>;

/**
 * Build an obfuscated URL path
 */
export function buildObfuscatedPath(
  routeName: keyof typeof ROUTE_NAMES,
  params?: { tripId?: number | string; highlightId?: number | string; token?: string }
): string {
  const code = ROUTE_NAMES[routeName] || routeName;
  
  if (params?.tripId !== undefined) {
    const encodedTripId = encodeId(params.tripId);
    
    if (params?.highlightId !== undefined) {
      const encodedHighlightId = encodeId(params.highlightId);
      return `/v/${encodedTripId}/${code}/${encodedHighlightId}`;
    }
    
    return `/v/${encodedTripId}/${code}`;
  }
  
  if (params?.token) {
    return `/x/${code}/${params.token}`;
  }
  
  return `/a/${code}`;
}

/**
 * Navigation helper - use this instead of navigate() for obfuscated routes
 */
export function getObfuscatedUrl(
  routeName: string,
  params?: { tripId?: number | string; highlightId?: number | string; token?: string }
): string {
  return buildObfuscatedPath(routeName as keyof typeof ROUTE_NAMES, params);
}

// Legacy URL redirect mappings (for backwards compatibility)
export const LEGACY_ROUTES: Record<string, (params: Record<string, string>) => string> = {
  '/dashboard': () => '/a/d',
  '/trips': () => '/a/t',
  '/profile': () => '/a/p',
  '/create-trip': () => '/a/c',
};
