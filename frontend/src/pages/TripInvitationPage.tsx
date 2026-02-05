// frontend/src/pages/TripInvitationPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../lib/apiClient";
import { encodeId } from "../lib/urlObfuscation";
import Login from "../components/login";
import { Check, AlertCircle, Loader2, MapPin, Users } from "lucide-react";

// Get API base URL
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000/api";

type InvitationDetails = {
  trip_id: number;
  trip_title: string;
  invited_email: string;
  role: string;
  invited_at: string | null;
};

/* ========= Styled Components ========= */

const PageContainer = styled.div`
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fce7f3 50%, #dbeafe 100%);
  background-size: 300% 300%;
  animation: colorShift 20s ease infinite;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  @keyframes colorShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
`;

const Card = styled.div`
  width: 100%;
  max-width: 480px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 2.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(102, 126, 234, 0.1);
  text-align: center;
`;

const IconWrapper = styled.div<{ $type?: "success" | "error" | "loading" }>`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  
  ${(p) => {
    switch (p.$type) {
      case "success":
        return `background: #d1fae5; color: #059669;`;
      case "error":
        return `background: #fee2e2; color: #dc2626;`;
      default:
        return `background: #e0e7ff; color: #4f46e5;`;
    }
  }}
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.75rem 0;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
`;

const TripInfoBox = styled.div`
  background: linear-gradient(135deg, #f5f7ff 0%, #e8edff 100%);
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid #d0d9ff;
  margin-bottom: 1.5rem;
  text-align: left;
`;

const TripTitle = styled.div`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TripMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #64748b;
`;

const Button = styled.button<{ $variant?: "primary" | "secondary" }>`
  width: 100%;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;

  ${(p) =>
    p.$variant === "secondary"
      ? `
    background: white;
    color: #4f46e5;
    border: 2px solid #c7d2fe;
    
    &:hover {
      background: #f5f7ff;
      border-color: #a5b4fc;
    }
  `
      : `
    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
    color: white;
    border: none;
    box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
    
    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
    }
  `}

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const ErrorText = styled.p`
  color: #dc2626;
  font-size: 0.9rem;
  margin: 1rem 0 0 0;
`;

const Spinner = styled(Loader2)`
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const LinkText = styled.span`
  color: #4f46e5;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

/* ========= Loading Overlay Modal ========= */

const LoadingOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 3000;
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const LoadingModal = styled.div`
  width: 100%;
  max-width: 420px;
  background: white;
  border-radius: 24px;
  padding: 3rem 2.5rem;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25);
  text-align: center;
  animation: slideUp 0.4s ease;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const LoadingSpinner = styled.div`
  width: 60px;
  height: 60px;
  border: 4px solid #e0e7ff;
  border-top-color: #4f46e5;
  border-radius: 50%;
  margin: 0 auto 1.5rem;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadingTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.75rem 0;
`;

const LoadingSubtitle = styled.p`
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  margin-top: 1.5rem;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $progress: number }>`
  height: 100%;
  width: ${(p) => p.$progress}%;
  background: linear-gradient(90deg, #4f46e5, #6366f1);
  border-radius: 3px;
  transition: width 0.3s ease;
`;

/* ========= Component ========= */

