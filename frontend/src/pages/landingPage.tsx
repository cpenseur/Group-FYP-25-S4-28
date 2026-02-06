// frontend/src/pages/landing/LandingPage.tsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import hallstatt from "../assets/hallstatt.png";
import Cappadocia from "../assets/Cappadocia.jpg";
import Yosemite from "../assets/Yosemite.jpg";
import mbs from "../assets/mbs.jpg";
import sentosa from "../assets/sentosa.jpg";
import gbtb from "../assets/gbtb.jpg";
import beijing from "../assets/beijing.jpg";
import shanghai from "../assets/shanghai.jpg";
import guilin from "../assets/guilin.jpg";
import tokyo from "../assets/tokyo.jpg";
import kyoto from "../assets/kyoto.jpg";
import osaka from "../assets/osaka.png";
import demoVideo from "../assets/demo.MP4";
import LandingNavbar from "../components/landingNavbar";
import LandingFooter from "../components/landingFooter";
import Login from "../components/login";

import { 
  Star, 
  MapPin, 
  ChevronRight,
  Mail,
  Check,
  Search,
  Compass,
  Wallet,
  Camera,
  BookOpen,
  Bot,
  Users,
  CloudSun,
  UsersRound
} from "lucide-react";

import guidesData from "../data/guides.json";

type LandingPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
};

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSignupClick, }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const imageMap: Record<string, string> = {
    "mbs.jpg": mbs,
    "sentosa.jpg": sentosa,
    "gbtb.jpg": gbtb,
    "beijing.jpg": beijing,
    "shanghai.jpg": shanghai,
    "guilin.jpg": guilin,
    "tokyo.jpg": tokyo,
    "kyoto.jpg": kyoto,
    "osaka.png": osaka,
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    setEmail('');
    
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  const features = [
    {
      icon: <Search size={24} />,
      title: "AI Trip Finder",
      description: "Get personalized destination suggestions based on your interests"
    },
    {
      icon: <Compass size={24} />,
      title: "Smart Itineraries",
      description: "Automatically optimized daily schedules with travel times"
    },
    {
      icon: <Wallet size={24} />,
      title: "Budget Tracker",
      description: "Track expenses and split costs with travel companions"
    },
    {
      icon: <Camera size={24} />,
      title: "Memory Book",
      description: "Collect photos and memories in one beautiful timeline"
    }
  ];

  const testimonials = [
    {
      name: "Alex Johnson",
      location: "Bali, Indonesia",
      text: "TripMate made our group trip planning seamless. The budget tracking saved us hundreds!",
      rating: 5,
      avatar: "AJ"
    },
    {
      name: "Maria Chen",
      location: "Tokyo, Japan",
      text: "The AI suggestions helped us discover hidden gems we would have missed otherwise.",
      rating: 5,
      avatar: "MC"
    },
    {
      name: "David Park",
      location: "Paris, France",
      text: "Collaborative features made planning our honeymoon a shared joy instead of a chore.",
      rating: 5,
      avatar: "DP"
    }
  ];

  const insights = [
    {
      title: "Best Time to Visit Japan",
      description: "Cherry Blossom Season Guide and optimal travel months",
      icon: "🌸"
    },
    {
      title: "Budget Travel Hacks",
      description: "Smart ways to save on accommodation and transport",
      icon: "💰"
    },
    {
      title: "Sustainable Travel",
      description: "How to reduce your carbon footprint while exploring",
      icon: "🌿"
    },
    {
      title: "Local Cuisine Guide",
      description: "Must-try foods in Italy, Thailand, and Mexico",
      icon: "🍝"
    }
  ];

  const navLinks = [
    { name: 'Home', path: '/landing-page#hero' },
    { name: 'About Us', path: '/landing-page#about' },
    { name: 'Travel Guides', path: '/Demo' },
    { name: 'FAQ', path: '/guest-faq' },
  ];

  const guides = useMemo(
    () => (guidesData as any[]).map((g) => ({ ...g, image: imageMap[g.image as string] })),
    []
  );

  const mixedGuides = useMemo(() => {
    const pickOrder = ["Singapore", "Japan", "China"];
    const used = new Set<number>();
    const result: any[] = [];

    for (const region of pickOrder) {
      const found = guides.find((g) => g.region === region);
      if (found && !used.has(found.id)) {
        used.add(found.id);
        result.push(found);
      }
    }

    for (const g of guides) {
      if (result.length >= 4) break;
      if (!used.has(g.id)) {
        used.add(g.id);
        result.push(g);
      }
    }

    return result.slice(0, 4);
  }, [guides]);

  return (
    <Container>
      {/* Navigation Bar - Using Component */}
      <LandingNavbar navLinks={navLinks} onLoginClick={onLoginClick} onSignupClick={onSignupClick}/>

      {/* Hero Section */}
      <HeroSection id="hero" style={{ scrollMarginTop: '80px' }}>
        <HeroContent>
          <HeroTitle>Your Personal Travel Assistant</HeroTitle>

          <VideoCard>
            <HeroVideo controls playsInline muted autoPlay loop>
              <source src={demoVideo} type="video/mp4" />
              Your browser does not support the video tag.
            </HeroVideo>
          </VideoCard>

          <HeroSubtitle>
            Create, organise, and optimise your adventures with AI-powered planning, 
            interactive maps, group collaboration, budget splitting, live weather adjustments, 
            reservation syncing, and auto-generated trip highlight videos.
          </HeroSubtitle>

          <CTAGroup>
            <PrimaryButton onClick= {onSignupClick}>
              Get Started
            </PrimaryButton>

            <SecondaryButton onClick={() => navigate('/Demo')}>
              Try Demo
            </SecondaryButton>
          </CTAGroup>
        </HeroContent>
      </HeroSection>

      {/* About Us */}
      <Section id="about" style={{ scrollMarginTop: '20px' }}>
        <AboutHeader>
          <AboutSubtitle>
            <BookOpen size={18} />
            A LITTLE BIT ABOUT US
          </AboutSubtitle>

          <AboutTitle>Why We Built TripMate</AboutTitle>

          <AboutDescription>
            Travel planning should be joyful, not stressful. TripMate combines cutting-edge AI 
            with intuitive design to help you create perfect itineraries, collaborate with friends, 
            and preserve precious memories.
          </AboutDescription>
        </AboutHeader>

        <AboutGrid>
          {features.map((feature, index) => (
            <AboutCard key={index}>
              <IconWrapper>{feature.icon}</IconWrapper>

              <CardTitle>{feature.title}</CardTitle>

              <CardText>{feature.description}</CardText>

              {/* Blue highlight bar */}
              <HighlightBar />
            </AboutCard>
          ))}
        </AboutGrid>
      </Section>

      {/* Why Choose TripMate */}
      <Section light>
        <SectionHeader>
          <SectionTitle>Why choose TripMate?</SectionTitle>
          <SectionDescription>
            Everything you need for stress-free travel planning in one beautiful platform
          </SectionDescription>
        </SectionHeader>
        
        <BenefitsGrid>
          <FlipCard>
            <FlipInner>
              <FlipFront>
                <BenefitIcon><Bot /></BenefitIcon>
                <FlipTitle>AI-powered itinerary suggestions</FlipTitle>
              </FlipFront>
              <FlipBack>
                <FlipBackText>Automatically create smart day-by-day plans tailored to your preferences.</FlipBackText>
              </FlipBack>
            </FlipInner>
          </FlipCard>

          <FlipCard>
            <FlipInner>
              <FlipFront>
                <BenefitIcon><Users/></BenefitIcon>
                <FlipTitle>Real-time collaboration</FlipTitle>
              </FlipFront>
              <FlipBack>
                <FlipBackText>Plan together instantly with shared editing and synced trip updates.</FlipBackText>
              </FlipBack>
            </FlipInner>
          </FlipCard>

          <FlipCard>
            <FlipInner>
              <FlipFront>
                <BenefitIcon><Wallet/></BenefitIcon>
                <FlipTitle>Budget tracking & expense splitting</FlipTitle>
              </FlipFront>
              <FlipBack>
                <FlipBackText>Auto-split expenses, track spending, and avoid money confusion.</FlipBackText>
              </FlipBack>
            </FlipInner>
          </FlipCard>

          <FlipCard>
            <FlipInner>
              <FlipFront>
                <BenefitIcon><CloudSun/></BenefitIcon>
                <FlipTitle>Adaptive Planner</FlipTitle>
              </FlipFront>
              <FlipBack>
                <FlipBackText>Automatically adjusts your itinerary based on weather forecasts and venue opening times.</FlipBackText>
              </FlipBack>
            </FlipInner>
          </FlipCard>

          <FlipCard>
            <FlipInner>
              <FlipFront>
                <BenefitIcon><MapPin size={20} /></BenefitIcon>
                <FlipTitle>Destination insights & local tips</FlipTitle>
              </FlipFront>
              <FlipBack>
                <FlipBackText>Get curated recommendations from real travelers and locals.</FlipBackText>
              </FlipBack>
            </FlipInner>
          </FlipCard>

          <FlipCard>
            <FlipInner>
              <FlipFront>
                <BenefitIcon><UsersRound /></BenefitIcon>
                <FlipTitle>Group Itinerary AI Generation</FlipTitle>
              </FlipFront>
              <FlipBack>
                <FlipBackText>Merge everyone's preferences into one optimized group itinerary powered by AI.</FlipBackText>
              </FlipBack>
            </FlipInner>
          </FlipCard>
        </BenefitsGrid>
      </Section>

      {/* Demo Trips Carousel */}
      <ShowcaseSection>
        <ShowcaseText>
          <ShowcaseTitle>View Trips shared by our fellow users</ShowcaseTitle>

          <ShowcaseParagraph>
            Immerse yourself in a world of wanderlust as you embark on a journey to the 
            most coveted destinations, carefully curated by fellow travelers who've 
            experienced the magic firsthand. These top-rated trips are more than just 
            vacations. They're gateways to extraordinary experiences that leave an 
            indelible mark on your soul.
          </ShowcaseParagraph>

          <ShowcaseParagraph>
            From breathtaking landscapes to culturally rich cities, each destination 
            offers a tapestry of sights, sounds, and sensations waiting to be explored. 
            Our collection isn't just about ticking off landmarks; it's about creating 
            moments that resonate long after the journey ends.
          </ShowcaseParagraph>
        </ShowcaseText>

        <ShowcaseCards>
          <TripCardTilt rotate={-6} top="20px" left="0">
            <img src={hallstatt} alt="Hallstatt" />
          </TripCardTilt>

          <TripCardTilt rotate={2} top="0" left="90px">
            <img src={Cappadocia} alt="Cappadocia" />
          </TripCardTilt>

          <TripCardTilt rotate={8} top="40px" left="180px">
            <img src={Yosemite} alt="Yosemite" />
          </TripCardTilt>
        </ShowcaseCards>
      </ShowcaseSection>

      {/* Travel Insights - Demo Trips */}
      <Section light>
        <SectionHeader>
          <SectionSubtitle>TRAVEL INTELLIGENCE</SectionSubtitle>
          <SectionTitle>Insights for the Inquisitive Traveller</SectionTitle>
          <SectionDescription>
            Explore curated travel guides and itineraries
          </SectionDescription>
        </SectionHeader>
        
        <InsightsGrid>
          {mixedGuides.map((guide) => (
            <InsightCard key={guide.id} onClick={() => navigate(`/travel-guides/${guide.id}`)}>
              {guide.image ? (
                <InsightThumbnail src={guide.image} alt={guide.title} />
              ) : (
                <InsightIcon>MAP</InsightIcon>
              )}
              <InsightContent>
                <InsightTitle>{guide.title}</InsightTitle>
                <InsightDescription>
                  {guide.location} - {guide.days}
                </InsightDescription>
                <ReadMore>
                  View Itinerary <ChevronRight size={14} />
                </ReadMore>
              </InsightContent>
            </InsightCard>
          ))}
        </InsightsGrid>
      </Section>

      {/* Footer CTA - Using Component */}
      <LandingFooter />
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  min-height: 100vh;
  background: #ffffff;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
`;

// Hero Section Styles
const HeroSection = styled.section`
  position: relative;
  width: 100%;
  min-height: 90vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 6rem 2rem 5rem;
  text-align: center;
  background: #f8fafc;
`;

const HeroContent = styled.div`
  max-width: 960px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
`;

const HeroTitle = styled.h1`
  font-size: 4rem;
  font-weight: 800;
  margin: 0;
  line-height: 1.1;
  color: #0f172a;

  @media (max-width: 768px) {
    font-size: 2.8rem;
  }
`;

const HeroSubtitle = styled.p`
  font-size: 1.25rem;
  margin: 0;
  line-height: 1.6;
  color: #475569;

  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const VideoCard = styled.div`
  width: min(980px, 100%);
  border-radius: 18px;
  overflow: hidden;
  background: #0f172a;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
`;

const HeroVideo = styled.video`
  width: 100%;
  height: auto;
  display: block;
  background: #0f172a;
`;

const VideoDivider = styled.div`
  width: min(760px, 100%);
  height: 1px;
  background: linear-gradient(90deg, transparent, #cbd5f5, transparent);
  margin-top: 0.5rem;
`;

const CTAGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 0.5rem;

  @media (max-width: 640px) {
    flex-direction: column;
    width: 100%;
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-family: inherit;
`;

const PrimaryButton = styled(Button)<{ large?: boolean }>`
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  padding: ${props => props.large ? '1rem 2.5rem' : '0.875rem 2rem'};
  font-size: ${props => props.large ? '1.1rem' : '1rem'};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
  }
`;

const SecondaryButton = styled(Button)`
  background: linear-gradient(135deg, #2dd4bf, #0ea5e9);
  color: #ffffff;
  border: none;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(14, 165, 233, 0.3);
  }
`;

const AboutHeader = styled.div`
  text-align: center;
  max-width: 800px;
  margin: 0 auto 4rem;
`;

const AboutSubtitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: #6c7bd9;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  gap: 0.5rem;
`;

const AboutTitle = styled.h2`
  font-size: 2.6rem;
  font-weight: 800;
  color: #1f2937;
  margin-top: 0.5rem;
`;

const AboutDescription = styled.p`
  font-size: 1.1rem;
  color: #4b5563;
  margin-top: 1rem;
  line-height: 1.6;
`;

const AboutGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const AboutCard = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  position: relative;
  box-shadow: 0 8px 25px rgba(0,0,0,0.06);
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-4px);
  }
