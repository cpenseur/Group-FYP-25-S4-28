// frontend/src/pages/groupAITripGeneratorWait.tsx
// ✅ FIXED: 
// 1. Polling interval is 5 seconds (was 3 seconds)
// 2. Automatically triggers regeneration on page load

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";

import {
  ShoppingBag,
  Mountain,
  Leaf,
  Landmark,
  Utensils,
  Camera,
  Waves,
  Snowflake,
  TreePine,
  Building2,
  Plane,
  Users,
} from "lucide-react";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function getKeywordVisual(keyword: string) {
  const map: Record<string, { Icon: React.ElementType; emoji: string }> = {
    "Luxury/Shopping": { Icon: ShoppingBag, emoji: "🛍️" },
    Adventure: { Icon: Mountain, emoji: "🧗" },
    Wellness: { Icon: Leaf, emoji: "🌿" },
    "Cultural Immersion": { Icon: Landmark, emoji: "🏛️" },
    Culinary: { Icon: Utensils, emoji: "🍜" },
    Sightseeing: { Icon: Camera, emoji: "📸" },
    Tropical: { Icon: Waves, emoji: "🌴" },
    Mountains: { Icon: Mountain, emoji: "⛰️" },
    "Cold/Winter": { Icon: Snowflake, emoji: "❄️" },
    Countryside: { Icon: TreePine, emoji: "🌾" },
    Urban: { Icon: Building2, emoji: "🏙️" },
  };

  return map[keyword] || { Icon: Camera, emoji: "✨" };
}

