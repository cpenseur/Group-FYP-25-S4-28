// frontend/src/App.tsx
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import TopBar from "./components/TopBar";

// Vania
import Dashboard from "./pages/DashboardPage";
import AiTripGeneratorStep1 from "./pages/aiTripGeneratorStep1";
import AiTripGeneratorStep2 from "./pages/aiTripGeneratorStep2";
import CreateTrip from "./pages/createTrip";
import ItineraryEditor from "./pages/itineraryEditor";
import ChatbotPage from "./pages/chatbot";

// PohYee
import ExportPDF from "./pages/exportPDF";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/landingPage";
import TravelGuidesTutorial from "./pages/travelGuidesTutorial";
import GuestFAQPage from "./pages/guestFAQpage";
import AdminDashboard from "./pages/adminDashboard";

// KK
import DiscoveryLocal from "./pages/discoveryLocal";
import DiscoveryInternational from "./pages/discoveryInternational";
import DiscoveryFAQ from "./pages/discoveryFAQ";

// Mingyu
import DestinationFaqPanel from "./pages/destinationFaqPanel";
import LocalInformationPanel from "./pages/localInformationPanel";
import GroupWaitForFriends from "./pages/groupWaitForFriends";
import GroupItinerarySummary from "./pages/groupItinerarySummary";
import ItineraryRecommendation from "./pages/itineraryRecommendation";
import MediaHighlights from "./pages/mediaHighlights";

// Su
import NotesAndChecklistPage from "./pages/notesAndChecklistPage";
import BudgetPage from "./pages/budget";

export default function App() {
  return (
    <>
      <TopBar />

      <Routes>
        {/* Dev home (team testing menu) */}
        <Route path="/" element={<Home />} />

        {/* Vania */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai-trip-generator-step1" element={<AiTripGeneratorStep1 />} />
        <Route path="/ai-trip-generator-step2" element={<AiTripGeneratorStep2 />} />
        <Route path="/create-trip" element={<CreateTrip />} />
        {/* Old standalone route (without subheader) can stay */}
        <Route path="/itinerary-editor" element={<ItineraryEditor />} />
        <Route path="/chatbot" element={<ChatbotPage />} />

        {/* Trip-based routes (with TripSubHeader inside each page) */}
        <Route path="/trip/:tripId/itinerary" element={<ItineraryEditor />} />
        <Route path="/trip/:tripId/notes" element={<NotesAndChecklistPage />} />
        <Route path="/trip/:tripId/budget" element={<BudgetPage />} />
        <Route path="/trip/:tripId/media" element={<MediaHighlights />} />
        <Route path="/trip/:tripId/recommendations" element={<ItineraryRecommendation />} />

        {/* PohYee */}
        <Route path="/landing-page" element={<LandingPage />} />
        <Route path="/signin" element={<LoginPage />} />
        <Route path="/login-page" element={<LoginPage />} />
        <Route path="/export-pdf" element={<ExportPDF />} />
        <Route path="/travel-guides-tutorial" element={<TravelGuidesTutorial />} />
        <Route path="/guest-faq" element={<GuestFAQPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />

        {/* KK */}
        <Route path="/discovery-local" element={<DiscoveryLocal />} />
        <Route path="/discovery-international" element={<DiscoveryInternational />} />
        <Route path="/discovery-faq" element={<DiscoveryFAQ />} />

        {/* Mingyu */}
        <Route path="/destination-faq-panel" element={<DestinationFaqPanel />} />
        <Route path="/local-info-panel" element={<LocalInformationPanel />} />
        <Route path="/group-wait-for-friends" element={<GroupWaitForFriends />} />
        <Route path="/group-itinerary-summary" element={<GroupItinerarySummary />} />
        <Route path="/itinerary-recommendation" element={<ItineraryRecommendation />} />
        <Route path="/media-highlights" element={<MediaHighlights />} />

        {/* Su */}
        <Route path="/notes-and-checklists" element={<NotesAndChecklistPage />} />
        <Route path="/budget" element={<BudgetPage />} />
      </Routes>
    </>
  );
}