`;

const IconWrapper = styled.div`
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: #e8f0ff;
  color: #3b82f6;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 1rem;

  svg {
    width: 32px;
    height: 32px;
  }
`;

const CardTitle = styled.h3`
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
`;

const CardText = styled.p`
  color: #6b7280;
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

const DiscoverMore = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: #3b82f6;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const HighlightBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 60%;
  height: 4px;
  background: #3b82f6;
  border-radius: 0 0 4px 4px;
  margin: 0 auto;
  right: 0;
`;

const Section = styled.section<{ light?: boolean }>`
  padding: 5rem 2rem;
  background: ${props => props.light ? '#f9fafb' : 'transparent'};
`;

const SectionHeader = styled.div`
  text-align: center;
  max-width: 800px;
  margin: 0 auto 4rem;
`;

const SectionTitle = styled.h2`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #111827;

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const SectionSubtitle = styled.div`
  font-size: 0.875rem;
  color: #3b82f6;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const SectionDescription = styled.p`
  font-size: 1.125rem;
  color: #6b7280;
  line-height: 1.6;
  margin-top: 1rem;
`;

const BenefitsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2.5rem;
  max-width: 1000px;
  margin: 0 auto;
`;

const BenefitIcon = styled.div`
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #e8f0ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  svg {
    color: #3b82f6;
    width: 35px;
    height: 35px;
  }
`;

