// frontend/src/components/TopBar.tsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation, NavLink as RouterNavLink } from "react-router-dom";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import styled from "styled-components";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabaseClient";

/* ============================
   Styled Components
============================= */

const Navbar = styled.nav`
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);

  /* only vertical padding; horizontal handled in NavContainer */
  padding: 12px 0;

  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
`;

// ✅ Center content and keep it within viewport
const NavContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  @media (max-width: 768px) {
    padding: 0 16px;
  }
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const LogoImg = styled.img`
  height: 40px;   /* ⬆ bigger logo */
  width: auto;
  display: block;

  @media (max-width: 768px) {
    height: 32px;
  }
`;

const DesktopNav = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;
`;

const NavItem = styled(RouterNavLink)<{ $active?: boolean }>`
  font-size: 1rem;
  font-weight: ${(props) => (props.$active ? 600 : 500)};
  color: ${(props) => (props.$active ? "#0b4a74" : "#6b7280")};
  text-decoration: none;
  cursor: pointer;
  transition: color 0.2s ease;
  white-space: nowrap;
  font-family: inherit;

  &:hover {
    color: #0b4a74;
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;
`;

const LogoutButton = styled.button`
  background: #0b4a74;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 10px 24px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
  transition: background 0.2s ease, transform 0.1s ease;
  font-family: inherit;

  &:hover {
    background: #09395a;
    transform: translateY(-1px);
  }
`;

/* ============================
   User Header (Logged In)
============================= */

function UserHeader({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Check both obfuscated and legacy paths for active state
  const isActive = (paths: string[]) => paths.some(p => location.pathname === p);

  return (
    <Navbar>
      <NavContainer>
        {/* Logo (includes TripMate text) */}
        <Left onClick={() => navigate("/a/d")}>
          <LogoImg src={logo} alt="TripMate Logo" />
        </Left>

        <RightSection>
          <DesktopNav>
            <NavItem to="/a/d" $active={isActive(["/a/d", "/dashboard"])}>
              Dashboard
            </NavItem>
            <NavItem to="/a/t" $active={isActive(["/a/t", "/trips"])}>
              Trips
            </NavItem>
            <NavItem to="/a/dl" $active={isActive(["/a/dl", "/discovery-local"])}>
              Explore
            </NavItem>
            <NavItem to="/a/p" $active={isActive(["/a/p", "/profile"])}>
              Profile
            </NavItem>
          </DesktopNav>

          <LogoutButton onClick={onLogout}>Log Out</LogoutButton>
        </RightSection>
      </NavContainer>
    </Navbar>
  );
}

// TopBar main component stays the same as you already have
export default function TopBar() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("TopBar getUser error:", error);
        setUser(null);
        return;
      }
      setUser(data.user ?? null);
    };

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/landing-page");
  };

  if (!user) return null;
  return <UserHeader onLogout={handleLogout} />;
}
