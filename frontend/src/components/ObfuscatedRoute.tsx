// frontend/src/components/ObfuscatedRoute.tsx
// Wrapper components that decode obfuscated URL parameters

import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { decodeId, ROUTE_CODES } from '../lib/urlObfuscation';

type RouteCode = keyof typeof ROUTE_CODES;

interface DecodedParams {
  tripId?: string;
  highlightId?: string;
  token?: string;
  guideId?: string;
}

/**
 * HOC that decodes obfuscated tripId and passes it to the wrapped component
 */
export function withDecodedTripId<P extends { tripId?: string }>(
  WrappedComponent: React.ComponentType<P>
): React.FC<Omit<P, 'tripId'>> {
  return function DecodedTripIdWrapper(props: Omit<P, 'tripId'>) {
    const { encodedTripId } = useParams<{ encodedTripId: string }>();
    const tripId = encodedTripId ? decodeId(encodedTripId) : undefined;
    
    return <WrappedComponent {...(props as P)} tripId={tripId} />;
  };
}

/**
 * Wrapper component for trip-related routes with encoded tripId
 */
export function DecodedTripRoute({ 
  children,
  paramName = 'tripId'
}: { 
  children: (params: DecodedParams) => React.ReactNode;
  paramName?: string;
}) {
  const params = useParams();
  const encodedTripId = params.encodedTripId || params.tripId;
  const encodedHighlightId = params.encodedHighlightId || params.highlightId;
  
  const decodedParams: DecodedParams = {
    tripId: encodedTripId ? decodeId(encodedTripId) : undefined,
    highlightId: encodedHighlightId ? decodeId(encodedHighlightId) : undefined,
    token: params.token,
    guideId: params.guideId,
  };
  
  return <>{children(decodedParams)}</>;
}

/**
 * Component that clones children with decoded tripId prop
 */
export function TripParamDecoder({ children }: { children: React.ReactElement }) {
  const { encodedTripId, encodedHighlightId } = useParams<{ 
    encodedTripId: string; 
    encodedHighlightId?: string;
  }>();
  
  const tripId = encodedTripId ? decodeId(encodedTripId) : undefined;
  const highlightId = encodedHighlightId ? decodeId(encodedHighlightId) : undefined;
  
  // Clone the child element and inject the decoded tripId
  return React.cloneElement(children, { 
    tripId, 
    highlightId,
    // Also set as key to force remount when ID changes
    key: tripId 
  });
}

/**
 * Legacy route redirector - redirects old URLs to new obfuscated ones
 */
export function LegacyRedirect({ 
  to, 
  withTripId = false,
  withHighlightId = false,
  withToken = false 
}: { 
  to: string; 
  withTripId?: boolean;
  withHighlightId?: boolean;
  withToken?: boolean;
}) {
  const params = useParams();
  
  let redirectPath = to;
  
  if (withTripId && params.tripId) {
    redirectPath = redirectPath.replace(':tripId', params.tripId);
  }
  if (withHighlightId && params.highlightId) {
    redirectPath = redirectPath.replace(':highlightId', params.highlightId);
  }
  if (withToken && params.token) {
    redirectPath = redirectPath.replace(':token', params.token);
  }
  
  return <Navigate to={redirectPath} replace />;
}
