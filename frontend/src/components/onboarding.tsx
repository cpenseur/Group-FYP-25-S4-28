// src/components/onboarding.tsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { supabase } from "../lib/supabaseClient";

/**
 * Onboarding modal wizard (Step 1/2/3)
 * - Reuses the same Overlay/Modal pattern as your login modal :contentReference[oaicite:0]{index=0}
 * - Saves to public.profiles (upsert) and sets onboarding_completed=true when finished
 *
 * Assumes you added these columns to public.profiles:
 *  location text,
 *  interests text[],
 *  travel_pace text,
 *  budget_level text,
 *  diet_preference text,
 *  mobility_needs text,
 *  onboarding_completed boolean default false
 */

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** If true, shows "Skip for now" and allows exiting without completion */
  allowSkip?: boolean;
};

type TravelPace = "relaxed" | "moderate" | "packed" | "";
type BudgetLevel = "budget" | "mid" | "luxury" | "";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 2100;
  backdrop-filter: blur(4px);
`;

const Modal = styled.div`
  width: 100%;
  max-width: 760px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 2rem 2.25rem;
  background: #ffffff;
  border-radius: 1.25rem;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  color: #111827;
  position: relative;
`;

const Title = styled.h1`
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0.5rem 0 0.25rem;
  text-align: center;
`;

const Subtitle = styled.p`
  margin: 0 0 1.5rem;
  color: #6b7280;
  text-align: center;
  font-size: 0.95rem;
`;

const StepperRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const StepDot = styled.div<{ $active?: boolean; $done?: boolean }>`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.95rem;
  background: ${({ $active, $done }) =>
    $done ? "#2563eb" : $active ? "#2563eb" : "#e5e7eb"};
  color: ${({ $active, $done }) => ($active || $done ? "#ffffff" : "#374151")};
`;

const StepLine = styled.div`
  width: 110px;
  height: 3px;
  border-radius: 999px;
  background: #e5e7eb;
`;

const Section = styled.div`
  margin: 1.25rem 0 1.5rem;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  font-size: 0.95rem;
  box-sizing: border-box;
`;

const Grid = styled.div`
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const CardButton = styled.button<{ $selected?: boolean }>`
  width: 100%;
  padding: 1rem 1rem;
  border-radius: 1rem;
  border: 1px solid ${({ $selected }) => ($selected ? "#2563eb" : "#e5e7eb")};
  background: ${({ $selected }) => ($selected ? "rgba(37,99,235,0.08)" : "#fff")};
  cursor: pointer;
  text-align: center;
  font-weight: 700;
  color: #111827;
  transition: 120ms ease;

  &:hover {
    border-color: #2563eb;
  }
`;

const FooterRow = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-top: 1.5rem;

  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const GhostButton = styled.button`
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  font-weight: 700;
  cursor: pointer;
`;

const PrimaryButton = styled.button<{ disabled?: boolean }>`
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-weight: 800;
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
  opacity: ${({ disabled }) => (disabled ? 0.75 : 1)};
`;

const Status = styled.div`
  min-height: 1.25rem;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #1d4ed8;
  text-align: center;
`;

const INTERESTS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "arts", label: "Arts & Culture", emoji: "🎨" },
  { key: "nature", label: "Nature & Outdoors", emoji: "🌿" },
  { key: "food", label: "Food & Dining", emoji: "🍜" },
  { key: "shopping", label: "Shopping", emoji: "🛍️" },
  { key: "history", label: "History", emoji: "🏛️" },
  { key: "adventure", label: "Adventure", emoji: "🧗" },
  { key: "nightlife", label: "Nightlife", emoji: "🎉" },
  { key: "relaxation", label: "Relaxation", emoji: "🧘" },
];

