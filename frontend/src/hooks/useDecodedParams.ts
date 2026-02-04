// frontend/src/hooks/useDecodedParams.ts
// Hook to get decoded URL parameters from both obfuscated and legacy routes

import { useParams } from 'react-router-dom';
import { decodeId } from '../lib/urlObfuscation';

/**
 * Get tripId from URL - handles both obfuscated (/v/:eid/...) and legacy (/trip/:tripId/...) routes
 */
export function useTripId(): string | undefined {
  const params = useParams<{ tripId?: string; eid?: string }>();
  
  // If we have encoded ID (eid), decode it
  if (params.eid) {
    return decodeId(params.eid);
  }
  
  // Otherwise use legacy tripId directly
  return params.tripId;
}

/**
 * Get highlightId from URL - handles both obfuscated and legacy routes
 */
export function useHighlightId(): string | undefined {
  const params = useParams<{ highlightId?: string; eid2?: string }>();
  
  // If we have encoded ID (eid2), decode it
  if (params.eid2) {
    return decodeId(params.eid2);
  }
  
  // Otherwise use legacy highlightId directly
  return params.highlightId;
}

/**
 * Get token from URL - handles both obfuscated (/x/inv/:token) and legacy (/trip-invitation/:token) routes
 */
export function useInvitationToken(): string | undefined {
  const params = useParams<{ token?: string }>();
  return params.token;
}

/**
 * Get guideId from URL
 */
export function useGuideId(): string | undefined {
  const params = useParams<{ guideId?: string }>();
  return params.guideId;
}

/**
 * Combined hook for all decoded params
 */
export function useDecodedParams() {
  const tripId = useTripId();
  const highlightId = useHighlightId();
  const token = useInvitationToken();
  const guideId = useGuideId();
  
  return { tripId, highlightId, token, guideId };
}
