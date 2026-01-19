// frontend/src/components/PlaceAboutTab.tsx
import React from "react";

type AboutPayload = {
  why_go?: string[];
  know_before_you_go?: string[];
  getting_there?: string | null;
  best_time?: string | null;
  tips?: string[];
};

export type PlaceDetailsPayload = {
  item_id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  images?: string[];
  wikipedia?: string | null;
  address?: string | null;
  source?: string | null;
  about?: AboutPayload; // optional (backend may add later)
};

function clampText(text: string, maxChars = 180) {
  const t = (text || "").trim();
  if (!t) return "";
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars - 1).trimEnd() + "…";
}

function Section({
  title,
  children,
  withDivider = true,
}: {
  title: string;
  children: React.ReactNode;
  withDivider?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: withDivider ? 14 : 0,
        borderTop: withDivider ? "1px solid rgba(229,231,235,0.9)" : "none",
      }}
    >
      <div
        style={{
            fontWeight: 750,
            marginBottom: 6,
            fontSize: "0.78rem",
            color: "#111827",
            letterSpacing: "0.01em",
        }}
        >
        {title}
        </div>

      <div style={{ color: "inherit", opacity: 1, lineHeight: 1.45 }}>
        {children}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((it, idx) => (
        <li key={`${it}-${idx}`} style={{ marginBottom: 6 }}>
          {it}
        </li>
      ))}
    </ul>
  );
}

function makeFallbackAbout(place: PlaceDetailsPayload): AboutPayload {
  const name = place.name || "this place";
  const tips: string[] = [];

  tips.push("Go early for the best light");
  tips.push("Check weather (views vary)");
  tips.push("Expect crowds at peak hours");

  return {
    why_go: [
      `Scenic highlight around ${name}`,
      "Great for photos and views",
      "Popular stop for most itineraries",
    ],
    know_before_you_go: [
      "Weather can change quickly",
      "Peak times can be crowded",
      "Wear comfortable shoes",
    ],
    getting_there: place.address ? `Navigate to: ${place.address}` : null,
    best_time: "Morning or late afternoon",
    tips,
  };
}

export default function PlaceAboutTab({
  place,
  hideHeroImage = false,
}: {
  place: any;
  hideHeroImage?: boolean;
}) {
  const descriptionRaw = (place.description || "").trim();
  const shortDescription =
    clampText(descriptionRaw, 180) ||
    "A popular stop to explore and enjoy the scenery.";

  const about =
    place.about && Object.keys(place.about).length > 0
      ? place.about
      : makeFallbackAbout(place);

  const whyGo = about.why_go || [];
  const know = about.know_before_you_go || [];
  const tips = about.tips || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Images (hero + thumbnails) */}
        {!hideHeroImage && (() => {
          const gallery = [
            ...(place.image_url ? [place.image_url] : []),
            ...((place.images || []).filter(Boolean) as string[]),
          ];

          const seen = new Set<string>();
          const uniq = gallery.filter((u) => {
            if (!u) return false;
            if (seen.has(u)) return false;
            seen.add(u);
            return true;
          });

          if (uniq.length === 0) return null;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  width: "100%",
                  height: 150,
                  borderRadius: 14,
                  background: `url(${uniq[0]}) center/cover no-repeat`,
                  boxShadow: "0 10px 28px rgba(15,23,42,0.16)",
                  border: "1px solid rgba(229,231,235,0.9)",
                }}
              />
              {uniq.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    paddingBottom: 2,
                  }}
                >
                  {uniq.slice(1, 7).map((u, idx) => (
                    <div
                      key={`${u}-${idx}`}
                      style={{
                        width: 84,
                        minWidth: 84,
                        height: 58,
                        borderRadius: 12,
                        background: `url(${u}) center/cover no-repeat`,
                        border: "1px solid rgba(229,231,235,0.95)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Description (short, clamped) */}
        <div
        style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            opacity: 0.92,
            lineHeight: 1.45,
        }}
        title={descriptionRaw || undefined}
        >
        {descriptionRaw || shortDescription}
        </div>

        {/* Read more – directly under description */}
        {place.wikipedia && (
        <a
            href={place.wikipedia}
            target="_blank"
            rel="noreferrer"
            style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "#4f46e5",
            textDecoration: "none",
            alignSelf: "flex-start",
            }}
        >
            Read more →
        </a>
        )}

      {whyGo.length > 0 && (
        <Section title="Why you should go" withDivider={false}>
            <BulletList items={whyGo} />
        </Section>
      )}


      {know.length > 0 && (
        <Section title="Know before you go">
          <BulletList items={know} />
        </Section>
      )}

      {about.getting_there && (
        <Section title="Getting there">
          <div>{about.getting_there}</div>
        </Section>
      )}

      {about.best_time && (
        <Section title="Best time to visit">
          <div>{about.best_time}</div>
        </Section>
      )}

      {tips.length > 0 && (
        <Section title="Travel tips">
          <BulletList items={tips} />
        </Section>
      )}
    </div>
  );
}
