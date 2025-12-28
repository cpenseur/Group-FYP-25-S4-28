// src/components/landingFooter.tsx
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Login from "../components/login";

const LandingFooter: React.FC = () => {
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <FooterSection>
      <FooterTitle>Ready to Transform Your Travel Planning?</FooterTitle>

      <FooterSubtitle>
        Join thousands of travelers already using TripMate to create unforgettable journeys.
      </FooterSubtitle>

      <CTAWrapper>
        <CTAButton onClick={() => setShowLogin(true)}>Get Started Free</CTAButton>
      </CTAWrapper>
      <Login
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
      />
      <FooterNote>No credit card required • Free forever plan • Cancel anytime</FooterNote>
    </FooterSection>
  );
};

export default LandingFooter;

const FooterSection = styled.section`
  padding: 5rem 2rem;
  text-align: center;
  background: #111827;
  color: white;
`;

const FooterTitle = styled.h2`
  font-size: 2.5rem;
  font-weight: 700;
`;

const FooterSubtitle = styled.p`
  font-size: 1.1rem;
  color: #d1d5db;
  max-width: 600px;
  margin: 1rem auto 2rem;
`;

const CTAWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin: 2rem 0;
`;

const CTAButton = styled.button`
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 1rem 2.5rem;
  font-size: 1.15rem;
  color: white;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  cursor: pointer;
`;

const FooterNote = styled.p`
  margin-top: 2rem;
  color: #9ca3af;
  font-size: 0.9rem;
`;