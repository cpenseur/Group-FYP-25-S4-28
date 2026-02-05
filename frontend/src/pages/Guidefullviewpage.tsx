// frontend/src/pages/GuideFullViewPage.tsx
// Full guide view with all days, items, and "Add to Trip" functionality
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import { encodeId } from "../lib/urlObfuscation";
import TripSubHeader from "../components/TripSubHeader";

type GuideItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  lat: number | null;
  lon: number | null;
  estimated_cost?: string;
  duration?: string;
  start_time?: string;
  address?: string;
  image_url?: string;
};

type GuideDay = {
  day_index: number;
  title: string;
  notes?: string;
  items: GuideItem[];
};

type GuideDetail = {
  id: string;
  title: string;
  description: string;
  author: string;
  author_id: number;
  author_avatar?: string | null;
  thumbnail: string;
  destination: string;
  duration_days: number;
  views: number;
  saves: number;
  year: string;
  is_saved: boolean;
  days: GuideDay[];
};

export default function GuideFullViewPage() {
  const { tripId, guideId } = useParams<{ tripId: string; guideId: string }>();
  const navigate = useNavigate();

  const [guide, setGuide] = useState<GuideDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(0);

  useEffect(() => {
    loadGuide();
  }, [guideId]);

  const loadGuide = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch(`/f1/guides/${guideId}/`);
      setGuide(data);
    } catch (error) {
      console.error("Failed to load guide:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToTrip = () => {
    navigate(`/v/${encodeId(tripId)}/r`);
  };

  if (isLoading) {
    return (
      <div>
        <TripSubHeader />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
          Loading guide...
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div>
        <TripSubHeader />
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2>Guide not found</h2>
          <button onClick={() => navigate(`/v/${encodeId(tripId)}/r`)}>
            Back to Recommendations
          </button>
        </div>
      </div>
    );
  }

  const currentDay = guide.days[selectedDay];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f9fafb",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <TripSubHeader />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {/* Back Button */}
        <button
          onClick={() => navigate(`/v/${encodeId(tripId)}/r`)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            cursor: "pointer",
            marginBottom: "24px",
            fontSize: "14px",
            color: "#374151",
          }}
        >
          ← Back to Recommendations
        </button>

        {/* Header */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            overflow: "hidden",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <img
            src={guide.thumbnail}
            alt={guide.title}
            style={{ width: "100%", height: "300px", objectFit: "cover" }}
          />
          <div style={{ padding: "32px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "12px", color: "#111827" }}>
              {guide.title}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
              <span style={{ fontSize: "14px", color: "#6b7280" }}>
                by {guide.author} • {guide.year}
              </span>
              <span style={{ fontSize: "14px", color: "#6b7280" }}>
                👁️ {guide.views.toLocaleString()} views
              </span>
              <span style={{ fontSize: "14px", color: "#6b7280" }}>
                💾 {guide.saves} saves
              </span>
            </div>
            <p style={{ fontSize: "15px", color: "#374151", lineHeight: "1.6", marginBottom: "24px" }}>
              {guide.description}
            </p>
            <button
              onClick={handleAddToTrip}
              style={{
                padding: "14px 32px",
                backgroundColor: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
              }}
            >
              + Add Entire Guide to My Trip
            </button>
          </div>
        </div>

        {/* Day Tabs */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
            {guide.days.map((day, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedDay(idx)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: selectedDay === idx ? "#4f46e5" : "#f3f4f6",
                  color: selectedDay === idx ? "white" : "#374151",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Day {day.day_index + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Day Content */}
        {currentDay && (
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "32px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "#111827" }}>
              {currentDay.title || `Day ${currentDay.day_index + 1}`}
            </h2>
            {currentDay.notes && (
              <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
                {currentDay.notes}
              </p>
            )}

            {/* Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {currentDay.items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: "16px",
                    padding: "20px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {/* Number Badge */}
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "#4f46e5",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#111827", marginBottom: "6px" }}>
                          {item.title}
                        </h3>
                        {item.description && (
                          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>
                            {item.description}
                          </p>
                        )}
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          {item.category && (
                            <span
                              style={{
                                padding: "4px 10px",
                                backgroundColor: "#e0e7ff",
                                color: "#4f46e5",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: 500,
                              }}
                            >
                              {item.category}
                            </span>
                          )}
                          {item.duration && (
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>
                              ⏱️ {item.duration}
                            </span>
                          )}
                          {item.estimated_cost && (
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>
                              💰 {item.estimated_cost}
                            </span>
                          )}
                        </div>
                        {item.address && (
                          <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "6px" }}>
                            📍 {item.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}