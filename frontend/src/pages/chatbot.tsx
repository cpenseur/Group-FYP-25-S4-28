// frontend/src/pages/chatbot.tsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTripId } from "../hooks/useDecodedParams";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import planbotSmall from "../assets/planbotSmall.png";
import planbotBig from "../assets/planbotBig.png";

type ChatRole = "user" | "bot";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

const PlanbotPage: React.FC = () => {
  const tripId = useTripId();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Hi, I’m Planbot. I can help with local travel questions for this trip – things like how to get from A to B, rough costs in SGD, opening hours, and payment options. What would you like to know?",
      timestamp: new Date().toISOString(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tripContext, setTripContext] = useState<any | null>(null);
  const [userInitials, setUserInitials] = useState<string>("U");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const numericTripId = tripId ? Number(tripId) : undefined;

  // --- Load initials from Supabase session/user metadata ---
  useEffect(() => {
    const loadInitials = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      const fullName =
        (user?.user_metadata as any)?.full_name ||
        (user?.user_metadata as any)?.name ||
        "";

      const email = user?.email || "";

      const initialsFromName = (name: string) => {
        const parts = name
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if (parts.length === 0) return "";
        if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
        return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
      };

      const initials =
        initialsFromName(fullName) ||
        (email ? email[0].toUpperCase() : "U");

      setUserInitials(initials || "U");
    };

    loadInitials();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const appendMessage = (role: ChatRole, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        content,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // Fetch trip context from Supabase so the backend does not hit the DB
  useEffect(() => {
    const fetchTripContext = async () => {
      if (!numericTripId) {
        setTripContext(null);
        return;
      }

      const { data: tripData, error: tripError } = await supabase
        .from("trip")
        .select("id,title,main_city,main_country,start_date,end_date")
        .eq("id", numericTripId)
        .maybeSingle();

      if (tripError) {
        console.error("Failed to load trip context:", tripError);
        setTripContext(null);
        return;
      }

      const { data: dayData, error: dayError } = await supabase
        .from("trip_day")
        .select("id,trip_id,day_index,date")
        .eq("trip_id", numericTripId)
        .order("day_index", { ascending: true });

      if (dayError) {
        console.error("Failed to load trip days:", dayError);
        setTripContext(null);
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("itinerary_item")
        .select("id,day_id,title,address,sort_order")
        .eq("trip_id", numericTripId)
        .order("sort_order", { ascending: true });

      if (itemError) {
        console.error("Failed to load itinerary items:", itemError);
      }

      const itemsByDay = new Map<number, any[]>();
      (itemData || []).forEach((item) => {
        const list = itemsByDay.get(item.day_id) || [];
        list.push({ title: item.title, address: item.address });
        itemsByDay.set(item.day_id, list);
      });

      const days = (dayData || []).map((d) => ({
        day_index: d.day_index,
        date: d.date,
        items: itemsByDay.get(d.id) || [],
      }));

      setTripContext({
        title: tripData?.title,
        main_city: tripData?.main_city,
        main_country: tripData?.main_country,
        start_date: tripData?.start_date,
        end_date: tripData?.end_date,
        days,
      });
    };

    fetchTripContext();
  }, [numericTripId]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const history = messages
      .filter((m) => m.id !== "welcome")
      .slice(-10)
      .map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.content,
      }));

    appendMessage("user", trimmed);
    setInput("");
    setIsSending(true);

    try {
      const body: any = { message: trimmed, history };
      if (numericTripId) body.trip_id = numericTripId;
      if (tripContext) body.trip_context = tripContext;

      const resp = await apiFetch("/f1/ai-chatbot/", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const replyText: string =
        (resp && resp.reply) ||
        "Planbot is thinking… but I couldn't get a clear answer. Try rephrasing your question with a bit more detail.";

      appendMessage("bot", replyText);
    } catch (err) {
      console.error("Planbot error:", err);
      appendMessage(
        "bot",
        "Chat is currently unavailable. Please check your connection or try again in a little while."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const MessageRow = ({ m }: { m: ChatMessage }) => {
    const isUser = m.role === "user";

    // Muted avatar colors like wireframe
    const avatarBg = isUser ? "#6B8F9A" : "#F7B26A";
    const name = isUser ? "You" : "Planbot";
    const avatarText = isUser ? userInitials : <img
                      src={planbotSmall}
                      alt="Planbot"
                      style={{
                        width: 18,
                        height: 18,
                        objectFit: "contain",
                      }}
                    />;

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.9rem", alignItems: "flex-start" }}>
          {/* Avatar */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: avatarBg,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              letterSpacing: 0.5,
              flexShrink: 0,
              boxShadow: "0 10px 18px rgba(15,23,42,0.12)",
            }}
          >
            {avatarText}
          </div>

          <div style={{ maxWidth: 860 }}>
            {/* Name + time line */}
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "baseline",
                marginTop: 2,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: "#111827" }}>{name}</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>
                {formatTime(m.timestamp)}
              </div>
            </div>

            {/* Bubble */}
            <div
              style={{
                background: "rgba(255,255,255,0.96)",
                borderRadius: 18,
                padding: "1rem 1.1rem",
                boxShadow: "0 14px 26px rgba(15,23,42,0.10)",
                color: "#334155",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                fontSize: 15,
              }}
            >
              {m.content}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        height: "95vh",
        maxHeight: "95vh",
        background:
          "radial-gradient(circle at top left, #ffe6bf 0, #fdf2ff 45%, #e0f2fe 90%)",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
        overflow: "hidden", // prevents horizontal scroll if any child misbehaves
      }}
    >
      {/* local CSS for typing dots */}
      <style>
        {`
          .pb-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #94A3B8;
            display: inline-block;
            animation: pb-bounce 1s infinite ease-in-out;
          }
          .pb-dot:nth-child(2) { animation-delay: 0.12s; }
          .pb-dot:nth-child(3) { animation-delay: 0.24s; }
          @keyframes pb-bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
            40% { transform: translateY(-4px); opacity: 1; }
          }
        `}
      </style>

      {/* Top Planbot ribbon (contained so it never overflows horizontally) */}
      <div
        style={{
          width: "100%",
          background:
            "linear-gradient(90deg, #f97316 0%, #fb923c 40%, #facc15 100%)",
          color: "white",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            width: "min(1100px, 100%)",
            margin: "0 auto",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: "rgba(255,255,255,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.15rem",
              flexShrink: 0,
            }}
          >
            <img
                src={planbotBig}
                alt="Planbot"
                style={{
                width: 20,
                height: 20,
                objectFit: "contain",
                alignItems: "center",
                justifyContent: "center",
                }}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1 }}>
              Planbot
            </div>
            <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
              Ask travel-related questions for this trip.
            </div>
          </div>

          <button
            onClick={() => navigate(-1)}
            style={{
              marginLeft: "auto",
              borderRadius: 999,
              border: "none",
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              backgroundColor: "rgba(255,255,255,0.22)",
              color: "white",
              cursor: "pointer",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            ← Back to trip
          </button>
        </div>
      </div>

      {/* Chat body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "1.5rem 1rem 1rem",
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: "min(980px, 100%)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Conversation area (NO white card background) */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              maxHeight: "calc(100vh - 340px)",
              overflowY: "auto",
              padding: "0.75rem 0.25rem",
              borderRadius: 0,
              background: "transparent",
              boxShadow: "none",
            }}
          >
            {messages.map((m) => (
              <MessageRow key={m.id} m={m} />
            ))}

            {isSending && (
              <div style={{ display: "flex", gap: "0.9rem", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: "#F7B26A",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    boxShadow: "0 10px 18px rgba(15,23,42,0.12)",
                    flexShrink: 0,
                  }}
                >
                  ✨
                </div>

                <div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: "#111827" }}>Planbot</div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>…</div>
                  </div>

                  <div
                    style={{
                      background: "rgba(255,255,255,0.96)",
                      borderRadius: 18,
                      padding: "0.7rem 0.9rem",
                      boxShadow: "0 14px 26px rgba(15,23,42,0.10)",
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      width: 70,
                    }}
                  >
                    <span className="pb-dot" />
                    <span className="pb-dot" />
                    <span className="pb-dot" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input + disclaimer */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "min(960px, 100%)",
                background: "rgba(255,255,255,0.95)",
                borderRadius: 999,
                padding: "0.45rem 0.55rem 0.45rem 1.25rem",
                boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                boxSizing: "border-box",
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask travel related questions (e.g. Best food in Japan)"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: "0.95rem",
                  background: "transparent",
                  color: "#0F172A",
                }}
                disabled={isSending}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isSending}
                style={{
                  borderRadius: 999,
                  border: "none",
                  width: 44,
                  height: 44,
                  background: "linear-gradient(135deg,#f59e0b,#fb923c)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: !input.trim() || isSending ? "not-allowed" : "pointer",
                  opacity: !input.trim() || isSending ? 0.6 : 1,
                  boxShadow: "0 10px 22px rgba(251,146,60,0.35)",
                  fontSize: "1.05rem",
                  flexShrink: 0,
                }}
                aria-label="Send"
              >
                ↑
              </button>
            </div>

            <div
              style={{
                fontSize: "0.75rem",
                color: "#94A3B8",
                textAlign: "center",
                maxWidth: 640,
              }}
            >
              Planbot is purely informational. Information generated by Planbot
              may not be fully accurate or up-to-date. Always double-check
              critical details like last trains, exact prices, and safety
              advisories.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanbotPage;
