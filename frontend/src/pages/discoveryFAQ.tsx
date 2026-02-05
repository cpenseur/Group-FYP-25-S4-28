import React, { useMemo, useState, useEffect } from "react";

// Use environment variable for API base URL
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000/api";

type FAQCategory = "General" | "Transport" | "Costs" | "Safety" | "Photos" | string;

type FAQItem = {
  id: number;
  country: string;
  category: string;
  question: string;
  answer: string;
  is_published?: boolean;
};

// Fallback data in case API fails
const FALLBACK_FAQ_ITEMS: FAQItem[] = [
  // ---------- Japan ----------
  {
    id: 1,
    country: "Japan",
    category: "General",
    question: "What is the best time to visit Japan?",
    answer:
      "Spring (Mar–Apr) for cherry blossoms and autumn (Oct–Nov) for foliage are the most popular. Winter is great for skiing, while summer has festivals but is hot and humid.",
  },
  {
    id: 2,
    country: "Japan",
    category: "General",
    question: "Is English commonly spoken in Japan?",
    answer:
      "In major cities and tourist areas, you’ll usually find English signs and some English-speaking staff. Learn a few basic Japanese phrases and keep key details written down in Japanese.",
  },
  {
    id: 3,
    country: "Japan",
    category: "Transport",
    question: "Do I need a JR Pass for 7 days in Japan?",
    answer:
      "A JR Pass is worth it if you’re taking multiple long-distance shinkansen trips within its validity period. If you’ll mostly stay in one region or city, local passes or IC cards may be cheaper.",
  },
  {
    id: 4,
    country: "Japan",
    category: "Transport",
    question: "Is Mobile Suica available for tourists?",
    answer:
      "Yes. You can add Suica or PASMO to Apple Wallet and some Android phones. It works on trains, buses, and many convenience stores and vending machines.",
  },
  {
    id: 5,
    country: "Japan",
    category: "Costs",
    question: "Is Japan expensive for tourists?",
    answer:
      "Japan is mid-range: local eateries, convenience-store meals, and business hotels are affordable. Costs rise quickly if you choose high-end dining and boutique ryokan stays.",
  },
  {
    id: 6,
    country: "Japan",
    category: "Costs",
    question: "Do I need cash in Japan?",
    answer:
      "Cards and mobile payments are widely accepted in cities, but small shops and rural areas may still be cash-only. It’s wise to carry some yen for local buses, shrines, and family-run eateries.",
  },
  {
    id: 7,
    country: "Japan",
    category: "Safety",
    question: "Is Japan safe for solo travelers?",
    answer:
      "Japan is considered one of the safest countries for solo travel. Usual precautions still apply: keep valuables secure, avoid very late-night empty streets, and follow local guidance.",
  },
  {
    id: 8,
    country: "Japan",
    category: "Photos",
    question: "Can I take photos everywhere in Japan?",
    answer:
      "Photography is welcome in many places, but not all. Look for ‘no photo’ signs in shrines, museums, and shops, and always ask before photographing people or private property.",
  },

  // ---------- Korea ----------
  {
    id: 20,
    country: "Korea",
    category: "General",
    question: "Do I need a visa to visit South Korea?",
    answer:
      "Many nationalities can enter visa-free for short stays, but rules change often. Check the latest entry requirements on the official immigration or embassy website before you travel.",
  },
  {
    id: 21,
    country: "Korea",
    category: "Transport",
    question: "How do I get around Seoul?",
    answer:
      "Seoul has an excellent subway and bus network. A T-money or Cashbee card lets you tap in and out on most public transport and can be reloaded at convenience stores.",
  },
  {
    id: 22,
    country: "Korea",
    category: "Costs",
    question: "Is South Korea budget-friendly?",
    answer:
      "Street food, kimbap shops, and public transport are very affordable. Accommodation in popular districts can be pricier, especially during cherry blossom and autumn foliage seasons.",
  },
  {
    id: 23,
    country: "Korea",
    category: "Safety",
    question: "Is tap water safe to drink in South Korea?",
    answer:
      "Tap water is generally treated and safe, but many locals prefer filtered or bottled water. If you have a sensitive stomach, stick to filtered water while adjusting.",
  },

  // ---------- France ----------
  {
    id: 40,
    country: "France",
    category: "General",
    question: "Do I need to speak French to travel in France?",
    answer:
      "In Paris and major tourist areas, many people speak some English. Learning basic French greetings and phrases goes a long way and is appreciated by locals.",
  },
  {
    id: 41,
    country: "France",
    category: "Safety",
    question: "Is pickpocketing common in Paris?",
    answer:
      "Unfortunately, yes, especially around crowded attractions and on the metro. Keep valuables in zipped bags, avoid back pockets, and be cautious if someone tries to distract you.",
  },

  // ---------- Thailand ----------
  {
    id: 60,
    country: "Thailand",
    category: "General",
    question: "When is the best time to visit Thailand?",
    answer:
      "Cool and dry season (Nov–Feb) is the most comfortable. Hot season (Mar–May) is very warm, while the rainy season (Jun–Oct) has showers but fewer crowds and lower prices.",
  },
  {
    id: 61,
    country: "Thailand",
    category: "Safety",
    question: "Are street foods safe to eat in Thailand?",
    answer:
      "Street food is a highlight. Choose busy stalls with high turnover, food cooked to order, and clean utensils. Avoid items that have been sitting out for a long time.",
  },

  // ---------- Australia ----------
  {
    id: 80,
    country: "Australia",
    category: "General",
    question: "How long should I spend in Australia?",
    answer:
      "Australia is huge. For a first-time trip, 10–14 days lets you see 2–3 regions (for example Sydney, Melbourne, and the Great Barrier Reef) without rushing.",
  },
  {
    id: 81,
    country: "Australia",
    category: "Safety",
    question: "Are there many dangerous animals in Australia?",
    answer:
      "Australia has dangerous wildlife, but encounters are rare in cities and tourist areas. Follow local advice at beaches and hiking trails, and obey warning signs.",
  },

  // ---------- Indonesia ----------
  {
    id: 100,
    country: "Indonesia",
    category: "General",
    question: "Is Bali the only place worth visiting in Indonesia?",
    answer:
      "Not at all. Bali is popular, but Indonesia also offers Yogyakarta’s temples, Komodo National Park, Lombok, the Gili Islands, and many lesser-known islands.",
  },
  {
    id: 101,
    country: "Indonesia",
    category: "Transport",
    question: "How do I get around Bali?",
    answer:
      "Many visitors hire a driver for day trips or use ride-hailing apps in busy areas. Scooter rental is common but only recommended if you have experience and proper insurance.",
  },

  // ---------- China ----------
  {
    id: 120,
    country: "China",
    category: "General",
    question: "Do popular apps work in mainland China?",
    answer:
      "Some Western apps and websites are blocked. Download any tools you need before arrival and consider local apps for maps, messaging, and ride-hailing.",
  },
  {
    id: 121,
    country: "China",
    category: "Costs",
    question: "Is China a cashless society?",
    answer:
      "Mobile payments are very common. Tourists can now use international cards to top up popular payment apps, but it’s still useful to carry some cash for small shops.",
  },

  // ---------- Taiwan ----------
  {
    id: 140,
    country: "Taiwan",
    category: "Transport",
    question: "How easy is it to travel around Taiwan?",
    answer:
      "Taiwan has reliable trains, high-speed rail between major cities, and convenient intercity buses. An EasyCard or iPASS works on most local transport.",
  },
  {
    id: 141,
    country: "Taiwan",
    category: "General", // changed from "Food" to keep types valid
    question: "Are night markets safe to eat at?",
    answer:
      "Night markets are a big part of Taiwanese culture. Choose stalls with a steady flow of customers and eat food that’s cooked fresh in front of you.",
  },

  // ---------- Malaysia ----------
  {
    id: 160,
    country: "Malaysia",
    category: "General",
    question:
      "Is Malaysia suitable for first-time travellers to Southeast Asia?",
    answer:
      "Yes. Malaysia has good infrastructure, widespread English, and a mix of modern cities and nature, making it beginner-friendly.",
  },
  {
    id: 161,
    country: "Malaysia",
    category: "Costs",
    question: "Is Malaysia affordable?",
    answer:
      "Food and public transport are generally cheap, while accommodation ranges from budget hostels to luxury hotels. Your budget can stretch quite far here.",
  },

  // ---------- United States ----------
  {
    id: 180,
    country: "United States",
    category: "Transport",
    question: "Do I need a car to travel in the US?",
    answer:
      "Outside major cities like New York, Chicago, and San Francisco, public transport can be limited. Renting a car is often the most practical way to explore.",
  },
  {
    id: 181,
    country: "United States",
    category: "Costs",
    question: "Is tipping required in the United States?",
    answer:
      "Yes. In restaurants, 15–20% of the pre-tax bill is standard. You’re also expected to tip bartenders, guides, drivers, and hotel staff for good service.",
  },
];

