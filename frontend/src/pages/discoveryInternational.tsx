import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { pickTripCover } from "../lib/tripCovers";

type TripPreview = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  travel_type: string | null; // kept in type because backend may still send it, but we DO NOT use it as tags
  start_date: string | null;
  end_date: string | null;
  visibility: string;
  owner_name: string;
  cover_photo_url?: string | null;
  tags?: string[]; // ✅ should come from itinerary_item_tag via backend serializer
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type CountrySummary = {
  country: string;
  tripCount: number;
  sponsored?: boolean;
};

const COMMUNITY_API = "http://127.0.0.1:8000/api/f2/community/";
const SPONSOR_API = "http://127.0.0.1:8000/api/f2/community/sponsored-countries/";
const PAGE_SIZE = 3;

// ---------------- helpers ----------------

function startsWithField(value: string | null | undefined, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const text = (value || "").trim().toLowerCase();
  return text.startsWith(query);
}

function normalizeCountry(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeTags(tags: string[] | undefined | null): string[] {
  return (tags || [])
    .map((t) => (t || "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function isSponsored(country: string | null | undefined, sponsored: Set<string>): boolean {
  return sponsored.has(normalizeCountry(country));
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

    // Priority: city + country → country → fallback
    const queryText =
      (safeCity && safeCountry && `${safeCity} ${safeCountry}`) ||
      safeCountry ||
      "travel";

    const q = encodeURIComponent(queryText);
    const pageSize = 20;

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


export default function DiscoveryInternational() {
  const [allTrips, setAllTrips] = useState<TripPreview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // search + pagination for country detail view
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // search for country grid
  const [countrySearch, setCountrySearch] = useState<string>("");

  // sponsored countries (normalized names)
  const [sponsoredCountries, setSponsoredCountries] = useState<Set<string>>(new Set());

  // images
  const [bgByCountry, setBgByCountry] = useState<Record<string, string | null>>({});
  const [bgByTripId, setBgByTripId] = useState<Record<number, string | null>>({});

  // -------- Fetch sponsored countries ----------
  useEffect(() => {
    const fetchSponsoredCountries = async () => {
      try {
        const res = await fetch(SPONSOR_API, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("sponsor fetch failed");

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error("sponsor not json");

        const data = (await res.json()) as string[];
        const normalized = new Set((data || []).map((c) => normalizeCountry(c)).filter(Boolean));
        setSponsoredCountries(normalized);
      } catch (e) {
        console.warn("Failed to fetch sponsored countries:", e);
        setSponsoredCountries(new Set());
      }
    };

    fetchSponsoredCountries();
  }, []);

  // -------- Fetch all public trips (international only) ----------
  useEffect(() => {
    const fetchAllTrips = async () => {
      try {
        setLoading(true);
        setError(null);

        let url: string | null = COMMUNITY_API;
        const all: TripPreview[] = [];

        while (url) {
          const res: Response = await fetch(url, { headers: { Accept: "application/json" } });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status} – ${text.slice(0, 120)}…`);
          }

          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            const text = await res.text();
            throw new Error(
              `Expected JSON but got '${contentType}'. First part of response: ${text.slice(0, 120)}…`
            );
          }

          const data: DRFPage<TripPreview> = (await res.json()) as DRFPage<TripPreview>;
          const results: TripPreview[] = data.results || [];
          all.push(...results);

          url = data.next ?? null;
        }

        // International = everything that is NOT Singapore
        const filtered = all.filter((t) => normalizeCountry(t.main_country) !== "singapore");
        setAllTrips(filtered);
      } catch (err: any) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllTrips();
  }, []);

  // reset page when search or selectedCountry changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCountry]);

  // ----------------- build country summaries -----------------
  const countrySummaries: CountrySummary[] = useMemo(() => {
    const map = new Map<string, CountrySummary>();

    for (const trip of allTrips) {
      const countryRaw = (trip.main_country || "").trim();
      if (!countryRaw) continue;

      const existing = map.get(countryRaw);
      if (!existing) {
        map.set(countryRaw, {
          country: countryRaw,
          tripCount: 1,
          sponsored: isSponsored(countryRaw, sponsoredCountries),
        });
      } else {
        existing.tripCount += 1;
        existing.sponsored = isSponsored(countryRaw, sponsoredCountries);
      }
    }

    const summaries = Array.from(map.values());

    // Sponsors first, then tripCount desc, then alphabetically
    summaries.sort((a, b) => {
      const aS = a.sponsored ? 1 : 0;
      const bS = b.sponsored ? 1 : 0;
      if (bS !== aS) return bS - aS;

      if (b.tripCount !== a.tripCount) return b.tripCount - a.tripCount;
      return a.country.localeCompare(b.country);
    });

    return summaries;
  }, [allTrips, sponsoredCountries]);

  // ----------------- country grid: fetch Openverse backgrounds for visible countries -----------------
  const countrySearchLower = countrySearch.trim().toLowerCase();
  const filteredCountries =
    countrySearchLower === ""
      ? countrySummaries
      : countrySummaries.filter((c) => c.country.toLowerCase().startsWith(countrySearchLower));

  useEffect(() => {
    const newBgByCountry: Record<string, string | null> = {};

    for (const c of filteredCountries) {
      if (bgByCountry[c.country] !== undefined) continue;
      newBgByCountry[c.country] = pickTripCover(c.country);
    }

    if (Object.keys(newBgByCountry).length > 0) {
      setBgByCountry((prev) => ({ ...prev, ...newBgByCountry }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCountries]);

  // ----------------- trip cards in country detail: Openverse background per trip -----------------
  const countryTrips = useMemo(() => {
    if (!selectedCountry) return [];
    return allTrips.filter(
      (t) => normalizeCountry(t.main_country) === normalizeCountry(selectedCountry)
    );
  }, [allTrips, selectedCountry]);

  const filteredTripsForCountry = useMemo(() => {
    if (!selectedCountry) return [];

    const q = searchQuery.trim().toLowerCase();
    if (!q) return countryTrips;

    return countryTrips
      .map((trip) => {
        const country = trip.main_country;
        const author = trip.owner_name;
        const title = trip.title;

        // ✅ Tags ONLY from trip.tags (backend should supply from itinerary_item_tag)
        const pillTags = normalizeTags(trip.tags);
        const tagTokens = pillTags.map((t) => t.toLowerCase());

        let rank = Infinity;

        if (startsWithField(country, q)) rank = Math.min(rank, 1);
        if (startsWithField(author, q)) rank = Math.min(rank, 2);
        if (startsWithField(title, q)) rank = Math.min(rank, 3);
        if (tagTokens.some((tag) => tag.startsWith(q))) rank = Math.min(rank, 4);

        return { trip, rank };
      })
      .filter((item) => item.rank !== Infinity)
      .sort((a, b) => a.rank - b.rank)
      .map((item) => item.trip);
  }, [countryTrips, searchQuery, selectedCountry]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTripsForCountry.length / PAGE_SIZE) || 1
  );
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedTrips = filteredTripsForCountry.slice(startIndex, startIndex + PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;

    const hydrateTripImages = async () => {
      const jobs: Promise<void>[] = [];
      for (const trip of pagedTrips) {
        if (bgByTripId[trip.id] !== undefined) continue;

        const country = (trip.main_country || "").trim();
        const city = (trip.main_city || "").trim();
        const query = `${city ? city + " " : ""}${country}`.trim() || "travel";

        jobs.push(
          (async () => {
            const img = await fetchOpenverseImageForPlace(trip.main_city, trip.main_country, trip.id);
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

  // ---------- trip card renderer (DiscoveryLocal style + Openverse bg + city,country) ----------
  const renderTripCard = (trip: TripPreview) => {
    const cleanTags = normalizeTags(trip.tags).slice(0, 4);
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
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.16), 0 0 1px rgba(15, 23, 42, 0.08)",
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
          <h2
            style={{
              marginBottom: "auto",
              fontSize: "1.4rem",
              fontWeight: 600,
            }}
          >
            {trip.title}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {/* location: include city if available, else country */}
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
                <span>
                  {trip.main_city ? `${trip.main_city}, ${trip.main_country}` : trip.main_country}
                </span>
              </div>
            )}

            {/* tags: ONLY trip.tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {cleanTags.map((tag) => (
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

            <div
              style={{
                fontSize: "0.8rem",
                color: "#e5e5e5",
                marginTop: "0.3rem",
              }}
            >
              {trip.owner_name && <span>by {trip.owner_name}</span>}
            </div>
          </div>
        </div>
      </Link>
    );
  };

  // =========================
  // COUNTRY DETAIL VIEW
  // =========================
  if (selectedCountry) {
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
              <a
                href="/discovery-local"
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
                Local
              </a>

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
                International
              </button>

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

            <p style={{ color: "#777", marginTop: "0.2rem", marginBottom: "0.4rem" }}>
              International itineraries in <strong>{selectedCountry}</strong>
            </p>

            <button
              onClick={() => {
                setSelectedCountry(null);
                setSearchQuery("");
                setPage(1);
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "#555",
                fontSize: "0.85rem",
                textDecoration: "underline",
                cursor: "pointer",
                marginBottom: "0.8rem",
              }}
            >
              ← Back to all countries
            </button>

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
          {loading && <p style={{ textAlign: "center", color: "#555" }}>Loading international itineraries…</p>}
          {error && <p style={{ textAlign: "center", color: "crimson" }}>{error}</p>}
          {!loading && !error && filteredTripsForCountry.length === 0 && (
            <p style={{ textAlign: "center", color: "#555" }}>
              No itineraries found for this country matching your search.
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
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08), 0 0 1px rgba(15, 23, 42, 0.06)",
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

  // =========================
  // COUNTRY GRID VIEW
  // =========================
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
              marginBottom: "0.8rem",
            }}
          >
            <a
              href="/discovery-local"
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
              Local
            </a>

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
              International
            </button>

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
            Explore international itineraries by destination.
          </p>

          {/* Country search */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <input
              type="text"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Search countries…"
              style={{
                width: "100%",
                maxWidth: "280px",
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
        {loading && <p style={{ textAlign: "center", color: "#555" }}>Loading international itineraries…</p>}
        {error && <p style={{ textAlign: "center", color: "crimson" }}>{error}</p>}
        {!loading && !error && filteredCountries.length === 0 && (
          <p style={{ textAlign: "center", color: "#555" }}>No countries match your search.</p>
        )}

        {/* Country grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {filteredCountries.map((c) => {
            const label = c.tripCount === 1 ? "1 Itinerary" : `${c.tripCount} Itineraries`;
            const sponsored = !!c.sponsored;

            const bgUrl = bgByCountry[c.country] || null;

            return (
              <button
                key={c.country}
                onClick={() => {
                  setSelectedCountry(c.country);
                  setSearchQuery("");
                  setPage(1);
                }}
                style={{
                  position: "relative",
                  borderRadius: "20px",
                  overflow: "hidden",
                  height: "260px",
                  textDecoration: "none",
                  color: "#fff",
                  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.16), 0 0 1px rgba(15, 23, 42, 0.08)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {/* fallback */}
                <div style={{ position: "absolute", inset: 0, background: "#EFEFFF" }} />

                {/* Openverse country image */}
                {bgUrl && (
                  <img
                    src={bgUrl}
                    alt={c.country}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      el.style.display = "none";
                    }}
                  />
                )}

                {/* Bottom panel */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: "1.2rem 1.4rem",
                    background: sponsored
                      ? "rgba(26, 26, 70, 0.92)"
                      : "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))",
                    display: "flex",
                    flexDirection: "column",
                    gap: sponsored ? "0.35rem" : "0.5rem",
                  }}
                >
                  <span
                    style={{
                      alignSelf: "flex-start",
                      padding: "6px 14px",
                      borderRadius: "999px",
                      fontSize: "0.8rem",
                      backgroundColor: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.6)",
                      backdropFilter: "blur(4px)",
                      WebkitBackdropFilter: "blur(4px)",
                    }}
                  >
                    {label}
                  </span>

                  <span
                    style={{
                      fontSize: "2.2rem",
                      fontWeight: 800,
                      lineHeight: 1.05,
                      letterSpacing: "-0.02em",
                      textShadow: sponsored ? "none" : "0 2px 6px rgba(0,0,0,0.6)",
                      marginTop: "0.15rem",
                    }}
                  >
                    {c.country}
                  </span>

                  {sponsored && (
                    <span style={{ fontSize: "1.05rem", fontWeight: 600, opacity: 0.95 }}>
                      Trending Now!
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
