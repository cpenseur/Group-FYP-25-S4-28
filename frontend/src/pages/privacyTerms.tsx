// frontend/src/pages/privacyTerms.tsx
import React, { useEffect } from "react";
import styled from "styled-components";
import { useLocation } from "react-router-dom";
import LandingNavbar from "../components/landingNavbar";

type PrivacyTermsProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
};

const PrivacyTerms: React.FC<PrivacyTermsProps> = ({ onLoginClick, onSignupClick }) => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace("#", "");
    const element = document.getElementById(id);
    if (!element) return;
    setTimeout(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [location.hash]);

  const navLinks = [
    { name: "Home", path: "/landing-page#hero" },
    { name: "About Us", path: "/landing-page#about" },
    { name: "Travel Guides", path: "/Demo" },
    { name: "FAQ", path: "/guest-faq" },
  ];

  return (
    <Page>
      <LandingNavbar
        navLinks={navLinks}
        onLoginClick={onLoginClick}
        onSignupClick={onSignupClick}
      />

      <Content>
        <PageHeader>
          <HeaderTitle>Privacy Policy & Terms of Use</HeaderTitle>
          <HeaderSubtitle>
            Clear, plain-language summaries so you know how your data is handled.
          </HeaderSubtitle>
        </PageHeader>

        <CardsGrid>
          <PolicyCard id="privacy">
            <CardTitle>Privacy Policy</CardTitle>
            <CardMeta>Last updated: February 5, 2026</CardMeta>
            <CardList>
              <li>Data we collect: account details, trip preferences, and usage analytics.</li>
              <li>How we use it: to personalize itineraries, collaborate, and improve features.</li>
              <li>Sharing: only with trusted service providers for hosting and security.</li>
              <li>Security: encryption in transit and at rest, access controls, and audit logging.</li>
              <li>Your controls: access, update, export, or delete your data from settings.</li>
              <li>Retention: data is kept only as long as needed for your account or legal needs.</li>
            </CardList>
          </PolicyCard>

          <PolicyCard id="terms">
            <CardTitle>Terms of Use</CardTitle>
            <CardMeta>Last updated: February 5, 2026</CardMeta>
            <CardList>
              <li>Account responsibility: keep credentials secure and report misuse.</li>
              <li>Acceptable use: no illegal activity, harassment, or access to others' data.</li>
              <li>User content: you keep ownership; you grant us a license to display it in the app.</li>
              <li>Service changes: features may evolve as we improve TripMate.</li>
              <li>Termination: we may suspend accounts for violations; you can close yours anytime.</li>
            </CardList>
            <CardNote>
              Questions about these terms? Reach out to tripmatebyfyp25s428@gmail.com
            </CardNote>
          </PolicyCard>
        </CardsGrid>
      </Content>
    </Page>
  );
};

export default PrivacyTerms;

const Page = styled.div`
  min-height: 100vh;
  background: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
    sans-serif;
`;

const Content = styled.section`
  max-width: 1200px;
  margin: 0 auto;
  padding: 3.5rem 2rem 5rem;
`;

const PageHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 2.5rem;
  text-align: center;
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: 2.5rem;
  font-weight: 700;
  color: #111827;
`;

const HeaderSubtitle = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 1.125rem;
`;

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
`;

const PolicyCard = styled.article`
  background: #ffffff;
  border-radius: 16px;
  padding: 2rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  scroll-margin-top: 110px;
`;

const CardTitle = styled.h2`
  margin: 0 0 0.35rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
`;

const CardMeta = styled.p`
  margin: 0 0 1rem;
  color: #6b7280;
  font-size: 0.9rem;
`;

const CardList = styled.ul`
  margin: 0;
  padding-left: 1.2rem;
  color: #374151;
  line-height: 1.6;

  li + li {
    margin-top: 0.55rem;
  }
`;

const CardNote = styled.p`
  margin-top: 1.2rem;
  color: #6b7280;
  font-size: 0.95rem;
`;
