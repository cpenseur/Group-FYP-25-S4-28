import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type TripPreview = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  travel_type: string | null; // kept for type-compat, but NOT used for tags anymore
  start_date: string | null;
  end_date: string | null;
  visibility: string;
  owner_name: string;
  cover_photo_url?: string | null;
  tags?: string[]; // comes from itinerary_item_tag via serializer
  is_flagged?: boolean;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const COMMUNITY_API = `${API_BASE}/f2/community/`;
const PAGE_SIZE = 3;

// ---------------- helpers ----------------

function startsWithField(value: string | null | undefined, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const text = (value || "").trim().toLowerCase();
  return text.startsWith(query);
}

function normalizeTags(tags: string[] | undefined | null): string[] {
  return (tags || [])
    .map((t) => (t || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

// deterministic hash so each card tends to pick a different image
function hashInt(input: number): number {
  let x = input | 0;
  x = (x ^ 61) ^ (x >>> 16);
  x = x + (x << 3);
  x = x ^ (x >>> 4);
  x = x * 0x27d4eb2d;
  x = x ^ (x >>> 15);
  return Math.abs(x);
}
async function fetchOpenverseImageForPlace(
  city: string | null | undefined,
  country: string | null | undefined,
  seed: number
): Promise<string | null> {
  try {
    const safeCity = (city || "").trim();
    const safeCountry = (country || "").trim();

    // Priority: country → fallback
    const queryText =
      safeCountry ||
      "travel";

    const q = encodeURIComponent(queryText);
    const pageSize = 20;

    // NOTE: keep identical to International (including filters)
    const url = `https://api.openverse.org/v1/images/?q=${q}&page_size=${pageSize}&license_type=commercial&aspect_ratio=wide`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    const results: any[] = data?.results || [];
    if (results.length === 0) return null;

    // deterministic selection
    const idx = Math.abs(seed) % results.length;
    const picked = results[idx];

    return picked?.thumbnail || picked?.url || null;
  } catch {
    return null;
  }
}

export default function DiscoveryLocal() {
  const [allTrips, setAllTrips] = useState<TripPreview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // per-trip Openverse background
  const [bgByTripId, setBgByTripId] = useState<Record<number, string | null>>(
    {}
  );

  useEffect(() => {
    const fetchAllTrips = async () => {
      try {
        setLoading(true);
        setError(null);

        let url: string | null =
          `${COMMUNITY_API}?main_country=Singapore&visibility=public&is_flagged=false`;

        const all: TripPreview[] = [];

        while (url) {
          const res: Response = await fetch(url, {
            headers: { Accept: "application/json" },
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status} – ${text.slice(0, 120)}…`);
          }

          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            const text = await res.text();
            throw new Error(
              `Expected JSON but got '${contentType}'. First part of response: ${text.slice(
                0,
                120
              )}…`
            );
          }

          const data: DRFPage<TripPreview> =
            (await res.json()) as DRFPage<TripPreview>;
          const results: TripPreview[] = data.results || [];
          all.push(...results);

          // Ensure HTTPS for pagination URLs to avoid mixed content errors
          url = data.next ? data.next.replace('http://', 'https://') : null;
        }

        // Client-side safety filter (in case backend doesn't filter yet)
        const cleaned = all.filter((t) => {
          const isPublic = (t.visibility || "").toLowerCase() === "public";
          const notFlagged =
            t.is_flagged === undefined ? true : t.is_flagged === false;
          const isSingapore =
            (t.main_country || "").toLowerCase() === "singapore";
          return isPublic && notFlagged && isSingapore;
        });

        setAllTrips(cleaned);
      } catch (err: any) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllTrips();
  }, []);

  // reset to page 1 whenever search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // ---------------- filtering ----------------
  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allTrips;

    return allTrips
      .map((trip) => {
        const country = trip.main_country;
        const author = trip.owner_name;
        const title = trip.title;

        const pillTags = normalizeTags(trip.tags);
        const cleanTags = pillTags.map((t) => t.toLowerCase());

        let rank = Infinity;

        if (startsWithField(country, q)) rank = Math.min(rank, 1);
        if (startsWithField(author, q)) rank = Math.min(rank, 2);
        if (startsWithField(title, q)) rank = Math.min(rank, 3);
        if (cleanTags.some((tag) => tag.startsWith(q)))
          rank = Math.min(rank, 4);

        return { trip, rank };
      })
      .filter((item) => item.rank !== Infinity)
      .sort((a, b) => a.rank - b.rank)
      .map((item) => item.trip);
  }, [allTrips, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / PAGE_SIZE) || 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedTrips = filteredTrips.slice(startIndex, startIndex + PAGE_SIZE);

  // ---------------- Openverse hydration (same pattern as International) ----------------
  useEffect(() => {
    let cancelled = false;

    const hydrateTripImages = async () => {
      const jobs: Promise<void>[] = [];

      for (const trip of pagedTrips) {
        if (bgByTripId[trip.id] !== undefined) continue;

        jobs.push(
          (async () => {
            const img = await fetchOpenverseImageForPlace(
              trip.main_city,
              trip.main_country,
              trip.id
            );
            if (cancelled) return;
            setBgByTripId((prev) => ({ ...prev, [trip.id]: img }));
          })()
        );
      }

      await Promise.all(jobs);
    };

    hydrateTripImages();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagedTrips]);

  const renderTripCard = (trip: TripPreview) => {
    const cleanTags = normalizeTags(trip.tags);
    const bgUrl = bgByTripId[trip.id] || null;

    return (
      <Link
        key={trip.id}
        to={`/discovery-itinerary/${trip.id}`}
        style={{
          position: "relative",
          display: "block",
          borderRadius: "20px",
          overflow: "hidden",
          height: "260px",
          boxShadow:
            "0 18px 40px rgba(15, 23, 42, 0.16), 0 0 1px rgba(15, 23, 42, 0.08)",
          textDecoration: "none",
          color: "#fff",
        }}
      >
        {/* fallback background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#EFEFFF",
          }}
        />

        {/* Openverse image */}
        {bgUrl && (
          <img
            src={bgUrl}
            alt={trip.title}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "saturate(1.05)",
            }}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
            }}
          />
        )}

        {/* dark gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.72) 60%, rgba(0,0,0,0) 100%)",
            display: "flex",
            flexDirection: "column",
            padding: "1.8rem 2rem",
          }}
        >
          <h2 style={{ marginBottom: "auto", fontSize: "1.4rem", fontWeight: 600 }}>
            {trip.title}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {/* Local: COUNTRY ONLY */}
            {trip.main_country && (
              <div
                style={{
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span aria-hidden="true">📍</span>
                <span>{trip.main_country}</span>
              </div>
            )}

            {/* tags from trip.tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {cleanTags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    backgroundColor: "rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.5)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            <div style={{ fontSize: "0.8rem", color: "#e5e5e5", marginTop: "0.3rem" }}>
              {trip.owner_name && <span>by {trip.owner_name}</span>}
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f7",
        padding: "3rem 1.5rem 4rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "1100px" }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "2.6rem",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ display: "block" }}>Community Itinerary</span>
            <span style={{ display: "block" }}>Discovery</span>
          </h1>
          <p style={{ color: "#555", marginBottom: "1.5rem" }}>
            Discover journeys. Inspire adventures.
          </p>

          {/* Tabs */}
          <div
            style={{
              display: "inline-flex",
              gap: "0.75rem",
              padding: "0.25rem",
              borderRadius: "999px",
              background: "#e4e4ea",
              marginBottom: "0.9rem",
            }}
          >
            <button
              style={{
                border: "none",
                borderRadius: "999px",
                padding: "0.4rem 1.3rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                background: "#111",
                color: "#fff",
                cursor: "default",
              }}
            >
              Local
            </button>

            <a
              href="/discovery-international"
              style={{
                borderRadius: "999px",
                padding: "0.4rem 1.3rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                textDecoration: "none",
                color: "#333",
                lineHeight: 1.6,
              }}
            >
              International
            </a>

            <a
              href="/discovery-faq"
              style={{
                borderRadius: "999px",
                padding: "0.4rem 1.3rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                textDecoration: "none",
                color: "#333",
                lineHeight: 1.6,
              }}
            >
              FAQ
            </a>
          </div>

          <p style={{ color: "#777", marginTop: "0.2rem", marginBottom: "0.6rem" }}>
            Local itineraries in <strong>Singapore</strong>
          </p>

          {/* Search bar */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by country, author, title, or tag…"
              style={{
                width: "100%",
                maxWidth: "380px",
                padding: "0.5rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid #d0d0dc",
                fontSize: "0.9rem",
                outline: "none",
              }}
            />
          </div>
        </header>

        {/* States */}
        {loading && <p style={{ textAlign: "center", color: "#555" }}>Loading local itineraries…</p>}
        {error && <p style={{ textAlign: "center", color: "crimson" }}>{error}</p>}
        {!loading && !error && filteredTrips.length === 0 && (
          <p style={{ textAlign: "center", color: "#555" }}>
            No itineraries found matching your search.
          </p>
        )}

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {pagedTrips.map(renderTripCard)}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ marginTop: "2.5rem", display: "flex", justifyContent: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#fff",
                padding: "0.4rem 0.8rem",
                borderRadius: "999px",
                boxShadow:
                  "0 10px 30px rgba(15, 23, 42, 0.08), 0 0 1px rgba(15, 23, 42, 0.06)",
              }}
            >
              <button
                disabled={currentPage === 1}
                onClick={() => currentPage > 1 && setPage(currentPage - 1)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "0.25rem 0.5rem",
                  cursor: currentPage === 1 ? "default" : "pointer",
                  opacity: currentPage === 1 ? 0.3 : 1,
                }}
              >
                ←
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNumber = i + 1;
                const isActive = pageNumber === currentPage;
                return (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "999px",
                      border: "none",
                      fontSize: "0.85rem",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      background: isActive ? "#111" : "transparent",
                      color: isActive ? "#fff" : "#333",
                    }}
                  >
                    {pageNumber}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() => currentPage < totalPages && setPage(currentPage + 1)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "0.25rem 0.5rem",
                  cursor: currentPage === totalPages ? "default" : "pointer",
                  opacity: currentPage === totalPages ? 0.3 : 1,
                }}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
