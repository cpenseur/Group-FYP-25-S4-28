import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import LandingNavbar from "../components/landingNavbar";
import LandingFooter from "../components/landingFooter";
import { supabase } from "../lib/supabaseClient";
import {
  Bot,
  Users,
  User,
  Wrench,
  FileText,
  Search,
  SlidersHorizontal,
  Plus,
  X,
  Loader2
} from "lucide-react";

// Define FAQ type
interface FAQ {
  id: number;
  category: string;
  question: string;
  answer: string;
  display_order: number;
}

interface GuestFAQPageProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
}

export default function GuestFAQPage({ onLoginClick, onSignupClick }: GuestFAQPageProps) {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchText, setSearchText] = useState("");

  // Fetch FAQs from Supabase
  useEffect(() => {
    window.scrollTo(0, 0);
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;

      setFaqs(data || []);
      // Open the first FAQ by default if there are any
      if (data && data.length > 0) {
        setOpenIndex(data[0].id);
      }
    } catch (err: any) {
      console.error("Error fetching FAQs:", err);
      setError("Failed to load FAQs. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

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

  // FILTERING LOGIC FOR CATEGORY + SEARCH
  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory =
      activeCategory === "All" || faq.category === activeCategory;

    const matchesSearch =
      faq.question.toLowerCase().includes(searchText.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchText.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <Container>
      {/* Navigation Bar */}
      <LandingNavbar navLinks={navLinks} onLoginClick={onLoginClick} onSignupClick={onSignupClick} />

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
          {loading && (
            <LoadingWrapper>
              <Loader2 size={24} className="spinner" />
              <span>Loading FAQs...</span>
            </LoadingWrapper>
          )}

          {error && (
            <ErrorMessage>{error}</ErrorMessage>
          )}

          {!loading && !error && filteredFaqs.length === 0 && (
            <NoResults>
              No results found.
            </NoResults>
          )}

          {!loading && !error && filteredFaqs.map((faq, i) => {
            const open = openIndex === faq.id;

            return (
              <FAQItem key={faq.id}>
                {/* FAQ HEADER */}
                <FAQHeader onClick={() => setOpenIndex(open ? null : faq.id)}>
                  <FAQNumberWrapper>
                    <FAQNumber>
                      {String(i + 1).padStart(2, "0")}
                    </FAQNumber>
                    <FAQQuestion>
                      {faq.question}
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
                      {faq.answer}
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

const LoadingWrapper = styled.div`
  padding: 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #666;
  font-size: 15px;

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const ErrorMessage = styled.p`
  padding: 2rem;
  text-align: center;
  font-size: 15px;
  color: #dc2626;
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