export default function TripInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "signup">("signup");
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  
  // Flag to trigger auto-accept after login
  const [shouldAutoAccept, setShouldAutoAccept] = useState(false);
  const hasAutoAcceptedRef = useRef(false);
  // Track if user initiated login from THIS invitation page (prevents showing overlay for normal logins)
  const initiatedFromInvitationRef = useRef(false);
  
  // Loading overlay state - shows after login/signup while accepting invitation
  const [showRedirectingOverlay, setShowRedirectingOverlay] = useState(false);
  const [redirectProgress, setRedirectProgress] = useState(0);
  const [redirectTripTitle, setRedirectTripTitle] = useState<string>("");

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
        setCurrentUserEmail(session.user.email || null);
      } else {
        setIsLoggedIn(false);
        setCurrentUserEmail(null);
      }
    };

    checkAuth();

    // Listen for auth changes (e.g., after signup/login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setIsLoggedIn(true);
          setCurrentUserEmail(session.user.email || null);
          setShowLoginModal(false);
          
          // If user just logged in/signed up FROM this invitation page, trigger auto-accept
          // This prevents showing the overlay for normal logins elsewhere
          if (event === "SIGNED_IN" && initiatedFromInvitationRef.current && token) {
            setShouldAutoAccept(true);
          }
        } else {
          setIsLoggedIn(false);
          setCurrentUserEmail(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Auto-accept invitation when shouldAutoAccept is triggered
  useEffect(() => {
    const doAutoAccept = async () => {
      if (!shouldAutoAccept || !token || hasAutoAcceptedRef.current) return;
      
      hasAutoAcceptedRef.current = true;
      setShouldAutoAccept(false);
      
      // Show the redirecting overlay immediately after login/signup
      setShowRedirectingOverlay(true);
      setRedirectProgress(10);
      
      // Small delay to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 500));
      setRedirectProgress(30);
      
      setAccepting(true);
      setError(null);

      try {
        setRedirectProgress(50);
        const response = await apiFetch(`/f1/trip-invitation/${token}/accept/`, {
          method: "POST",
          body: JSON.stringify({}),
        });

        console.log("Accept invitation response:", response);
        setRedirectProgress(70);
        setAcceptSuccess(true);
        
        // Set the trip title for the overlay
        const tripTitle = response.trip_title || invitation?.trip_title || "your trip";
        setRedirectTripTitle(tripTitle);

        // Navigate to the trip itinerary after showing progress
        const tripId = response.trip_id;
        if (tripId) {
          setRedirectProgress(90);
          await new Promise(resolve => setTimeout(resolve, 800));
          setRedirectProgress(100);
          await new Promise(resolve => setTimeout(resolve, 400));
          navigate(`/v/${encodeId(tripId)}/i`);
        } else {
          console.error("No trip_id in response:", response);
          setShowRedirectingOverlay(false);
          setTimeout(() => {
            navigate(`/a/d`);
          }, 1000);
        }
      } catch (err: any) {
        console.error("Accept invitation error:", err);
        
        // Try to parse trip_id from error response if it's an "already accepted" case
        const errorData = err.data || err;
        const tripIdFromError = errorData?.trip_id;
        
        if (err.message?.includes("already") || tripIdFromError) {
          setAcceptSuccess(true);
          setRedirectProgress(70);
          const tripId = tripIdFromError || (invitation?.trip_id && invitation.trip_id !== 0 ? invitation.trip_id : null);
          const tripTitle = errorData?.trip_title || invitation?.trip_title || "your trip";
          setRedirectTripTitle(tripTitle);
          
          if (tripId) {
            setRedirectProgress(90);
            await new Promise(resolve => setTimeout(resolve, 800));
            setRedirectProgress(100);
            await new Promise(resolve => setTimeout(resolve, 400));
            navigate(`/v/${encodeId(tripId)}/i`);
          } else {
            setShowRedirectingOverlay(false);
            setTimeout(() => {
              navigate(`/a/d`);
            }, 1000);
          }
        } else {
          setShowRedirectingOverlay(false);
          setError(err.message || "Failed to accept invitation");
          hasAutoAcceptedRef.current = false; // Allow retry
        }
      } finally {
        setAccepting(false);
      }
    };

    doAutoAccept();
  }, [shouldAutoAccept, token, navigate, invitation]);

  // Fetch invitation details
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError("Invalid invitation link");
        setLoading(false);
        return;
      }

      try {
        // Try to get invitation details - this may fail if not authenticated
        // which is OK, we'll show a generic invitation page
        const response = await fetch(
          `${API_BASE_URL}/f1/trip-invitation/${token}/accept/`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );

        if (!response.ok) {
          const data = await response.json();
          // If it's an auth error, we'll still show the page but without trip details
          if (response.status === 401 || response.status === 403) {
            // Not authenticated - show generic invitation page
            setInvitation({
              trip_id: 0,
              trip_title: "Trip Invitation",
              invited_email: "",
              role: "collaborator",
              invited_at: null,
            });
            setLoading(false);
            return;
          }
          throw new Error(data.error || data.detail || "Invalid or expired invitation");
        }

        const data = await response.json();
        setInvitation(data);
      } catch (err: any) {
        // Network errors or other issues - still show generic page if it looks like an auth issue
        if (err.message?.includes("credentials") || err.message?.includes("Authentication")) {
          setInvitation({
            trip_id: 0,
            trip_title: "Trip Invitation", 
            invited_email: "",
            role: "collaborator",
            invited_at: null,
          });
        } else {
          setError(err.message || "Failed to load invitation details");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const acceptInvitation = async () => {
    if (!token || !invitation) return;

    setAccepting(true);
    setError(null);

    try {
      const response = await apiFetch(`/f1/trip-invitation/${token}/accept/`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setAcceptSuccess(true);

      // Navigate to the trip itinerary after a brief success message
      setTimeout(() => {
        navigate(`/v/${encodeId(response.trip_id)}/i`);
      }, 1500);
    } catch (err: any) {
      // Check if user is already a collaborator
      if (err.message?.includes("already accepted")) {
        setAcceptSuccess(true);
        setTimeout(() => {
          navigate(`/v/${encodeId(invitation.trip_id)}/i`);
        }, 1500);
      } else {
        setError(err.message || "Failed to accept invitation");
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleLoginClick = () => {
    initiatedFromInvitationRef.current = true; // Mark that login was initiated from invitation page
    // Save pending invitation to sessionStorage so DashboardPage can handle it after redirect
    if (token) {
      sessionStorage.setItem('pendingInvitation', JSON.stringify({
        token,
        tripTitle: invitation?.trip_title || 'Trip Invitation'
      }));
    }
    setLoginMode("login");
    setShowLoginModal(true);
  };

  const handleSignupClick = () => {
    initiatedFromInvitationRef.current = true; // Mark that signup was initiated from invitation page
    // Save pending invitation to sessionStorage so DashboardPage can handle it after redirect
    if (token) {
      sessionStorage.setItem('pendingInvitation', JSON.stringify({
        token,
        tripTitle: invitation?.trip_title || 'Trip Invitation'
      }));
    }
    setLoginMode("signup");
    setShowLoginModal(true);
  };

  // Loading state
  if (loading) {
    return (
      <PageContainer>
        <Card>
          <IconWrapper>
            <Spinner size={40} />
          </IconWrapper>
          <Title>Loading Invitation...</Title>
          <Subtitle>Please wait while we verify your invitation.</Subtitle>
        </Card>
      </PageContainer>
    );
  }

  // Error state
  if (error && !invitation) {
    return (
      <PageContainer>
        <Card>
          <IconWrapper $type="error">
            <AlertCircle size={40} />
          </IconWrapper>
          <Title>Invalid Invitation</Title>
          <Subtitle>{error}</Subtitle>
          <Button onClick={() => navigate("/")}>Go to Homepage</Button>
        </Card>
      </PageContainer>
    );
  }

  // Success state
  if (acceptSuccess) {
    return (
      <PageContainer>
        <Card>
          <IconWrapper $type="success">
            <Check size={40} />
          </IconWrapper>
          <Title>Welcome to the Trip!</Title>
          <Subtitle>
            You've successfully joined "{invitation?.trip_title}". Redirecting
            you to the itinerary...
          </Subtitle>
        </Card>
      </PageContainer>
    );
  }

  // Main invitation view
  return (
    <PageContainer>
      <Card>
        <IconWrapper>
          <Users size={40} />
        </IconWrapper>

        <Title>You're Invited!</Title>
        <Subtitle>
          You've been invited to collaborate on a trip. Join now to start
          planning together!
        </Subtitle>

        {invitation && invitation.trip_id !== 0 && (
          <TripInfoBox>
            <TripTitle>
              <MapPin size={20} />
              {invitation.trip_title}
            </TripTitle>
            <TripMeta>
              <span>Invited as: {invitation.role}</span>
            </TripMeta>
          </TripInfoBox>
        )}

        {error && <ErrorText>{error}</ErrorText>}

        {isLoggedIn ? (
          <>
            {currentUserEmail &&
              invitation?.invited_email &&
              invitation.invited_email !== "" &&
              currentUserEmail.toLowerCase() !==
                invitation.invited_email.toLowerCase() && (
                <div
                  style={{
                    background: "#fef3c7",
                    borderRadius: 12,
                    padding: "1rem",
                    marginBottom: "1rem",
                    fontSize: "0.9rem",
                    color: "#92400e",
                    textAlign: "left",
                  }}
                >
                  <strong>Note:</strong> This invitation was sent to{" "}
                  <strong>{invitation.invited_email}</strong>. You are currently
                  logged in as <strong>{currentUserEmail}</strong>. Please log in
                  with the correct email to accept this invitation.
                </div>
              )}

            <Button
              onClick={acceptInvitation}
              disabled={
                accepting ||
                Boolean(
                  currentUserEmail &&
                  invitation?.invited_email &&
                  invitation.invited_email !== "" &&
                  currentUserEmail.toLowerCase() !==
                    invitation.invited_email.toLowerCase()
                )
              }
            >
              {accepting ? (
                <>
                  <Spinner size={20} />
                  Accepting...
                </>
              ) : (
                <>
                  <Check size={20} />
                  Accept Invitation
                </>
              )}
            </Button>

            {currentUserEmail &&
              invitation?.invited_email &&
              invitation.invited_email !== "" &&
              currentUserEmail.toLowerCase() !==
                invitation.invited_email.toLowerCase() && (
                <Button
                  $variant="secondary"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setShowLoginModal(true);
                    setLoginMode("login");
                  }}
                >
                  Log in with a different account
                </Button>
              )}
          </>
        ) : (
          <>
            <Button onClick={handleSignupClick}>
              Create Account & Accept
            </Button>
            <Subtitle style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              Already have an account?{" "}
              <LinkText onClick={handleLoginClick}>Log in</LinkText>
            </Subtitle>
          </>
        )}
      </Card>

      {/* Login/Signup Modal */}
      <Login
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        defaultMode={loginMode}
      />

      {/* Redirecting Overlay - shown after login/signup while accepting invitation */}
      {showRedirectingOverlay && (
        <LoadingOverlay>
          <LoadingModal>
            <IconWrapper $type="success">
              <Check size={40} />
            </IconWrapper>
            <Title>Welcome Aboard! 🎉</Title>
            <Subtitle>
              Taking you to {redirectTripTitle ? `"${redirectTripTitle}"` : "your trip"}...
            </Subtitle>
            <LoadingSpinner />
            <ProgressBar>
              <ProgressFill $progress={redirectProgress} />
            </ProgressBar>
          </LoadingModal>
        </LoadingOverlay>
      )}
    </PageContainer>
  );
}