export default function Onboarding({ isOpen, onClose, allowSkip = true }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [travelPace, setTravelPace] = useState<TravelPace>("");
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>("");

  // Load any existing profile values when opening (nice UX if user resumes onboarding)
  useEffect(() => {
    if (!isOpen) return;

    (async () => {
      setStatus("");
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) {
        setStatus("Please log in again.");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "name, location, interests, travel_pace, budget_level, onboarding_completed"
        )
        .eq("id", authData.user.id)
        .maybeSingle();

      if (error) {
        // Not fatal; user can still proceed
        return;
      }

      if (profile?.name) setName(profile.name);
      if (profile?.location) setLocation(profile.location);
      if (Array.isArray(profile?.interests)) setInterests(profile.interests);
      if (profile?.travel_pace) setTravelPace(profile.travel_pace as TravelPace);
      if (profile?.budget_level) setBudgetLevel(profile.budget_level as BudgetLevel);

      // If already completed, just close
      if (profile?.onboarding_completed) {
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const canContinueStep1 = useMemo(() => {
    // Step 1 is optional in the screenshot style; allow continue even if empty
    return true;
  }, []);

  const canContinueStep2 = useMemo(() => {
    // Allow empty selection if you want; most apps allow 1+
    return true;
  }, []);

  const canComplete = useMemo(() => {
    return travelPace !== "" && budgetLevel !== "";
  }, [travelPace, budgetLevel]);

  if (!isOpen) return null;

  const toggleInterest = (key: string) => {
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const savePartial = async (payload: Record<string, any>) => {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) throw new Error("Not authenticated.");

    const { error } = await supabase.from("profiles").upsert({
      id: authData.user.id,
      updated_at: new Date().toISOString(),
      ...payload,
    });

    if (error) throw error;
  };

  const handleNext = async () => {
    setStatus("");
    setLoading(true);
    try {
      if (step === 1) {
        await savePartial({
          name: Name || null,
          location: location || null,
        });
        setStep(2);
      } else if (step === 2) {
        await savePartial({
          interests,
        });
        setStep(3);
      }
    } catch (e: any) {
      setStatus(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStatus("");
    setStep((prev) => (prev === 3 ? 2 : 1));
  };

  const handleSkip = async () => {
    if (!allowSkip) return;
    setStatus("");
    setLoading(true);
    try {
      // Save what we have so far but keep onboarding_completed=false
      await savePartial({
        name: name || null,
        location: location || null,
        interests,
        travel_pace: travelPace || null,
        budget_level: budgetLevel || null,
        onboarding_completed: false,
      });
      onClose();
    } catch (e: any) {
      setStatus(e?.message ?? "Could not skip right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setStatus("");
    setLoading(true);
    try {
      await savePartial({
        name: name || null,
        location: location || null,
        interests,
        travel_pace: travelPace,
        budget_level: budgetLevel,
        onboarding_completed: true,
      });
      onClose();
    } catch (e: any) {
      setStatus(e?.message ?? "Could not complete onboarding.");
    } finally {
      setLoading(false);
    }
  };

  const header = (() => {
    if (step === 1) {
      return {
        title: "Welcome! Let's personalize your experience",
        subtitle: "This will help us create better itineraries for you",
      };
    }
    if (step === 2) {
      return {
        title: "What interests you?",
        subtitle: "Select all that apply — we’ll tailor recommendations",
      };
    }
    return {
      title: "Your travel style",
      subtitle: "Help us match your pace and budget",
    };
  })();

  const done1 = step > 1;
  const done2 = step > 2;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "0.9rem",
            right: "1rem",
            border: "none",
            background: "none",
            fontSize: "1.25rem",
            cursor: "pointer",
            opacity: 0.6,
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Stepper */}
        <StepperRow>
          <StepDot $active={step === 1} $done={done1}>
            {done1 ? "✓" : "1"}
          </StepDot>
          <StepLine />
          <StepDot $active={step === 2} $done={done2}>
            {done2 ? "✓" : "2"}
          </StepDot>
          <StepLine />
          <StepDot $active={step === 3}>{step === 3 ? "3" : "3"}</StepDot>
        </StepperRow>

        <Title>{header.title}</Title>
        <Subtitle>{header.subtitle}</Subtitle>

        {/* STEP 1 */}
        {step === 1 && (
          <Section>
            <Grid>
              <div>
                <FieldLabel>What’s your name?</FieldLabel>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <FieldLabel>Where are you based?</FieldLabel>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country"
                />
              </div>
            </Grid>
          </Section>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <Section>
            <Grid>
              {INTERESTS.map((i) => {
                const selected = interests.includes(i.key);
                return (
                  <CardButton
                    key={i.key}
                    type="button"
                    $selected={selected}
                    onClick={() => toggleInterest(i.key)}
                    aria-pressed={selected}
                  >
                    <div style={{ fontSize: "1.2rem", marginBottom: "0.35rem" }}>
                      {i.emoji}
                    </div>
                    <div style={{ fontSize: "0.95rem" }}>{i.label}</div>
                  </CardButton>
                );
              })}
            </Grid>
          </Section>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <Section>
            <div style={{ marginBottom: "1.25rem" }}>
              <FieldLabel>Travel Pace</FieldLabel>
              <Grid>
                {(
                  [
                    { key: "relaxed", label: "Relaxed" },
                    { key: "moderate", label: "Moderate" },
                    { key: "packed", label: "Packed" },
                  ] as const
                ).map((p) => (
                  <CardButton
                    key={p.key}
                    type="button"
                    $selected={travelPace === p.key}
                    onClick={() => setTravelPace(p.key)}
                  >
                    {p.label}
                  </CardButton>
                ))}
              </Grid>
            </div>

            <div>
              <FieldLabel>Budget Level</FieldLabel>
              <Grid>
                {(
                  [
                    { key: "budget", label: "Budget" },
                    { key: "mid", label: "Mid-range" },
                    { key: "luxury", label: "Luxury" },
                  ] as const
                ).map((b) => (
                  <CardButton
                    key={b.key}
                    type="button"
                    $selected={budgetLevel === b.key}
                    onClick={() => setBudgetLevel(b.key)}
                  >
                    {b.label}
                  </CardButton>
                ))}
              </Grid>
            </div>
          </Section>
        )}

        {/* Footer */}
        <FooterRow>
          <div style={{ display: "flex", gap: "1rem" }}>
            {step > 1 ? (
              <GhostButton type="button" onClick={handleBack} disabled={loading}>
                Back
              </GhostButton>
            ) : allowSkip ? (
              <GhostButton type="button" onClick={handleSkip} disabled={loading}>
                Skip for now
              </GhostButton>
            ) : (
              <div />
            )}
          </div>

          {step < 3 ? (
            <PrimaryButton
              type="button"
              onClick={handleNext}
              disabled={loading || (step === 1 ? !canContinueStep1 : !canContinueStep2)}
            >
              Continue →
            </PrimaryButton>
          ) : (
            <PrimaryButton
              type="button"
              onClick={handleComplete}
              disabled={loading || !canComplete}
            >
              Complete Setup ✓
            </PrimaryButton>
          )}
        </FooterRow>

        <Status>{status}</Status>
      </Modal>
    </Overlay>
  );
}
