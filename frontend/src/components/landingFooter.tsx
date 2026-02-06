// src/components/landingFooter.tsx
import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import tripmateLogo from "../assets/tripmate_logo.png";

const LandingFooter: React.FC = () => {
  const navigate = useNavigate();

  return (
    <FooterSection>
      <FooterInner>
        <FooterLeft>
          <BrandRow>
            <BrandLogo src={tripmateLogo} alt="TripMate logo" />
          </BrandRow>
        </FooterLeft>

        <FooterDivider />

        <FooterRight>
          <FooterHeading>Stay Connected with Us</FooterHeading>
          <ContactLine>Email Us @ tripmatebyfyp25s428@gmail.com</ContactLine>
          <ContactLine>461 Clementi Rd, Singapore 599491</ContactLine>
          <LegalLinks>
            <LegalLink type="button" onClick={() => navigate("/privacy-terms#privacy")}>
              Privacy Policy & Terms of Use
            </LegalLink>
          </LegalLinks>
        </FooterRight>
      </FooterInner>
    </FooterSection>
  );
};

export default LandingFooter;

const FooterSection = styled.section`
  padding: 0.2rem 1.5rem;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
`;

const FooterInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.15fr auto 1fr;
  gap: 1.25rem;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    text-align: center;
  }
`;

const FooterLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;

  @media (max-width: 900px) {
    align-items: center;
  }
`;

const BrandRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  justify-content: center;
  width: 100%;
`;

const BrandLogo = styled.img`
  width: 320px;
  height: 320px;
  object-fit: contain;
`;

const FooterDivider = styled.div`
  width: 1px;
  height: 90px;
  background: #2f4f6f;
  opacity: 0.45;

  @media (max-width: 900px) {
    width: 100%;
    height: 1px;
  }
`;

const FooterRight = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  color: #1f2937;

  @media (max-width: 900px) {
    align-items: center;
  }
`;

const FooterHeading = styled.h3`
  margin: 0;
  font-size: 2.2rem;
  font-weight: 800;
  color: #2f1c14;
`;

const ContactLine = styled.p`
  margin: 0;
  font-size: 1.05rem;
  color: #2f1c14;
`;

const LegalLinks = styled.div`
  margin-top: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.9rem;
  font-size: 0.9rem;
  color: #7b6f6a;
`;

const LegalLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: 0.9rem;
  color: #3b5f7f;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;