const CATEGORY_TABS: (FAQCategory | "All")[] = [
  "All",
  "General",
  "Transport",
  "Costs",
  "Safety",
  "Photos",
];

const FAQ_PAGE_SIZE = 8;

// COMMUNITY_FAQ_API uses the API_BASE defined at top of file  
const COMMUNITY_FAQ_API = `${API_BASE}/f2/community_faq/`;

// --------------- helpers ---------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeFaqRow(row: unknown): FAQItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  const id = toNumber(r.id);
  const country = isNonEmptyString(r.country) ? r.country.trim() : "";
  const category = isNonEmptyString(r.category) ? r.category.trim() : "";
  const question = isNonEmptyString(r.question) ? r.question.trim() : "";
  const answer = isNonEmptyString(r.answer) ? r.answer.trim() : "";

  if (!id || !country || !category || !question || !answer) return null;
  return { id, country, category, question, answer };
}

async function fetchFAQItems(): Promise<FAQItem[]> {
  const res = await fetch(COMMUNITY_FAQ_API, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} – ${text.slice(0, 140)}…`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Expected JSON but got '${contentType}'. First part of response: ${text.slice(
        0,
        140
      )}…`
    );
  }

  const raw = (await res.json()) as unknown[];
  return raw
    .map((row: unknown) => normalizeFaqRow(row))
    .filter((x: FAQItem | null): x is FAQItem => x !== null);
}

