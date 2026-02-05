// frontend/src/App.tsx
import { useState, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { ensureCsrfToken } from "./lib/apiClient";
import Home from "./pages/Home";
import TopBar from "./components/TopBar";

// Vania
import Dashboard from "./pages/DashboardPage";
import AiTripGeneratorStep1 from "./pages/aiTripGeneratorStep1";
import AiTripGeneratorStep2 from "./pages/aiTripGeneratorStep2";
import CreateTrip from "./pages/createTrip";
import ItineraryEditor from "./pages/itineraryEditor";
import PlanbotPage from "./pages/chatbot";
import Trips from "./pages/trips";
import AITripGeneratorWait from "./pages/aiTripGeneratorWait";
import TripInvitationPage from "./pages/TripInvitationPage";

// PohYee
import LandingPage from "./pages/landingPage";
import Demo from "./pages/demo";
import TravelGuidesTutorial from "./pages/travelGuidesTutorial";
import GuestFAQPage from "./pages/guestFAQpage";
import AdminDashboard from "./pages/adminDashboard";
import AdminProfile from "./pages/adminProfile";
import Profile from "./pages/profile";
import Login from "./components/login";
import ResetPassword from "./pages/resetPassword";
import SuspendAcct from "./components/suspendAcct";
import ViewTripPage from "./pages/ViewTripPage";

// KK
import DiscoveryLocal from "./pages/discoveryLocal";
import DiscoveryInternational from "./pages/discoveryInternational";
import DiscoveryFAQ from "./pages/discoveryFAQ";
import DiscoveryItineraryDetail from "./pages/discoveryItineraryDetail";

// Mingyu
import DestinationFaqPanel from "./pages/destinationFaqPanel";
import LocalInformationPanel from "./pages/localInformationPanel";
import GroupWaitForFriends from "./pages/groupWaitForFriends";
import GroupItinerarySummary from "./pages/groupItinerarySummary";
import ItineraryRecommendation from "./pages/itineraryRecommendation";
import AiTripGeneratorGroup from "./pages/GroupTripGeneratorPage";
import MediaHighlights from "./pages/mediaHighlights";
import VideoPlayer from "./pages/VideoPlayer";
import TripInvitationAccept from "./pages/TripInvitationAccept";
import GroupAITripGeneratorWait from "./pages/groupAITripGeneratorWait";

// Su
import NotesAndChecklistPage from "./pages/notesAndChecklistPage";
import BudgetPage from "./pages/budget";

// Auth-aware redirect component for landing page
function LandingOrDashboard({ 
  user, 
  onLoginClick, 
  onSignupClick 
}: { 
  user: any; 
  onLoginClick: () => void; 
  onSignupClick: () => void;
}) {
  if (user) {
    return <Navigate to="/a/d" replace />;
  }
  return <LandingPage onLoginClick={onLoginClick} onSignupClick={onSignupClick} />;
}

// Protected route wrapper - redirects to landing if not logged in
function ProtectedRoute({ 
  user, 
  authLoading, 
  children 
}: { 
  user: any; 
  authLoading: boolean; 
  children: React.ReactNode;
}) {
  if (authLoading) {
    return null; // Or a loading spinner
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const SESSION_ID_KEY = "currentUserSessionId";
  const SESSION_START_KEY = "currentUserSessionStart";

  const startUserSession = async (authUserId: string) => {
    const existingSessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (existingSessionId) return;

    const sessionStart = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_session")
      .insert({ user_id: authUserId, session_start: sessionStart })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to start user session:", error);
      return;
    }

    sessionStorage.setItem(SESSION_ID_KEY, data.id);
    sessionStorage.setItem(SESSION_START_KEY, sessionStart);
  };

  const endUserSession = async () => {
    const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    const sessionStart = sessionStorage.getItem(SESSION_START_KEY);
    if (!sessionId || !sessionStart) return;

    const end = new Date();
    const start = new Date(sessionStart);
    const durationSec = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

    const { error } = await supabase
      .from("user_session")
      .update({
        session_end: end.toISOString(),
        duration_sec: durationSec,
      })
      .eq("id", sessionId);

    if (error) {
      console.error("Failed to end user session:", error);
      return;
    }

    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(SESSION_START_KEY);
  };

  const openLogin = () => {
    setShowLogin(true);
    setAuthMode("login");
  };

  const openSignup = () => {
    setShowLogin(true);
    setAuthMode("signup");
  };

  const closeLogin = () => setShowLogin(false);

  console.log("Sealion Key Loaded:", import.meta.env.VITE_SEALION_API_KEY);

  /**
   * Auth state change listener + optional CSRF
   */
  useEffect(() => {
    // Check initial auth state
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setAuthLoading(false);

      if (data.session?.user) {
        startUserSession(data.session.user.id);
      }
    };
    checkUser();

    // Try to get CSRF token (optional - JWT auth works without it)
    ensureCsrfToken();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (event === "SIGNED_IN") {
          // Refresh CSRF on sign in (optional)
          ensureCsrfToken();

          if (session?.user) {
            startUserSession(session.user.id);
          }
          
          // Check for pending AI preference token and redirect
          const pendingAiToken = localStorage.getItem("pendingAiPreferenceToken");
          if (pendingAiToken) {
            localStorage.removeItem("pendingAiPreferenceToken");
            window.location.href = `/ai-invitation/${pendingAiToken}`;
          }
        }
        if (event === "SIGNED_OUT") {
          endUserSession();
        }
      }
    );
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  /**
   * Update user's last_active_at
   */
  useEffect(() => {
    const updateLastActive = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      await supabase
        .from("app_user")
        .update({ last_active_at: new Date().toISOString() })
        .eq("auth_user_id", user.id);
    };

    updateLastActive();

    const interval = setInterval(updateLastActive, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <>
      {!isAdminRoute && <TopBar />}

      <Routes>

        {/* Default: redirect to dashboard if logged in, otherwise show landing */}
        <Route
          path="/"
          element={
            authLoading ? null : (
              <LandingOrDashboard 
                user={user} 
                onLoginClick={openLogin} 
                onSignupClick={openSignup} 
              />
            )
          }
        />

        {/* ==================== OBFUSCATED ROUTES ==================== */}
        {/* Simple routes: /a/{code} */}
        <Route path="/a/d" element={<ProtectedRoute user={user} authLoading={authLoading}><Dashboard /></ProtectedRoute>} />
        <Route path="/a/t" element={<ProtectedRoute user={user} authLoading={authLoading}><Trips /></ProtectedRoute>} />
        <Route path="/a/p" element={<ProtectedRoute user={user} authLoading={authLoading}><Profile /></ProtectedRoute>} />
        <Route path="/a/c" element={<ProtectedRoute user={user} authLoading={authLoading}><CreateTrip /></ProtectedRoute>} />
        <Route path="/a/ag1" element={<ProtectedRoute user={user} authLoading={authLoading}><AiTripGeneratorStep1 /></ProtectedRoute>} />
        <Route path="/a/ag2" element={<ProtectedRoute user={user} authLoading={authLoading}><AiTripGeneratorStep2 /></ProtectedRoute>} />
        <Route path="/a/agw" element={<ProtectedRoute user={user} authLoading={authLoading}><AITripGeneratorWait /></ProtectedRoute>} />
        <Route path="/a/agg" element={<ProtectedRoute user={user} authLoading={authLoading}><AiTripGeneratorGroup /></ProtectedRoute>} />
        <Route path="/a/dl" element={<ProtectedRoute user={user} authLoading={authLoading}><DiscoveryLocal /></ProtectedRoute>} />
        <Route path="/a/di" element={<ProtectedRoute user={user} authLoading={authLoading}><DiscoveryInternational /></ProtectedRoute>} />
        <Route path="/a/df" element={<ProtectedRoute user={user} authLoading={authLoading}><DiscoveryFAQ /></ProtectedRoute>} />
        <Route path="/a/dfp" element={<ProtectedRoute user={user} authLoading={authLoading}><DestinationFaqPanel /></ProtectedRoute>} />
        <Route path="/a/lip" element={<ProtectedRoute user={user} authLoading={authLoading}><LocalInformationPanel /></ProtectedRoute>} />

        {/* Trip routes with encoded ID: /v/{encodedTripId}/{code} */}
        <Route path="/v/:eid/i" element={<ProtectedRoute user={user} authLoading={authLoading}><ItineraryEditor /></ProtectedRoute>} />
        <Route path="/v/:eid/b" element={<ProtectedRoute user={user} authLoading={authLoading}><BudgetPage /></ProtectedRoute>} />
        <Route path="/v/:eid/n" element={<ProtectedRoute user={user} authLoading={authLoading}><NotesAndChecklistPage /></ProtectedRoute>} />
        <Route path="/v/:eid/ch" element={<ProtectedRoute user={user} authLoading={authLoading}><PlanbotPage /></ProtectedRoute>} />
        <Route path="/v/:eid/m" element={<ProtectedRoute user={user} authLoading={authLoading}><MediaHighlights /></ProtectedRoute>} />
        <Route path="/v/:eid/r" element={<ProtectedRoute user={user} authLoading={authLoading}><ItineraryRecommendation /></ProtectedRoute>} />
        <Route path="/v/:eid/vw" element={<ViewTripPage />} />
        <Route path="/v/:eid/gw" element={<ProtectedRoute user={user} authLoading={authLoading}><GroupWaitForFriends /></ProtectedRoute>} />
        <Route path="/v/:eid/gs" element={<ProtectedRoute user={user} authLoading={authLoading}><GroupItinerarySummary /></ProtectedRoute>} />
        <Route path="/v/:eid/gaw" element={<ProtectedRoute user={user} authLoading={authLoading}><GroupAITripGeneratorWait /></ProtectedRoute>} />
        <Route path="/v/:eid/dit" element={<ProtectedRoute user={user} authLoading={authLoading}><DiscoveryItineraryDetail /></ProtectedRoute>} />
        
        {/* Routes with two encoded IDs: /v/{encodedTripId}/{code}/{encodedId2} */}
        <Route path="/v/:eid/h/:eid2" element={<ProtectedRoute user={user} authLoading={authLoading}><VideoPlayer /></ProtectedRoute>} />

        {/* Token routes: /x/{code}/{token} */}
        <Route path="/x/inv/:token" element={<TripInvitationPage />} />
        <Route path="/x/ainv/:token" element={<TripInvitationAccept />} />

        {/* ==================== LEGACY ROUTES (redirect to obfuscated) ==================== */}
        {/* These redirect old URLs to new obfuscated ones */}
        <Route path="/dashboard" element={<Navigate to="/a/d" replace />} />
        <Route path="/trips" element={<Navigate to="/a/t" replace />} />
        <Route path="/profile" element={<Navigate to="/a/p" replace />} />
        <Route path="/create-trip" element={<Navigate to="/a/c" replace />} />
        <Route path="/ai-trip-generator-step-1" element={<Navigate to="/a/ag1" replace />} />
        <Route path="/ai-trip-generator-step-2" element={<Navigate to="/a/ag2" replace />} />
        <Route path="/ai-trip-generator/wait" element={<Navigate to="/a/agw" replace />} />
        <Route path="/ai-trip-generator-group" element={<Navigate to="/a/agg" replace />} />
        <Route path="/discovery-local" element={<Navigate to="/a/dl" replace />} />
        <Route path="/discovery-international" element={<Navigate to="/a/di" replace />} />
        <Route path="/discovery-faq" element={<Navigate to="/a/df" replace />} />
        <Route path="/destination-faq-panel" element={<Navigate to="/a/dfp" replace />} />
        <Route path="/local-info-panel" element={<Navigate to="/a/lip" replace />} />

        {/* ==================== PUBLIC ROUTES ==================== */}
        <Route
          path="/landing-page"
          element={<LandingPage onLoginClick={openLogin} onSignupClick={openSignup} />}
        />
        <Route
          path="/demo"
          element={<Demo onLoginClick={openLogin} onSignupClick={openSignup} />}
        />
        <Route
          path="/travel-guides/:guideId"
          element={<TravelGuidesTutorial onLoginClick={openLogin} onSignupClick={openSignup} />}
        />
        <Route path="/guest-faq" element={<GuestFAQPage onLoginClick={openLogin} onSignupClick={openSignup} />} />
        <Route path="/admin-dashboard" element={<ProtectedRoute user={user} authLoading={authLoading}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin-profile" element={<ProtectedRoute user={user} authLoading={authLoading}><AdminProfile /></ProtectedRoute>} />
        <Route
          path="/signin"
          element={<Login isOpen={true} onClose={() => window.history.back()} defaultMode="login" />}
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/suspendAcct" element={<SuspendAcct />} />
        
        {/* Legacy trip routes - kept for backwards compatibility with existing links */}
        <Route path="/trip/:tripId/view" element={<ViewTripPage />} />
        <Route path="/trip/:tripId/itinerary" element={<ProtectedRoute user={user} authLoading={authLoading}><ItineraryEditor /></ProtectedRoute>} />
        <Route path="/trip/:tripId/chatbot" element={<ProtectedRoute user={user} authLoading={authLoading}><PlanbotPage /></ProtectedRoute>} />
        <Route path="/trip/:tripId/recommendations" element={<ProtectedRoute user={user} authLoading={authLoading}><ItineraryRecommendation /></ProtectedRoute>} />
        <Route path="/trip/:tripId/media" element={<ProtectedRoute user={user} authLoading={authLoading}><MediaHighlights /></ProtectedRoute>} />
        <Route path="/trip/:tripId/highlight/:highlightId" element={<ProtectedRoute user={user} authLoading={authLoading}><VideoPlayer /></ProtectedRoute>} />
        <Route path="/trip/:tripId/notes" element={<ProtectedRoute user={user} authLoading={authLoading}><NotesAndChecklistPage /></ProtectedRoute>} />
        <Route path="/trip/:tripId/budget" element={<ProtectedRoute user={user} authLoading={authLoading}><BudgetPage /></ProtectedRoute>} />
        <Route path="/trip-invitation/:token" element={<TripInvitationPage />} />
        <Route path="/ai-invitation/:token" element={<TripInvitationAccept />} />
        <Route path="/discovery-itinerary/:tripId" element={<DiscoveryItineraryDetail />} />
        <Route path="/group-wait-for-friends/:tripId" element={<ProtectedRoute user={user} authLoading={authLoading}><GroupWaitForFriends /></ProtectedRoute>} />
        <Route path="/group-trip/:tripId/summary" element={<ProtectedRoute user={user} authLoading={authLoading}><GroupItinerarySummary /></ProtectedRoute>} />
        <Route path="/group-ai-wait/:tripId" element={<ProtectedRoute user={user} authLoading={authLoading}><GroupAITripGeneratorWait /></ProtectedRoute>} />
      </Routes>

      <Login
        isOpen={showLogin}
        onClose={closeLogin}
        defaultMode={authMode}
      />
    </>
  );
}
