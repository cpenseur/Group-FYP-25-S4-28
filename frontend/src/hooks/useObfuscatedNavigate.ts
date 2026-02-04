// frontend/src/hooks/useObfuscatedNavigate.ts
// Navigation hook for obfuscated URLs

import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { encodeId } from '../lib/urlObfuscation';

type NavigateOptions = {
  replace?: boolean;
  state?: any;
};

/**
 * Hook that provides navigation functions with automatic URL obfuscation
 */
export function useObfuscatedNavigate() {
  const navigate = useNavigate();

  // Navigate to a simple route (no params)
  const goTo = useCallback((route: string, options?: NavigateOptions) => {
    navigate(route, options);
  }, [navigate]);

  // Navigate to dashboard
  const goToDashboard = useCallback((options?: NavigateOptions) => {
    navigate('/a/d', options);
  }, [navigate]);

  // Navigate to trips list
  const goToTrips = useCallback((options?: NavigateOptions) => {
    navigate('/a/t', options);
  }, [navigate]);

  // Navigate to profile
  const goToProfile = useCallback((options?: NavigateOptions) => {
    navigate('/a/p', options);
  }, [navigate]);

  // Navigate to create trip
  const goToCreateTrip = useCallback((options?: NavigateOptions) => {
    navigate('/a/c', options);
  }, [navigate]);

  // Navigate to trip itinerary
  const goToItinerary = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/i`, options);
  }, [navigate]);

  // Navigate to trip budget
  const goToBudget = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/b`, options);
  }, [navigate]);

  // Navigate to trip notes
  const goToNotes = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/n`, options);
  }, [navigate]);

  // Navigate to trip chatbot
  const goToChatbot = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/ch`, options);
  }, [navigate]);

  // Navigate to trip media
  const goToMedia = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/m`, options);
  }, [navigate]);

  // Navigate to trip highlight/video
  const goToHighlight = useCallback((tripId: number | string, highlightId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/h/${encodeId(highlightId)}`, options);
  }, [navigate]);

  // Navigate to trip recommendations
  const goToRecommendations = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/r`, options);
  }, [navigate]);

  // Navigate to trip view (public)
  const goToTripView = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/vw`, options);
  }, [navigate]);

  // Navigate to group wait
  const goToGroupWait = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/gw`, options);
  }, [navigate]);

  // Navigate to group trip summary
  const goToGroupSummary = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/gs`, options);
  }, [navigate]);

  // Navigate to group AI wait
  const goToGroupAiWait = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/gaw`, options);
  }, [navigate]);

  // Navigate to discovery itinerary
  const goToDiscoveryItinerary = useCallback((tripId: number | string, options?: NavigateOptions) => {
    navigate(`/v/${encodeId(tripId)}/dit`, options);
  }, [navigate]);

  // Navigate to AI generator step 1
  const goToAiGenerator1 = useCallback((options?: NavigateOptions) => {
    navigate('/a/ag1', options);
  }, [navigate]);

  // Navigate to AI generator step 2
  const goToAiGenerator2 = useCallback((options?: NavigateOptions) => {
    navigate('/a/ag2', options);
  }, [navigate]);

  // Navigate to AI generator wait
  const goToAiGeneratorWait = useCallback((options?: NavigateOptions) => {
    navigate('/a/agw', options);
  }, [navigate]);

  // Navigate to group AI generator
  const goToGroupAiGenerator = useCallback((options?: NavigateOptions) => {
    navigate('/a/agg', options);
  }, [navigate]);

  // Navigate to discovery local
  const goToDiscoveryLocal = useCallback((options?: NavigateOptions) => {
    navigate('/a/dl', options);
  }, [navigate]);

  // Navigate to discovery international
  const goToDiscoveryInternational = useCallback((options?: NavigateOptions) => {
    navigate('/a/di', options);
  }, [navigate]);

  // Navigate to discovery FAQ
  const goToDiscoveryFaq = useCallback((options?: NavigateOptions) => {
    navigate('/a/df', options);
  }, [navigate]);

  // Navigate with token (invitations)
  const goToTripInvitation = useCallback((token: string, options?: NavigateOptions) => {
    navigate(`/x/inv/${token}`, options);
  }, [navigate]);

  const goToAiInvitation = useCallback((token: string, options?: NavigateOptions) => {
    navigate(`/x/ainv/${token}`, options);
  }, [navigate]);

  return {
    navigate,
    goTo,
    goToDashboard,
    goToTrips,
    goToProfile,
    goToCreateTrip,
    goToItinerary,
    goToBudget,
    goToNotes,
    goToChatbot,
    goToMedia,
    goToHighlight,
    goToRecommendations,
    goToTripView,
    goToGroupWait,
    goToGroupSummary,
    goToGroupAiWait,
    goToDiscoveryItinerary,
    goToAiGenerator1,
    goToAiGenerator2,
    goToAiGeneratorWait,
    goToGroupAiGenerator,
    goToDiscoveryLocal,
    goToDiscoveryInternational,
    goToDiscoveryFaq,
    goToTripInvitation,
    goToAiInvitation,
  };
}

/**
 * Helper to build obfuscated URL strings (for Link components)
 */
export const obfuscatedPaths = {
  dashboard: '/a/d',
  trips: '/a/t',
  profile: '/a/p',
  createTrip: '/a/c',
  aiGenerator1: '/a/ag1',
  aiGenerator2: '/a/ag2',
  aiGeneratorWait: '/a/agw',
  groupAiGenerator: '/a/agg',
  discoveryLocal: '/a/dl',
  discoveryInternational: '/a/di',
  discoveryFaq: '/a/df',
  destinationFaqPanel: '/a/dfp',
  localInfoPanel: '/a/lip',
  
  // Functions for routes with params
  itinerary: (tripId: number | string) => `/v/${encodeId(tripId)}/i`,
  budget: (tripId: number | string) => `/v/${encodeId(tripId)}/b`,
  notes: (tripId: number | string) => `/v/${encodeId(tripId)}/n`,
  chatbot: (tripId: number | string) => `/v/${encodeId(tripId)}/ch`,
  media: (tripId: number | string) => `/v/${encodeId(tripId)}/m`,
  highlight: (tripId: number | string, highlightId: number | string) => 
    `/v/${encodeId(tripId)}/h/${encodeId(highlightId)}`,
  recommendations: (tripId: number | string) => `/v/${encodeId(tripId)}/r`,
  tripView: (tripId: number | string) => `/v/${encodeId(tripId)}/vw`,
  groupWait: (tripId: number | string) => `/v/${encodeId(tripId)}/gw`,
  groupSummary: (tripId: number | string) => `/v/${encodeId(tripId)}/gs`,
  groupAiWait: (tripId: number | string) => `/v/${encodeId(tripId)}/gaw`,
  discoveryItinerary: (tripId: number | string) => `/v/${encodeId(tripId)}/dit`,
  
  // Token-based routes
  tripInvitation: (token: string) => `/x/inv/${token}`,
  aiInvitation: (token: string) => `/x/ainv/${token}`,
};