// --------------- page ---------------

export default function DiscoveryFAQ() {
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [openQuestionId, setOpenQuestionId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const items = await fetchFAQItems();
        if (cancelled) return;

        setFaqItems(items);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load FAQs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const COUNTRY_LIST = useMemo(() => {
    const map = new Map<string, number>();
    for (const faq of faqItems) {
      map.set(faq.country, (map.get(faq.country) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.country.localeCompare(b.country);
      });
  }, [faqItems]);

  const countrySearchLower = countrySearch.trim().toLowerCase();
  const filteredCountries = useMemo(() => {
    if (!countrySearchLower) return COUNTRY_LIST;
    return COUNTRY_LIST.filter((c) =>
      c.country.toLowerCase().startsWith(countrySearchLower)
    );
  }, [COUNTRY_LIST, countrySearchLower]);

  const faqsForCountry = useMemo(() => {
    if (!selectedCountry) return [];
    return faqItems.filter((f) => f.country === selectedCountry);
  }, [faqItems, selectedCountry]);

  // ✅ dynamic categories from DB + auto include any new category
  const categoryTabs = useMemo(() => {
    if (!selectedCountry) return ["All"];

    const counts = new Map<string, number>();
    for (const f of faqsForCountry) {
      const cat = (f.category || "").trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }

    const sorted = Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.category.localeCompare(b.category);
      })
      .map((x) => x.category);

    return ["All", ...sorted];
  }, [selectedCountry, faqsForCountry]);

  useEffect(() => {
    if (!selectedCountry) {
      setActiveCategory("All");
      return;
    }
    if (!categoryTabs.includes(activeCategory)) {
      setActiveCategory("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry, categoryTabs]);

  const filteredFaqsForCountry = useMemo(() => {
    if (!selectedCountry) return [];
    if (activeCategory === "All") return faqsForCountry;
    return faqsForCountry.filter((f) => f.category === activeCategory);
  }, [selectedCountry, faqsForCountry, activeCategory]);

  const handleOpenCountry = (country: string) => {
    setSelectedCountry(country);
    setActiveCategory("All");
    const first = faqItems.find((f) => f.country === country);
    setOpenQuestionId(first ? first.id : null);
  };

  const handleBackToCountries = () => {
    setSelectedCountry(null);
    setActiveCategory("All");
    setOpenQuestionId(null);
  };

  const renderTopTabs = () => (
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
        FAQ
      </button>
    </div>
  );

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
          <p style={{ color: "#555", marginBottom: "1.4rem" }}>
            Discover journeys. Inspire adventures.
          </p>

          {renderTopTabs()}

          <h2
            style={{
              marginTop: "1.6rem",
              fontSize: "1.6rem",
              fontWeight: 700,
              marginBottom: "0.4rem",
            }}
          >
            Frequently Asked Questions
          </h2>
          <p style={{ color: "#777", fontSize: "0.95rem" }}>
            {selectedCountry
              ? `Find answers to common questions about ${selectedCountry}.`
              : "Find answers to common questions about popular destinations."}
          </p>
        </header>

        {loading && (
          <p style={{ textAlign: "center", color: "#555" }}>Loading FAQs…</p>
        )}

        {!loading && error && (
          <p
            style={{
              textAlign: "center",
              color: "#b91c1c",
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            {selectedCountry ? (
              <CountryFAQView
                key={selectedCountry + activeCategory}
                faqs={filteredFaqsForCountry}
                categoryTabs={categoryTabs}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                openQuestionId={openQuestionId}
                setOpenQuestionId={setOpenQuestionId}
                onBack={handleBackToCountries}
              />
            ) : (
              <CountryGridView
                countries={filteredCountries}
                search={countrySearch}
                setSearch={setCountrySearch}
                onSelectCountry={handleOpenCountry}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ------------------ Country grid ------------------

type CountryGridProps = {
  countries: { country: string; count: number }[];
  search: string;
  setSearch: (s: string) => void;
  onSelectCountry: (country: string) => void;
};

function CountryGridView({
  countries,
  search,
  setSearch,
  onSelectCountry,
}: CountryGridProps) {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "2rem",
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by country..."
          style={{
            width: "100%",
            maxWidth: "320px",
            padding: "0.5rem 0.9rem",
            borderRadius: "999px",
            border: "1px solid #d0d0dc",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
      </div>

      {countries.length === 0 && (
        <p style={{ textAlign: "center", color: "#555" }}>
          No countries match your search.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {countries.map((c) => (
          <button
            key={c.country}
            onClick={() => onSelectCountry(c.country)}
            style={{
              position: "relative",
              borderRadius: "20px",
              padding: 0,
              height: "190px",
              cursor: "pointer",
              border: "none",
              textAlign: "left",
              background: "#ececff",
              boxShadow:
                "0 14px 30px rgba(15, 23, 42, 0.12), 0 0 1px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "0.9rem",
                left: "0.9rem",
                padding: "4px 10px",
                borderRadius: "999px",
                fontSize: "0.75rem",
                backgroundColor: "#f5f5ff",
                border: "1px solid #d4d4f5",
                color: "#444",
              }}
            >
              {c.count} FAQ{c.count === 1 ? "" : "s"}
            </div>

            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "flex-end",
                padding: "0 1.1rem 1.1rem",
              }}
            >
              <span
                style={{ fontSize: "1.05rem", fontWeight: 600, color: "#222" }}
              >
                {c.country}
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// ------------------ Country FAQ list ------------------

type CountryFAQViewProps = {
  faqs: FAQItem[];
  categoryTabs: string[];
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  openQuestionId: number | null;
  setOpenQuestionId: (id: number | null) => void;
  onBack: () => void;
};

function CountryFAQView({
  faqs,
  categoryTabs,
  activeCategory,
  setActiveCategory,
  openQuestionId,
  setOpenQuestionId,
  onBack,
}: CountryFAQViewProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(faqs.length / FAQ_PAGE_SIZE) || 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * FAQ_PAGE_SIZE;
  const pagedFaqs = faqs.slice(startIndex, startIndex + FAQ_PAGE_SIZE);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "1.5rem",
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: "none",
            background: "transparent",
            color: "#555",
            fontSize: "0.85rem",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          ← Back to countries
        </button>
      </div>

      {/* scrollable tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            padding: "0.1rem 0.2rem",
            overflowX: "auto",
            overflowY: "hidden",
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch",
            maxWidth: "100%",
          }}
        >
          {categoryTabs.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setPage(1);
                  setOpenQuestionId(null);
                }}
                style={{
                  flex: "0 0 auto",
                  borderRadius: "999px",
                  border: isActive ? "none" : "1px solid #d0d0dc",
                  padding: "0.35rem 0.9rem",
                  fontSize: "1.05rem",
                  cursor: "pointer",
                  background: isActive ? "#111" : "#fff",
                  color: isActive ? "#fff" : "#333",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {faqs.length === 0 ? (
        <p style={{ color: "#555" }}>
          No FAQs found for this combination yet. Try a different category.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {pagedFaqs.map((faq) => {
              const isOpen = openQuestionId === faq.id;
              return (
                <div
                  key={faq.id}
                  style={{
                    borderRadius: "12px",
                    background: "#fff",
                    boxShadow:
                      "0 10px 26px rgba(15, 23, 42, 0.1), 0 0 1px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <button
                    onClick={() => setOpenQuestionId(isOpen ? null : faq.id)}
                    style={{
                      width: "100%",
                      padding: "0.95rem 1.25rem",
                      border: "none",
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: "1.45rem", fontWeight: 500, textAlign: "left" }}>
                      {faq.question}
                    </span>
                    <span
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "999px",
                        border: "1px solid #d0d0dc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1rem",
                      }}
                      aria-hidden="true"
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  <div
                    style={{
                      maxHeight: isOpen ? "300px" : "0px",
                      opacity: isOpen ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.3s ease, opacity 0.3s ease",
                      padding: isOpen ? "0 1.25rem 0.9rem" : "0 1.25rem 0",
                      fontSize: "1.15rem",
                      color: "#555",
                    }}
                  >
                    <p style={{ marginTop: "0.15rem" }}>{faq.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center" }}>
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
        </>
      )}
    </div>
  );
}