export default function GroupAITripGeneratorWait() {
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId: string }>();

  const navigatedRef = useRef(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<"starting" | "thinking" | "building" | "finalizing">("starting");
  const [isExiting, setIsExiting] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  
  const [elapsed, setElapsed] = useState(0);
  const estimatedTime = 90; // seconds

  const goToSummary = (tripId: string) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    
    console.log("✅ Navigating to summary page...");
    setIsExiting(true);
    
    window.setTimeout(() => {
      navigate(`/group-trip/${tripId}/summary`, { replace: true });
    }, 420);
  };

  // ✅ NEW: Trigger regeneration on page load
  useEffect(() => {
    if (!tripId || navigatedRef.current) return;

    const triggerRegeneration = async () => {
      try {
        console.log("🔄 Triggering AI regeneration...");
        
        await apiFetch(`/f2/trips/${tripId}/generate-group-itinerary/`, {
          method: "POST",
        });
        
        console.log("✅ Regeneration API called successfully");
        
      } catch (error) {
        console.error("❌ Failed to trigger regeneration:", error);
        setErrorMsg("Failed to start regeneration. Please try again.");
      }
    };

    // Call once on mount
    triggerRegeneration();
    
  }, [tripId]);

  // Fetch preferences for keywords
  useEffect(() => {
    if (!tripId) return;

    const fetchPreferences = async () => {
      try {
        console.log("📋 Fetching preferences for keywords...");
        const prefs = await apiFetch(`/f1/trips/${tripId}/group-preferences/`);

        console.log("📊 Raw preferences:", prefs);

        const allKeywords: string[] = [];
        
        if (Array.isArray(prefs)) {
          prefs.forEach((pref: any) => {
            if (pref.preferences) {
              const p = pref.preferences;
              
              if (Array.isArray(p.activities)) {
                allKeywords.push(...p.activities);
              }
              
              if (Array.isArray(p.destination_types)) {
                allKeywords.push(...p.destination_types);
              }
              
              if (p.country) {
                allKeywords.push(p.country);
              }
            }
          });
        }

        const unique = Array.from(new Set(allKeywords)).slice(0, 20);
        console.log("✅ Keywords loaded:", unique);
        setKeywords(unique);
      } catch (error) {
        console.error("❌ Failed to fetch preferences:", error);
        setKeywords(["Adventure", "Sightseeing", "Culinary", "Urban"]);
      }
    };

    fetchPreferences();
  }, [tripId]);

  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Phase transitions
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("thinking"), 1500);
    const t2 = setTimeout(() => setPhase("building"), 5000);
    const t3 = setTimeout(() => setPhase("finalizing"), 15000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // ✅ Poll for completion - FIXED: 5 seconds instead of 3
  useEffect(() => {
    if (!tripId || navigatedRef.current) return;

    console.log("🔄 Starting completion polling (every 5 seconds)...");

    let pollCount = 0;
    const maxPolls = 36; // 3 minutes max (36 * 5s = 180s)

    const pollInterval = setInterval(async () => {
      pollCount++;

      if (pollCount > maxPolls) {
        console.log("⏱️ Polling timeout");
        clearInterval(pollInterval);
        setErrorMsg("Generation is taking longer than expected. Please refresh the page.");
        return;
      }

      try {
        console.log(`🔄 Polling... (${pollCount * 5}s)`); // ✅ Changed from 3s to 5s
        
        const tripData = await apiFetch(`/f1/trips/${tripId}/`);
        
        console.log(`📊 Status: ${tripData.travel_type}`);

        if (tripData.travel_type === "group_ai") {
          console.log("✅ AI generation completed!");
          clearInterval(pollInterval);
          goToSummary(tripId);
        } else if (tripData.travel_type === "group") {
          console.log("❌ Generation failed or was cancelled");
          clearInterval(pollInterval);
          setErrorMsg("AI generation failed. Please try again.");
        }
      } catch (error) {
        console.error("❌ Polling error:", error);
      }
    }, 5000); // ✅ FIXED: Changed from 3000 to 5000 (5 seconds)

    return () => {
      console.log("🛑 Stopping completion polling");
      clearInterval(pollInterval);
    };
  }, [tripId]);

  const stars = useMemo(() => {
    return Array.from({ length: 90 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 2.2 + 0.9,
      delay: Math.random() * 8,
      duration: Math.random() * 6 + 6,
    }));
  }, []);

  const flights = useMemo(
    () => [
      {
        id: "f1",
        d: "M -200 160 C 120 40, 420 40, 820 160 S 1380 300, 1900 130",
        top: "16%",
        height: 220,
        dur: 14,
        delay: 1,
        size: 20,
      },
      {
        id: "f2",
        d: "M -260 150 C 120 260, 520 40, 900 150 S 1500 260, 2000 120",
        top: "68%",
        height: 210,
        dur: 19,
        delay: 7,
        size: 19,
      },
    ],
    []
  );

  const seeded = useRef<number>(Math.floor(Math.random() * 1e9));

  const floaters = useMemo(() => {
    const seed = seeded.current;

    function rand(i: number) {
      const x = Math.sin(seed + i * 999) * 10000;
      return x - Math.floor(x);
    }

    return keywords.map((k, i) => {
      const top = rand(i) * 70 + 12;
      const baseStagger = (i % 10) * 0.55;
      const jitter = rand(i + 7) * 0.25;
      const delay = baseStagger + jitter;
      const duration = clamp(12 + rand(i + 13) * 10, 12, 20);
      const scale = clamp(0.9 + rand(i + 23) * 0.55, 0.9, 1.45);
      const opacity = clamp(0.55 + rand(i + 31) * 0.35, 0.55, 0.9);
      const { Icon, emoji } = getKeywordVisual(k);
      const direction: "leftToRight" | "rightToLeft" = i % 2 === 0 ? "leftToRight" : "rightToLeft";

      return {
        k,
        i,
        top,
        delay,
        duration,
        scale,
        opacity,
        Icon,
        emoji,
        direction,
      };
    });
  }, [keywords]);

  const phaseText = useMemo(() => {
    if (errorMsg) return "Something went wrong";
    if (phase === "starting") return "Merging everyone's preferences…";
    if (phase === "thinking") return "Finding the perfect destinations…";
    if (phase === "building") return "Creating your group itinerary…";
    return "Adding final details…";
  }, [errorMsg, phase]);

  const progress = Math.min((elapsed / estimatedTime) * 100, 95);

  const routeSvg = (top: string, height: number): React.CSSProperties => ({
    position: "absolute",
    left: 0,
    top,
    width: "100%",
    height,
    overflow: "visible",
    pointerEvents: "none",
  });

  const styles: Record<string, React.CSSProperties> = {
    pageInner: {
      position: "relative",
      minHeight: "100vh",
      width: "100%",
      overflow: "hidden",
      fontFamily: "Inter, sans-serif",
      display: "flex",
      flexDirection: "column",
      transition: "opacity 420ms ease, transform 420ms ease",
      background:
        "radial-gradient(circle at 50% 45%, rgba(44, 24, 82, 0.35), rgba(19, 14, 36, 0.92) 68%), linear-gradient(180deg, #19112f 0%, #22163f 55%, #120c22 100%)",
    },

    fadeLayer: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, #eff3ff 0%, #ede8ff 45%, #d5e7ff 100%)",
      opacity: 0,
      pointerEvents: "none",
      transition: "opacity 420ms ease",
      zIndex: 20,
    },

    center: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
      zIndex: 5,
    },

    card: {
      width: "min(780px, 92vw)",
      background: "rgba(246, 244, 255, 0.72)",
      border: "1px solid rgba(176, 165, 230, 0.35)",
      borderRadius: "22px",
      boxShadow: "0px 18px 50px rgba(0,0,0,0.10)",
      padding: "26px 28px",
      backdropFilter: "blur(10px)",
    },

    title: {
      fontSize: "26px",
      fontWeight: 650,
      color: "#1e1e2f",
      marginBottom: "8px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    subtitle: {
      fontSize: "14px",
      color: "#6d6d8c",
      marginBottom: "18px",
    },

    loaderRow: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "8px",
    },

    phase: {
      fontSize: "14px",
      color: "#2e2e3f",
      marginTop: "10px",
    },

    hint: {
      fontSize: "13px",
      color: "#6d6d8c",
      marginTop: "4px",
    },

    progressContainer: {
      width: "100%",
      height: "6px",
      background: "rgba(107, 92, 255, 0.15)",
      borderRadius: "999px",
      overflow: "hidden",
      marginTop: "16px",
      marginBottom: "8px",
    },

    progressBar: {
      height: "100%",
      background: "linear-gradient(90deg, #6b5cff, #a78bfa)",
      transition: "width 1s ease",
      borderRadius: "999px",
    },

    timeInfo: {
      fontSize: "12px",
      color: "#6d6d8c",
      display: "flex",
      justifyContent: "space-between",
      marginTop: "4px",
    },

    error: {
      marginTop: "14px",
      padding: "12px 14px",
      borderRadius: "14px",
      border: "1px solid rgba(185, 28, 28, 0.25)",
      background: "rgba(185, 28, 28, 0.08)",
      color: "#7f1d1d",
      fontSize: "13px",
    },

    btnRow: {
      display: "flex",
      gap: "10px",
      marginTop: "16px",
    },

    btn: {
      padding: "10px 16px",
      borderRadius: "999px",
      border: "1px solid #c5ccff",
      background: "#ffffff",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 600,
      color: "#2e2e3f",
    },

    magicBg: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      overflow: "hidden",
      pointerEvents: "none",
    },

    aurora: {
      position: "absolute",
      inset: "-20%",
      background: `
        radial-gradient(40% 30% at 20% 30%, rgba(124,92,255,0.25), transparent 60%),
        radial-gradient(35% 25% at 80% 40%, rgba(72,209,204,0.22), transparent 60%),
        radial-gradient(45% 35% at 50% 80%, rgba(255,182,193,0.18), transparent 60%)
      `,
      filter: "blur(60px)",
      animation: "tmAurora 22s ease-in-out infinite alternate",
    },

    mist: {
      position: "absolute",
      inset: "-10%",
      background:
        "linear-gradient(120deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02), rgba(255,255,255,0.12))",
      opacity: 0.35,
      filter: "blur(40px)",
      animation: "tmMist 30s linear infinite",
    },

    star: {
      position: "absolute",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.95)",
      boxShadow: "0 0 10px rgba(255,255,255,0.75), 0 0 26px rgba(255,255,255,0.35)",
      opacity: 0.85,
      mixBlendMode: "screen",
    },

    routeLayer: {
      position: "absolute",
      inset: 0,
      zIndex: 1,
      pointerEvents: "none",
    },

    routePath: {
      fill: "none",
      stroke: "rgba(255,255,255,0.6)",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeDasharray: "12 300",
      filter: "drop-shadow(0 0 6px rgba(255,255,255,0.35))",
    },

    plane: {
      position: "absolute",
      left: 0,
      top: 0,
      zIndex: 2,
      color: "rgba(255,255,255,0.92)",
      filter: "drop-shadow(0 0 10px rgba(255,255,255,0.55))",
      pointerEvents: "none",
      willChange: "offset-distance, transform",
    },

    floater: {
      position: "absolute",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 14px",
      borderRadius: "16px",
      background: "rgba(255,255,255,0.10)",
      border: "1px solid rgba(255,255,255,0.26)",
      boxShadow: "0 10px 28px rgba(0,0,0,0.22), 0 0 26px rgba(255,255,255,0.20)",
      backdropFilter: "blur(12px)",
      color: "rgba(255,255,255,0.92)",
      fontSize: "13px",
      whiteSpace: "nowrap",
      zIndex: 3,
      userSelect: "none",
      pointerEvents: "none",
    },

    floaterIconWrap: {
      width: "30px",
      height: "30px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.14)",
      border: "1px solid rgba(255,255,255,0.28)",
      boxShadow: "0 0 14px rgba(255,255,255,0.35)",
    },

    floaterText: {
      fontWeight: 650,
      letterSpacing: "0.1px",
      color: "rgba(255,255,255,0.92)",
    },
  };

  const dotStyle = (delay: number): React.CSSProperties => ({
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "#6b5cff",
    animation: `tmBounce 1.1s ${delay}s infinite ease-in-out`,
  });

  return (
    <div
      style={{
        ...styles.pageInner,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "scale(0.99)" : "scale(1)",
      }}
    >
      <div style={styles.magicBg}>
        <div style={styles.aurora} />
        <div style={styles.mist} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), transparent 35%), radial-gradient(circle at 70% 35%, rgba(255,255,255,0.06), transparent 40%), radial-gradient(circle at 55% 75%, rgba(255,255,255,0.05), transparent 45%)",
            opacity: 0.7,
            filter: "blur(0px)",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />

        <div style={styles.routeLayer}>
          {flights.map((f) => (
            <svg key={f.id} viewBox={`0 0 1920 ${f.height}`} style={routeSvg(f.top, f.height)}>
              <path
                d={f.d}
                style={{
                  ...styles.routePath,
                  animation: `tmRouteDash ${f.dur}s linear ${f.delay}s infinite`,
                }}
              />
              <Plane
                size={f.size}
                style={
                  {
                    ...styles.plane,
                    offsetPath: `path("${f.d}")`,
                    offsetRotate: "auto 45deg",
                    animation: `tmPlaneAlong ${f.dur}s linear ${f.delay}s infinite`,
                  } as React.CSSProperties
                }
              />
            </svg>
          ))}
        </div>

        {stars.map((s) => (
          <div
            key={s.id}
            style={{
              ...styles.star,
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              animation: `tmTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div style={{ ...styles.fadeLayer, opacity: isExiting ? 1 : 0 }} />

      <style>
        {`
          @keyframes tmAurora {
            0%   { transform: translateY(0) scale(1); opacity: 0.85; }
            50%  { transform: translateY(-40px) scale(1.06); opacity: 1; }
            100% { transform: translateY(20px) scale(1); opacity: 0.9; }
          }
          @keyframes tmMist {
            0%   { transform: translateX(-10%); }
            100% { transform: translateX(10%); }
          }
          @keyframes tmTwinkle {
            0%, 100% { opacity: 0.15; transform: scale(0.95); }
            50%      { opacity: 0.95; transform: scale(1.15); }
          }
          @keyframes tmRouteDash {
            0%   { stroke-dashoffset: 0; opacity: 0; }
            15%  { opacity: 0.55; }
            60%  { opacity: 0.25; }
            100% { stroke-dashoffset: -380; opacity: 0; }
          }
          @keyframes tmPlaneAlong {
            0%   { offset-distance: 0%; opacity: 0; }
            8%   { opacity: 0.95; }
            90%  { opacity: 0.2; }
            100% { offset-distance: 100%; opacity: 0; }
          }
          @keyframes tmGlowPulse {
            0%, 100% { box-shadow: 0 10px 28px rgba(0,0,0,0.22), 0 0 22px rgba(255,255,255,0.18); }
            50%      { box-shadow: 0 12px 32px rgba(0,0,0,0.25), 0 0 34px rgba(255,255,255,0.30); }
          }
          @keyframes tmDriftLTR {
            0%   { transform: translateX(-25vw); }
            100% { transform: translateX(125vw); }
          }
          @keyframes tmDriftRTL {
            0%   { transform: translateX(125vw); }
            100% { transform: translateX(-25vw); }
          }
          @keyframes tmFloat {
            0%   { transform: translateY(0px) rotate(-1.2deg); }
            50%  { transform: translateY(-3px) rotate(1.2deg); }
            100% { transform: translateY(0px) rotate(-1.2deg); }
          }
          @keyframes tmBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
            40%           { transform: translateY(-6px); opacity: 1; }
          }
        `}
      </style>

      {floaters.map((f) => {
        const DriftAnim = f.direction === "leftToRight" ? "tmDriftLTR" : "tmDriftRTL";

        return (
          <div
            key={f.i}
            style={{
              ...styles.floater,
              top: `${f.top}%`,
              opacity: isExiting ? 0 : f.opacity,
              transform: `scale(${f.scale})`,
              transition: "opacity 420ms ease",
              animation: `${DriftAnim} ${f.duration}s linear ${f.delay}s infinite, tmGlowPulse 6s ease-in-out infinite`,
              left: f.direction === "leftToRight" ? "-25vw" : "auto",
              right: f.direction === "rightToLeft" ? "-25vw" : "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                animation: `tmFloat ${clamp(4 + (f.i % 5), 4, 8)}s ease-in-out ${f.delay}s infinite`,
              }}
            >
              <div style={styles.floaterIconWrap}>
                <f.Icon size={18} />
              </div>
              <div style={styles.floaterText}>{f.k}</div>
              <div
                style={{
                  fontSize: "16px",
                  opacity: 0.95,
                  filter: "drop-shadow(0 0 6px rgba(255,255,255,0.9))",
                }}
              >
                {f.emoji}
              </div>
            </div>
          </div>
        );
      })}

      <div style={styles.center}>
        <div style={styles.card}>
          <div style={styles.title}>
            <Users size={28} color="#7C5CFF" />
            Generating your group itinerary
          </div>
          <div style={styles.subtitle}>
            We're combining everyone's preferences into one amazing trip.
            {!errorMsg && (
              <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}>
                ⏱️ Estimated: ~{estimatedTime}s | Elapsed: {elapsed}s
              </div>
            )}
          </div>

          <div style={styles.loaderRow}>
            <div style={dotStyle(0)} />
            <div style={dotStyle(0.15)} />
            <div style={dotStyle(0.3)} />
            <div style={{ fontSize: "13px", color: "#2b2545", fontWeight: 600 }}>
              {errorMsg ? "Generation stopped" : "Working…"}
            </div>
          </div>

          {!errorMsg && (
            <>
              <div style={styles.progressContainer}>
                <div style={{ ...styles.progressBar, width: `${progress}%` }} />
              </div>
              <div style={styles.timeInfo}>
                <span>{Math.round(progress)}% complete</span>
                <span>~{Math.max(0, estimatedTime - elapsed)}s remaining</span>
              </div>
            </>
          )}

          <div style={styles.phase}>{phaseText}</div>
          {!errorMsg && (
            <div style={styles.hint}>
              Keep this tab open — we'll redirect automatically when ready.
            </div>
          )}

          {errorMsg && (
            <>
              <div style={styles.error}>{errorMsg}</div>
              <div style={styles.btnRow}>
                <button style={styles.btn} onClick={() => navigate(`/group-wait-for-friends/${tripId}`)}>
                  Back to waiting page
                </button>
                <button style={styles.btn} onClick={() => window.location.reload()}>
                  Try again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}