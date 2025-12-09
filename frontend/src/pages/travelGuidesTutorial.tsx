import LandingNavbar from "../components/landingNavbar";
import LandingFooter from "../components/landingFooter";

export default function TravelGuidesTutorial() {
  const navLinks = [
    { name: 'Home', path: '/landing-page#hero' },
    { name: 'About Us', path: '/landing-page#about' },
    { name: 'Travel Guides', path: '/travel-guides-tutorial' },
    { name: 'FAQ', path: '/guest-faq' },
  ];  
  
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar navLinks={navLinks} />
      <div style={{ 
        flex: 1, 
        padding: '2rem', 
        maxWidth: '1200px', 
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <h1>Travel Guides Tutorial</h1>
        <p>F7.2 – onboarding / how-to-use tutorial placeholder.</p>
      </div>
      <LandingFooter />
    </div>
  );
}