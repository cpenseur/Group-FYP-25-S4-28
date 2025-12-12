import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import LandingNavbar from "../components/landingNavbar";
import LandingFooter from "../components/landingFooter";
import {
  Bot,
  Users,
  User,
  Wrench,
  FileText,
  Search,
  SlidersHorizontal,
  Plus,
  X
} from "lucide-react";

export default function GuestFAQPage() {
  const navigate = useNavigate();
  useEffect(() => {
  window.scrollTo(0, 0);
  }, []);  
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchText, setSearchText] = useState("");

  const navLinks = [
    { name: 'Home', path: '/landing-page#hero' },
    { name: 'About Us', path: '/landing-page#about' },
    { name: 'Travel Guides', path: '/Demo' },
    { name: 'FAQ', path: '/guest-faq' },
  ];

  const categories = [
    { label: "All", icon: null },
    { label: "General", icon: <FileText size={16} color="#4a4a4a" /> },
    { label: "AI Features", icon: <Bot size={16} color="#4a4a4a" /> },
    { label: "Collaboration", icon: <Users size={16} color="#4a4a4a" /> },
    { label: "Account", icon: <User size={16} color="#4a4a4a" /> },
    { label: "Troubleshoot", icon: <Wrench size={16} color="#4a4a4a" /> }
  ];

  // UPDATED: Includes new Troubleshoot question (Option B)
  const faqs = [
    {
      category: "General",
      q: "How does the AI itinerary generator work?",
      a: "Enter your destination, dates, budget, and travel style. Our AI processes thousands of data points to generate a personalized day-by-day plan."
    },
    {
      category: "Collaboration",
      q: "Can I invite friends to plan the trip with me?",
      a: "Yes! You can invite friends, collaborate in real time, add ideas, and vote on suggested plans."
    },
    {
      category: "General",
      q: "How do I create my first itinerary?",
      a: "Just provide your destination and dates. TripMate instantly creates a smart starter itinerary for you."
    },
    {
      category: "Account",
      q: "Is TripMate free to use?",
      a: "TripMate is free for basic features. Premium features offer enhanced recommendations and AI tools."
    },
    {
      category: "AI Features",
      q: "How do I use the AI-powered itinerary builder?",
      a: "Describe your trip goals and preferences. The AI will generate optimized routes based on travel time, opening hours, and popularity."
    },
    {
      category: "Troubleshoot",
      q: "I encountered an error. How can I reach the support team?",
      a: "You can report any errors by scrolling to the footer and selecting Support → Report an issue. This will notify our admin team, who will assist you promptly."
    }
  ];

  // FILTERING LOGIC FOR CATEGORY + SEARCH
  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory =
      activeCategory === "All" || faq.category === activeCategory;

    const matchesSearch =
      faq.q.toLowerCase().includes(searchText.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchText.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <Container>
      {/* Navigation Bar */}
      <LandingNavbar navLinks={navLinks} />

      {/* Main Content */}
      <ContentWrapper>
        {/* TITLE */}
        <h1 className="title">
          Frequently Asked Questions
        </h1>

        <p className="subtitle">
          Everything you need to know about your personal travel assistant
        </p>

        {/* CATEGORY TABS */}
        <CategoryContainer>
          {categories.map((c) => {
            const active = c.label === activeCategory;

            return (
              <CategoryButton
                key={c.label}
                active={active}
                onClick={() => setActiveCategory(c.label)}
              >
                {c.icon}
                {c.label}
              </CategoryButton>
            );
          })}
        </CategoryContainer>

        {/* SEARCH BAR */}
        <SearchBar>
          <Search size={18} color="#6F6F6F" />
          
          <SearchInput
            type="text"
            placeholder="Search for your questions ..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          
        </SearchBar>

        {/* FAQ CONTAINER */}
        <FAQContainer>
          {filteredFaqs.length === 0 && (
            <NoResults>
              No results found.
            </NoResults>
          )}

          {filteredFaqs.map((faq, i) => {
            const realIndex = faqs.indexOf(faq); // use original index
            const open = openIndex === realIndex;

            return (
              <FAQItem key={realIndex}>
                {/* FAQ HEADER */}
                <FAQHeader onClick={() => setOpenIndex(open ? null : realIndex)}>
                  <FAQNumberWrapper>
                    <FAQNumber>
                      {String(realIndex + 1).padStart(2, "0")}
                    </FAQNumber>
                    <FAQQuestion>
                      {faq.q}
                    </FAQQuestion>
                  </FAQNumberWrapper>

                  {/* Expand/Collapse Button */}
                  <ExpandButton open={open}>
                    {open ? (
                      <X size={16} color="white" />
                    ) : (
                      <Plus size={16} color="#333" />
                    )}
                  </ExpandButton>
                </FAQHeader>

                {/* FAQ ANSWER */}
                {open && (
                  <FAQAnswer>
                    <FAQAnswerText>
                      {faq.a}
                    </FAQAnswerText>
                  </FAQAnswer>
                )}
              </FAQItem>
            );
          })}
        </FAQContainer>
      </ContentWrapper>

      {/* Footer */}
      <LandingFooter />
    </Container>
  );
}

// Styled Components
const Container = styled.div`
  min-height: 100vh;
  background: #ffffff;
  color: #1f2937;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const ContentWrapper = styled.div`
  width: 90%;
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 0 4rem;

  .title {
    text-align: center;
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    text-align: center;
    font-size: 15px;
    color: #6F6F6F;
    margin-bottom: 2rem;
  }
`;

const CategoryContainer = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const CategoryButton = styled.button<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: ${props => props.active ? 600 : 500};
  border: ${props => props.active ? "2px solid #111" : "1px solid #DADADA"};
  background: ${props => props.active ? "#f4f4f4" : "white"};
  color: #333;
  transition: all 0.2s;

  &:hover {
    background: #f8f8f8;
  }
`;

const SearchBar = styled.div`
  border: 1px solid #DADADA;
  padding: 0.7rem 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 2rem;
  background: white;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  color: #333;
  background: transparent;

  &::placeholder {
    color: #9ca3af;
  }
`;

const FAQContainer = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #DADADA;
  overflow: hidden;
`;

const NoResults = styled.p`
  padding: 2rem;
  text-align: center;
  font-size: 15px;
  color: #777;
`;

const FAQItem = styled.div`
  border-bottom: 1px solid #EAEAEA;

  &:last-child {
    border-bottom: none;
  }
`;

const FAQHeader = styled.div`
  padding: 1.5rem 1.8rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f9fafb;
  }
`;

const FAQNumberWrapper = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const FAQNumber = styled.span`
  font-size: 28px;
  font-weight: 700;
  width: 45px;
  color: #111;
`;

const FAQQuestion = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: #111;
  flex: 1;
`;

const ExpandButton = styled.div<{ open: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: ${props => props.open ? "#111" : "#f4f4f4"};
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.2s;
`;

const FAQAnswer = styled.div`
  background: #F4F4F4;
  padding: 1rem 3.5rem 1.5rem;
  animation: fadeIn 0.3s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const FAQAnswerText = styled.p`
  font-size: 14px;
  color: #6F6F6F;
  line-height: 1.6;
  max-width: 750px;
  margin: 0;
`;