const FlipCard = styled.div`
  background: transparent;
  width: 100%;
  height: 260px;
  perspective: 1000px;
  overflow: hidden;
  border-radius: 20px;
`;

const FlipInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s ease;
  transform-style: preserve-3d;

  ${FlipCard}:hover & {
    transform: rotateY(180deg);
  }
`;

const FlipFront = styled.div`
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const FlipBack = styled.div`
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  transform: rotateY(180deg);
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const FlipBackText = styled.p`
  font-size: 1rem;
  line-height: 1.5;
  max-width: 250px;
`;

const FlipTitle = styled.h3`
  font-size: 1.15rem;
  font-weight: 600;
  color: #111827;
  text-align: center;
  margin: 0;
`;

const ShowcaseSection = styled.section`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 4rem;
  padding: 5rem 2rem;
  max-width: 1300px;
  margin: 0 auto;

  @media (max-width: 980px) {
    flex-direction: column;
    text-align: center;
  }
`;

const ShowcaseText = styled.div`
  flex: 1;
  max-width: 550px;
`;

const ShowcaseTitle = styled.h2`
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
`;

const ShowcaseParagraph = styled.p`
  color: #374151;
  line-height: 1.7;
  font-size: 1.05rem;
  margin-bottom: 1.2rem;
`;

const ShowcaseCards = styled.div`
  position: relative;
  width: 420px;
  height: 480px;

  @media (max-width: 980px) {
    margin: 0 auto;
  }
