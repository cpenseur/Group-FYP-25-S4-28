// frontend/src/App.tsx
import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
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

// PohYee
import LandingPage from "./pages/landingPage";
import Demo from "./pages/Demo";
import TravelGuidesTutorial from "./pages/travelGuidesTutorial";
import GuestFAQPage from "./pages/guestFAQpage";
import AdminDashboard from "./pages/adminDashboard";
import Profile from "./pages/profile";
import Login from "./components/login";
import ResetPassword from "./pages/resetPassword";

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

export default function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const openLogin = () => {
    setShowLogin(true);
    setAuthMode("login");
  };

  const openSignup = () => {
    setShowLogin(true);
    setAuthMode("signup");
  };

  const closeLogin = () => setShowLogin(false);

  // Get CSRF token on app load and after authentication changes
  useEffect(() => {
    const getCSRF = () => {
      fetch('http://localhost:8000/api/f1/csrf/', {
        credentials: 'include'
      })
        .then(() => console.log('✅ CSRF token fetched'))
        .catch(err => console.error('❌ Failed to get CSRF token:', err));
    };

    // Get CSRF token immediately
    getCSRF();

    // Also get CSRF token after login/logout
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        console.log(`User ${event}, refreshing CSRF token`);
        getCSRF();
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <TopBar />

      <Routes>
        {/* Dev home (team testing menu) */}
        <Route path="/" element={<Home />} />

        {/* PohYee */}
        <Route path="/landing-page" element={<LandingPage onLoginClick={openLogin} onSignupClick={openSignup}  />} />
        <Route path="/demo" element={<Demo onLoginClick={openLogin} onSignupClick={openSignup} />} />
        <Route path="/travel-guides/:guideId" element={<TravelGuidesTutorial onLoginClick={openLogin} onSignupClick={openSignup} />} />
        <Route path="/guest-faq" element={<GuestFAQPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/signin" element={<Login isOpen={true} onClose={() => window.history.back()} defaultMode="login"/>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Vania */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai-trip-generator-step-1" element={<AiTripGeneratorStep1 />} />
        <Route path="/ai-trip-generator-step-2" element={<AiTripGeneratorStep2 />} />
        <Route path="/create-trip" element={<CreateTrip />} />
        <Route path="/trip/:tripId/itinerary" element={<ItineraryEditor />} />
        <Route path="/trip/:tripId/chatbot" element={<PlanbotPage />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/ai-trip-generator/wait" element={<AITripGeneratorWait />} />

        {/* KK */}
        <Route path="/discovery-local" element={<DiscoveryLocal />} />
        <Route path="/discovery-international" element={<DiscoveryInternational />} />
        <Route path="/discovery-faq" element={<DiscoveryFAQ />} />
        <Route path="/discovery-itinerary/:tripId" element={<DiscoveryItineraryDetail />} />

        {/* Mingyu */}
        <Route path="/destination-faq-panel" element={<DestinationFaqPanel />} />
        <Route path="/local-info-panel" element={<LocalInformationPanel />} />
        <Route path="/group-wait-for-friends/:tripId" element={<GroupWaitForFriends />} />
        <Route path="/group-trip/:tripId/summary" element={<GroupItinerarySummary />} />
        <Route path="/ai-trip-generator-group" element={<AiTripGeneratorGroup />} />
        <Route path="/trip/:tripId/recommendations" element={<ItineraryRecommendation />} />
        <Route path="/trip/:tripId/media" element={<MediaHighlights />} />
        <Route path="/trip/:tripId/highlight/:highlightId" element={<VideoPlayer />} />
        <Route path="/trip-invitation/:token" element={<TripInvitationAccept />} />
        <Route path="/group-ai-wait/:tripId" element={<GroupAITripGeneratorWait />} />

        {/* Su */}
        <Route path="/trip/:tripId/notes" element={<NotesAndChecklistPage />} />
        <Route path="/trip/:tripId/budget" element={<BudgetPage />} />
      </Routes>

      <Login
        isOpen={showLogin}
        onClose={closeLogin}
        defaultMode={authMode}
      />    
    </>  
  );
}