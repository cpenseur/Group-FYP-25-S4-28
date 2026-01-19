// frontend/src/components/PlaceTravelTab.tsx
import React from "react";

type TravelPayload = {
  transport_systems?: string[];
  currency_exchange?: string[];
  holidays_and_crowds?: string[];
  attraction_info?: string[];
};

export type PlaceTravelTabPlace = {
  name?: string | null;
  address?: string | null;
  travel?: TravelPayload | null;
};

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

function dedupe(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items || []) {
    const t = (raw || "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function makeFallbackTravel(place: PlaceTravelTabPlace): TravelPayload {
  const name = (place.name || "this place").trim();
  const addr = (place.address || "").trim();

  const cityHint = (() => {
    if (!addr) return null;
    const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return null;

    // Walk from right to left (excluding country), prefer a "name-like" token
    const candidates = parts.slice(0, -1);
    for (let i = candidates.length - 1; i >= 0; i--) {
        const p = candidates[i];
        if (!p) continue;

        // If starts with digits, strip leading digits and keep alpha tail
        if (/^\d/.test(p)) {
        const tail = p.replace(/^[0-9\-\s]+/, "").trim();
        if (tail && /[A-Za-z]/.test(tail)) return tail;
        continue;
        }

        if (/[A-Za-z]/.test(p)) return p;
    }
    return null;
    })();

  const city = cityHint ? ` around ${cityHint}` : "";

  return {
    transport_systems: [
      "Use public transport where possible; it’s usually the fastest in cities.",
      "Keep a ride-hailing app ready as a fallback for late nights or bad weather.",
      `Plan walking segments${city}—short distances can still take time in crowds.`,
    ],
    currency_exchange: [
      "Carry a small amount of cash for small shops or top-ups.",
      "Use a card with low FX fees when possible; avoid dynamic currency conversion.",
    ],
    holidays_and_crowds: [
      "Weekends and public holidays can be significantly more crowded.",
      "Arrive earlier in the day if you want calmer photos and shorter queues.",
    ],
    attraction_info: [
      `If ${name} is a “must-do”, consider booking ahead if tickets or timed entry exist.`,
      "Check the official website or listing for last entry / closure days.",
    ],
  };
}

export default function PlaceTravelTab({
  place,
}: {
  place: PlaceTravelTabPlace;
}) {
  const travel =
    place.travel && Object.keys(place.travel || {}).length > 0
      ? place.travel
      : null;

  const payload = travel ?? makeFallbackTravel(place);

  const transport = dedupe(payload.transport_systems || []);
  const currency = dedupe(payload.currency_exchange || []);
  const holidays = dedupe(payload.holidays_and_crowds || []);
  const attraction = dedupe(payload.attraction_info || []);

  const hasAny =
    transport.length > 0 ||
    currency.length > 0 ||
    holidays.length > 0 ||
    attraction.length > 0;

  if (!hasAny) {
    return (
      <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
        No travel info available.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {transport.length > 0 && (
        <Section title="Transport systems" withDivider={false}>
          <BulletList items={transport} />
        </Section>
      )}

      {currency.length > 0 && (
        <Section title="Currency exchange">
          <BulletList items={currency} />
        </Section>
      )}

      {holidays.length > 0 && (
        <Section title="Holidays & crowds">
          <BulletList items={holidays} />
        </Section>
      )}

      {attraction.length > 0 && (
        <Section title="Attraction info">
          <BulletList items={attraction} />
        </Section>
      )}
    </div>
  );
}