`;

const TripCardTilt = styled.div<{ rotate: number; top: string; left: string }>`
  position: absolute;
  top: ${(p) => p.top};
  left: ${(p) => p.left};
  width: 260px;
  height: 380px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 30px rgba(0,0,0,0.12);
  transform: rotate(${(p) => p.rotate}deg);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    border-radius: 20px;    
  }
`;

const TripCardLabel = styled.div`
  padding: 1rem;
  font-weight: 600;
  color: #111827;
`;

const TripBadge = styled.div`
  background: #ffe9c2;
  color: #d97706;
  font-weight: 600;
  border-radius: 10px;
  padding: 4px 10px;
  font-size: 0.85rem;
  width: fit-content;
  margin: 0.5rem 1rem;
`;

const TripButton = styled.button`
  background: #f59e0b;
  color: white;
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  border: none;
  font-size: 0.75rem;
  margin-left: 1rem;
  cursor: pointer;

  &:hover {
    background: #d97706;
  }
`;

const TestimonialsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1000px;
  margin: 0 auto;
`;

const TestimonialCard = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #e5e7eb;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }
`;

const Rating = styled.div`
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
`;

const TestimonialText = styled.p`
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  font-style: italic;
  font-size: 1rem;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: white;
`;

const UserDetails = styled.div``;

const UserName = styled.div`
  font-weight: 600;
  color: #111827;
`;

const UserLocation = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #6b7280;
`;

const InsightsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const InsightCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  display: flex;
  gap: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #e5e7eb;
  cursor: pointer;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }
`;

const InsightIcon = styled.div`
  font-size: 2rem;
  flex-shrink: 0;
`;

const InsightThumbnail = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
`;

const LoadingText = styled.p`
  text-align: center;
  color: #6b7280;
  font-size: 1rem;
  grid-column: 1 / -1;
`;

const InsightContent = styled.div`
  flex: 1;
`;

const InsightTitle = styled.h4`
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #111827;
`;

const InsightDescription = styled.p`
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  line-height: 1.5;
`;

const ReadMore = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #3b82f6;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;


const NewsletterSection = styled.section`
  padding: 5rem 2rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
`;

const NewsletterContent = styled.div`
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
`;

const NewsletterFormContainer = styled.div`
  margin: 2rem auto 0;
`;

const NewsletterForm = styled.form`
  display: flex;
  gap: 1rem;

  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const InputWrapper = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const NewsletterInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: #111827;
  font-size: 1rem;
  outline: none;

  &::placeholder {
    color: #9ca3af;
  }
`;

const NewsletterSubmitButton = styled.button`
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border: none;
  padding: 0 2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SuccessMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: #d1fae5;
  color: #059669;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #10b981;
`;

const PrivacyNote = styled.p`
  text-align: center;
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 1rem;
`;

export default LandingPage;
