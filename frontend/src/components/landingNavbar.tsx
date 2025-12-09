// src/components/landingNavbar.tsx
import React, { useState, useEffect } from "react";
import styled from "styled-components";
import logo from "../assets/logo.png";
import { Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface NavbarProps {
  navLinks: { name: string; path: string }[];
}

const LandingNavbar: React.FC<NavbarProps> = ({ navLinks }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState("");

  // Update current hash when location changes
  useEffect(() => {
    setCurrentHash(location.hash);
  }, [location]);

  // Function to check if a link is active
  const isLinkActive = (path: string) => {
    if (path.includes('#')) {
      // This is a hash link (e.g., /landing-page#about)
      const [basePath, hash] = path.split('#');
      
      // Check if we're on the correct page
      const isCorrectPage = location.pathname === basePath || 
        (location.pathname === '/' && basePath === '/landing-page');
      
      if (!isCorrectPage) return false;
      
      // For "home" link with #hero, active when no hash or #hero
      if (hash === "hero") {
        return !currentHash || currentHash === "#hero";
      }
      
      // For other hash links, only active if hash matches
      return currentHash === `#${hash}`;
    } else {
      // Regular page navigation check
      return location.pathname === path;
    }
  };

  // Function to handle navigation with hash support
  const handleNavigation = (path: string) => {
    if (path.includes('#')) {
      const [basePath, hash] = path.split('#');
      
      if (location.pathname === basePath || 
          (location.pathname === '/' && basePath === '/landing-page')) {
        // If we're already on the correct page, scroll to section
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          // Update URL hash without reload
          window.history.pushState(null, '', `#${hash}`);
          setCurrentHash(`#${hash}`);
        }
      } else {
        // Navigate to the page first, then scroll to section
        navigate(basePath);
        // Wait for page to load, then scroll
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setCurrentHash(`#${hash}`);
          }
        }, 100);
      }
    } else {
      // Regular page navigation
      navigate(path);
    }
    setIsMenuOpen(false);
  };

  // Handle logo click - go to landing page and scroll to top
  const handleLogoClick = () => {
    if (location.pathname === '/landing-page' || location.pathname === '/') {
      // If already on landing page, scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Clear hash from URL
      window.history.pushState(null, '', '/landing-page');
      setCurrentHash('');
    } else {
      // Navigate to landing page
      navigate('/landing-page');
    }
  };

  return (
    <Navbar>
      <NavContainer>
        <LogoWrapper onClick={handleLogoClick}>
          <Logo src={logo} alt="TripMate Logo" />
        </LogoWrapper>

        <DesktopNav>
          {navLinks.map((link) => (
            <NavLink 
              key={link.name} 
              onClick={() => handleNavigation(link.path)}
              active={isLinkActive(link.path)}
            >
              {link.name}
            </NavLink>
          ))}
        </DesktopNav>

        <AuthButtons>
          <LoginButton onClick={() => navigate("/signin")}>Log In</LoginButton>
          <SignUpButton onClick={() => navigate("/signin")}>Sign Up Now</SignUpButton>
        </AuthButtons>

        <MobileMenuButton onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </MobileMenuButton>
      </NavContainer>

      {isMenuOpen && (
        <MobileMenu>
          {navLinks.map((link) => (
            <MobileNavLink
              key={link.name}
              onClick={() => handleNavigation(link.path)}
              active={isLinkActive(link.path)}
            >
              {link.name}
            </MobileNavLink>
          ))}

          <MobileAuthButtons>
            <LoginButton onClick={() => navigate("/signin")}>Log In</LoginButton>
            <SignUpButton onClick={() => navigate("/signin")}>Sign Up Now</SignUpButton>
          </MobileAuthButtons>
        </MobileMenu>
      )}
    </Navbar>
  );
};

export default LandingNavbar;

/* ============================
      Styled Components
============================= */

const Navbar = styled.nav`
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e5e7eb;
  z-index: 1000;
  padding: 1rem 0;
`;

const NavContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  
  @media (max-width: 768px) {
    padding: 0 1rem;
  }
`;

const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.8;
  }
`;

const Logo = styled.img`
  height: 50px;
  width: auto;
  
  @media (max-width: 768px) {
    height: 40px;
  }
`;

const DesktopNav = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const NavLink = styled.div<{ active?: boolean }>`
  color: ${props => props.active ? "#3b82f6" : "#4b5563"};
  font-weight: ${props => props.active ? "600" : "500"};
  cursor: pointer;
  transition: all 0.2s;
  padding: 0.5rem 0;
  position: relative;
  white-space: nowrap;
  
  &:hover {
    color: #3b82f6;
  }
  
  &::after {
    content: '';
    display: block;
    width: ${props => props.active ? "100%" : "0"};
    height: 2px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    transition: width 0.3s ease;
    position: absolute;
    bottom: -2px;
    left: 0;
    border-radius: 1px;
  }
  
  &:hover::after {
    width: 100%;
  }
`;

const AuthButtons = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const ButtonBase = styled.button`
  padding: 0.5rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  font-size: 0.95rem;
  white-space: nowrap;
  
  @media (max-width: 768px) {
    width: 100%;
    padding: 0.75rem;
  }
`;

const LoginButton = styled(ButtonBase)`
  background: transparent;
  color: #3b82f6;
  border: 2px solid #3b82f6;
  
  &:hover {
    background: #eff6ff;
    transform: translateY(-1px);
  }
`;

const SignUpButton = styled(ButtonBase)`
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border: none;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(59, 130, 246, 0.3);
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  background: transparent;
  border: none;
  color: #374151;
  cursor: pointer;
  padding: 0.5rem;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.7;
  }
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const MobileMenu = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    background: white;
    padding: 1rem 2rem;
    border-top: 1px solid #e5e7eb;
    animation: slideDown 0.3s ease-out;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  @keyframes slideDown {
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

const MobileNavLink = styled.div<{ active?: boolean }>`
  color: ${props => props.active ? "#3b82f6" : "#4b5563"};
  font-weight: ${props => props.active ? "600" : "500"};
  cursor: pointer;
  padding: 1rem 0;
  border-bottom: 1px solid #f3f4f6;
  transition: all 0.2s;
  
  &:hover {
    color: #3b82f6;
    background-color: #f9fafb;
    padding-left: 0.5rem;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const MobileAuthButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 0 0;
  margin-top: 1rem;
  border-top: 1px solid #e5e7eb;
`;