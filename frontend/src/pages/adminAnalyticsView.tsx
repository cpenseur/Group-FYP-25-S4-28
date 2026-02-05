// src/pages/adminAnalyticsView.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Calendar } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import L from "leaflet";

type Stats = {
  activeUsers: number;
  newSignups: number;
  avgSessionLengthMin: number;
  itinerariesCreated: number;
  totalUsers?: number;
  totalItineraries?: number;
  totalUsersDelta?: { diff: number };
};


type CountryStat = { country: string; percent: number };
type PopularItinerary = { name: string; percent: number };

type Props = {
  // keep these optional so your old usage won’t break
  stats?: Stats;
  onApplyFilter?: (from: string, to: string) => void;
  countryStats?: CountryStat[];
  popularItineraries?: PopularItinerary[];
  hidePopularItineraries?: boolean;
  initialFrom?: string;
  initialTo?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const ANALYTICS_ENDPOINT = `${API_BASE}/admin/analytics/`;

// ISO2 + flagcdn code (lowercase ISO2) + coords for map markers
const COUNTRY_META: Record<string, { code: string; flag: string; coords?: [number, number] }> = {
  // Asia
  Singapore: { code: "SG", flag: "sg", coords: [1.3521, 103.8198] },
  Thailand: { code: "TH", flag: "th", coords: [13.7563, 100.5018] },
  Malaysia: { code: "MY", flag: "my", coords: [3.139, 101.6869] },
  Indonesia: { code: "ID", flag: "id", coords: [-6.2088, 106.8456] },
  Vietnam: { code: "VN", flag: "vn", coords: [21.0278, 105.8342] },
  Philippines: { code: "PH", flag: "ph", coords: [14.5995, 120.9842] },
  "South Korea": { code: "KR", flag: "kr", coords: [37.5665, 126.978] },
  Korea: { code: "KR", flag: "kr", coords: [37.5665, 126.978] },
  Taiwan: { code: "TW", flag: "tw", coords: [25.033, 121.5654] },
  "Hong Kong": { code: "HK", flag: "hk", coords: [22.3193, 114.1694] },
  China: { code: "CN", flag: "cn", coords: [39.9042, 116.4074] },
  Japan: { code: "JP", flag: "jp", coords: [35.6762, 139.6503] },
  India: { code: "IN", flag: "in", coords: [28.6139, 77.209] },

  // Europe / Americas (common ones)
  "United States": { code: "US", flag: "us", coords: [40.7128, -74.006] },
  "United Kingdom": { code: "GB", flag: "gb", coords: [51.5074, -0.1278] },
  France: { code: "FR", flag: "fr", coords: [48.8566, 2.3522] },
  "Paris, France": { code: "FR", flag: "fr", coords: [48.8566, 2.3522] },
  Italy: { code: "IT", flag: "it", coords: [41.9028, 12.4964] },
  Switzerland: { code: "CH", flag: "ch", coords: [46.8182, 8.2275] },
  
  Others: { code: "🌐", flag: "", coords: [20, 0] },
};

function normalizeCountryLabel(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "Others";
  if (s.toLowerCase() === "others") return "Others";

  // If format is "City, Country" OR "Something, Something, Country"
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1]; 
  }
  return s; 
}

function mergePercentsByKey<T extends { percent: number }>(
  items: T[],
  getKey: (x: T) => string,
  makeItem: (key: string, percent: number) => T
) {
  const map = new Map<string, number>();
  for (const it of items) {
    const key = getKey(it);
    map.set(key, (map.get(key) ?? 0) + (Number(it.percent) || 0));
  }

  return Array.from(map.entries())
    .map(([key, percent]) => makeItem(key, Math.round(percent)))
    .sort((a, b) => (b.percent || 0) - (a.percent || 0));
}


function buildLinePath(values: number[], w = 560, h = 220, pad = 20) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  return values
    .map((v, i) => {
      const x = pad + (i * innerW) / Math.max(values.length - 1, 1);
      const y = pad + innerH - ((v - min) / range) * innerH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function getMeta(country: string) {
  return COUNTRY_META[country] ?? { code: "", flag: "" };
}

type AnalyticsApiResponse = {
  active_users?: number;
  new_signups?: number;
  avg_session_length_min?: number;
  itineraries_created?: number;
  total_users?: number;
  total_itineraries?: number;
  active_users_period?: number;
  activeUsersPeriod?: number;
  active_users_series?: number[];
  active_users_prev_total?: number;

  country_stats?: { country: string; percent: number }[];
  popular_itineraries?: { place: string; percent: number }[];

  stats?: {
    activeUsers?: number;
    itinerariesCreated?: number;
    newSignups?: number;
    avgSessionLengthMin?: number;
  };
};


export default function AnalyticsView({
  stats: statsProp,
  onApplyFilter,
  countryStats: countryStatsProp,
  popularItineraries: popularProp,
  hidePopularItineraries = false,
  initialFrom,
  initialTo,
}: Props) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [analyticsFrom, setAnalyticsFrom] = useState(initialFrom || "2025-12-15");
  const [analyticsTo, setAnalyticsTo] = useState(initialTo || todayIso);

  // Update dates when props change (for export mode)
  useEffect(() => {
    if (initialFrom) setAnalyticsFrom(initialFrom);
    if (initialTo) setAnalyticsTo(initialTo);
  }, [initialFrom, initialTo]);

  const [apiStats, setApiStats] = useState<Stats>({
    activeUsers: statsProp?.activeUsers ?? 0,
    newSignups: 0,
    avgSessionLengthMin: 0,
    itinerariesCreated: statsProp?.itinerariesCreated ?? 0,
  });

  const [apiCountryStats, setApiCountryStats] = useState<CountryStat[]>(countryStatsProp ?? []);
  const [apiPopular, setApiPopular] = useState<PopularItinerary[]>(popularProp ?? []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const [activeSeries, setActiveSeries] = useState<number[]>([]);
  const [activePrevTotal, setActivePrevTotal] = useState<number>(0);

  const [hover, setHover] = useState<null | { i: number; x: number; y: number }>(null);

  const linePath = useMemo(() => buildLinePath(activeSeries), [activeSeries]);

  const areaPath = useMemo(() => {
    if (!linePath) return "";
    return `${linePath} L 540 220 L 20 220 Z`; // assumes w=560 pad=20
  }, [linePath]);

  // Keep everything inside this file: inject Leaflet CSS
  useEffect(() => {
    const id = "leaflet-css";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    // Fix marker icon urls (not required for CircleMarker, but safe)
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  console.log("ANALYTICS_ENDPOINT", ANALYTICS_ENDPOINT);

  const fetchAnalytics = async (from: string, to: string) => {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      const url = `${ANALYTICS_ENDPOINT}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "";
      const rawText = await res.text();

      // If backend sends HTML (login page / 404 / index.html), show it clearly
      if (!contentType.includes("application/json")) {
        throw new Error(
          `Analytics endpoint did not return JSON.\nURL: ${url}\nContent-Type: ${contentType}\nFirst 80 chars: ${rawText.slice(0, 80)}`
        );
      }

      const data: AnalyticsApiResponse = JSON.parse(rawText);
      console.log("analytics data full:", data);
      console.log("analytics keys:", Object.keys(data));
      console.log("analytics json:", JSON.stringify(data, null, 2));
      console.log(
        "series from API:",
        data.active_users_series,
        "all keys:",
        Object.keys(data)
      );
      setActiveSeries(data.active_users_series ?? []);
      setActivePrevTotal(Number(data.active_users_prev_total ?? 0));      

      const activeUsersPeriod =
        Number(
          data?.active_users_period ??
          data?.active_users ??
          data?.activeUsersPeriod ??
          data?.activeUsers ??
          0
        ) || 0;

      const newSignups =
        Number(data?.new_signups ?? data?.stats?.newSignups ?? 0) || 0;

      const avgSessionLengthMin =
        Number(data?.avg_session_length_min ?? data?.stats?.avgSessionLengthMin ?? 0) || 0;

      const itinerariesCreated =
        Number(data?.itineraries_created ?? data?.stats?.itinerariesCreated ?? 0) || 0;
      
      const totalUsers = Number(data?.total_users ?? 0);
      const totalItineraries = Number(data?.total_itineraries ?? 0);

      const countryStats =
        data.country_stats ?? data.countryStats ?? [];

      const popularItineraries =
        data.popular_itineraries ?? data.popularItineraries ?? [];
        
      const normalizedCountries: CountryStat[] = (countryStats ?? []).map((c: any) => ({
        country: normalizeCountryLabel(c.country),
        percent: Number(c.percent ?? 0),
      }));

      setApiCountryStats(
        mergePercentsByKey(
          normalizedCountries,
          (x) => x.country,
          (country, percent) => ({ country, percent })
        ).slice(0, 5)
      );

      const normalizedPopular: PopularItinerary[] = (popularItineraries ?? []).map((p: any) => ({
        name: normalizeCountryLabel(p.name ?? p.place ?? "Others"),
        percent: Number(p.percent ?? 0),
      }));

      setApiPopular(
        mergePercentsByKey(
          normalizedPopular,
          (x) => x.name,
          (name, percent) => ({ name, percent })
        ).slice(0, 5)
      );

      setApiStats({
        activeUsers: activeUsersPeriod,
        itinerariesCreated,
        newSignups,
        avgSessionLengthMin,
        totalUsers,
        totalItineraries,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message ?? "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load once (DB-linked) or when initial dates change
  useEffect(() => {
    fetchAnalytics(analyticsFrom, analyticsTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFrom, initialTo]);

  const computedCountryStats = useMemo<CountryStat[]>(
    () => (apiCountryStats?.length ? apiCountryStats : countryStatsProp) ?? [],
    [apiCountryStats, countryStatsProp]
  );

  const computedPopular = useMemo<PopularItinerary[]>(
    () => (apiPopular?.length ? apiPopular : popularProp) ?? [],
    [apiPopular, popularProp]
  );

  const stats = useMemo<Stats>(
    () => ({
      activeUsers: apiStats.activeUsers ?? statsProp?.activeUsers ?? 0,
      newSignups: apiStats.newSignups ?? statsProp?.newSignups ?? 0,
      avgSessionLengthMin: apiStats.avgSessionLengthMin ?? statsProp?.avgSessionLengthMin ?? 0,
      itinerariesCreated: apiStats.itinerariesCreated ?? statsProp?.itinerariesCreated ?? 0,
      totalUsers: apiStats.totalUsers ?? 0,
      totalItineraries: apiStats.totalItineraries ?? 0,
    }),
    [apiStats, statsProp]
  );

  const activeDeltaPct = useMemo(() => {
    const prev = activePrevTotal || 0;
    const curr = stats.activeUsers || 0;
    if (prev <= 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  }, [activePrevTotal, stats.activeUsers]);

  const activeIsUp = activeDeltaPct >= 0;

  const mapMarkers = useMemo(() => {
    return computedCountryStats
      .map((c) => {
        const meta = getMeta(c.country);
        if (!meta.coords) return null;
        return { ...c, coords: meta.coords };
      })
      .filter(Boolean) as Array<CountryStat & { coords: [number, number] }>;
  }, [computedCountryStats]);

  const popularMarkers = useMemo(() => {
    return computedPopular
      .map((p) => {
        const meta = getMeta(p.name);
        if (!meta.coords) return null;
        return { name: p.name, percent: p.percent, coords: meta.coords };
      })
      .filter(Boolean) as Array<{ name: string; percent: number; coords: [number, number] }>;
  }, [computedPopular]);

  const handleApply = async () => {
    // keep your old hook (if parent wants to know)
    onApplyFilter?.(analyticsFrom, analyticsTo);
    // DB-linked fetch
    await fetchAnalytics(analyticsFrom, analyticsTo);
  };

  const xLabels = useMemo(() => {
    const start = new Date(analyticsFrom + "T00:00:00");
    return activeSeries.map((_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      // short label: "Jan 14"
      return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
    });
  }, [analyticsFrom, activeSeries]);


  return (
    <div className="tm-wrap">
      {/* Header row */}
      <div className="tm-top">
        <div className="tm-titleBlock">
          <h1 className="tm-title">Analytics Overview</h1>
          <p className="tm-subtitle">
            Monitor growth, engagement and itinerary creation trends.
          </p>
          {error && <div className="tm-error">{error}</div>}
        </div>

        <div className="tm-filter">
          <div className="tm-filter-item">
            <span className="tm-filter-label">From:</span>
            <div className="tm-date-wrap">
              <input
                type="date"
                className="tm-date"
                value={analyticsFrom}
                onChange={(e) => setAnalyticsFrom(e.target.value)}
              />
              <Calendar size={14} className="tm-cal-ico" aria-hidden="true" />
            </div>
          </div>

          <div className="tm-filter-item">
            <span className="tm-filter-label">To:</span>
            <div className="tm-date-wrap">
              <input
                type="date"
                className="tm-date"
                value={analyticsTo}
                onChange={(e) => setAnalyticsTo(e.target.value)}
              />
              <Calendar size={14} className="tm-cal-ico" aria-hidden="true" />
            </div>
          </div>

          <button className="tm-apply" onClick={handleApply} disabled={loading}>
            {loading ? "Loading..." : "Apply Filter"}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="tm-kpis">
        <div className="tm-kpi">
          <div className="tm-kpi-title">ACTIVE USERS</div>
          <div className="tm-kpi-value">{stats.activeUsers.toLocaleString()}</div>
          <div className="tm-kpi-bar tm-bar-blue" />
          <div className={`tm-kpi-foot ${activeIsUp ? "tm-up" : "tm-down"}`}>
            {Math.abs(activeDeltaPct).toFixed(1)}%{" "}
            {activeIsUp ? "increase" : "decrease"} as compared to previous 7 days
          </div>
        </div>

        <div className="tm-kpi">
          <div className="tm-kpi-title">NEW SIGNUPS</div>
          <div className="tm-kpi-value">{apiStats.newSignups.toLocaleString()}</div>
          <div className="tm-kpi-bar tm-bar-pink" />
        </div>

        <div className="tm-kpi">
          <div className="tm-kpi-title">AVG. SESSION LENGTH</div>
          <div className="tm-kpi-value">{apiStats.avgSessionLengthMin.toFixed(1)} min</div>
          <div className="tm-kpi-bar tm-bar-green" />
        </div>

        <div className="tm-kpi">
          <div className="tm-kpi-title">ITINERARIES CREATED</div>
          <div className="tm-kpi-value">{stats.itinerariesCreated.toLocaleString()}</div>
          <div className="tm-kpi-bar tm-bar-purple" />
        </div>
      </div>

      {/* Main grid */}
      <div className="tm-grid">
        {/* Active users chart */}
        <section className="tm-card tm-card-active">
          <div className="tm-card-head">
            <div>
              <div className="tm-card-title">Active Users</div>
              <div className="tm-card-statrow">
                <div className="tm-stat-main">{stats.activeUsers.toLocaleString()}</div>
                <div className={`tm-trend ${activeIsUp ? "tm-up" : "tm-down"}`}>
                  {activeIsUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(activeDeltaPct).toFixed(1)}%{" "}
                  {activeIsUp ? "increase" : "decrease"} as compared to previous 7 days
                </div>
              </div>
            </div>
          </div>
          <div className="tm-chart">
            <svg
              viewBox="0 0 560 220"
              className="tm-chart-svg"
              role="img"
              aria-label="Active users trend"
              onMouseMove={(e) => {
                if (!activeSeries.length) return;

                const svg = e.currentTarget;
                const r = svg.getBoundingClientRect();

                // convert mouse position to SVG coords (viewBox 560x220)
                const mx = ((e.clientX - r.left) / r.width) * 560;
                const my = ((e.clientY - r.top) / r.height) * 220;

                // chart area matches your buildLinePath defaults: w=560, h=220, pad=20
                const pad = 20;
                const innerW = 560 - pad * 2;

                // clamp inside plot area
                const clampedX = Math.max(pad, Math.min(560 - pad, mx));

                // find nearest index
                const n = activeSeries.length;
                const t = (clampedX - pad) / Math.max(innerW, 1);
                const i = Math.round(t * (n - 1));
                const idx = Math.max(0, Math.min(n - 1, i));

                // compute point coordinates using SAME scaling as buildLinePath
                const max = Math.max(...activeSeries, 1);
                const min = Math.min(...activeSeries, 0);
                const range = Math.max(max - min, 1);
                const innerH = 220 - pad * 2;

                const x = pad + (idx * innerW) / Math.max(n - 1, 1);
                const y = pad + innerH - ((activeSeries[idx] - min) / range) * innerH;

                setHover({ i: idx, x, y });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(37,99,235,0.22)" />
                  <stop offset="100%" stopColor="rgba(37,99,235,0)" />
                </linearGradient>
              </defs>

              {/* AXES */}
              <line x1="20" y1="200" x2="540" y2="200" stroke="#cbd5e1" strokeWidth="1" />
              <line x1="20" y1="20" x2="20" y2="200" stroke="#cbd5e1" strokeWidth="1" />

              {/* Y axis ticks (0%, 50%, 100% style based on min/max) */}
              {(() => {
                if (!activeSeries.length) return null;
                const pad = 20;
                const max = Math.max(...activeSeries, 1);
                const min = Math.min(...activeSeries, 0);
                const range = Math.max(max - min, 1);
                const innerH = 220 - pad * 2;

                const ticks = 4; // 0..3 => 4 ticks
                return Array.from({ length: ticks }, (_, t) => {
                  const frac = t / (ticks - 1); // 0..1
                  const val = min + (1 - frac) * range;
                  const y = pad + frac * innerH;

                  return (
                    <g key={`y-${t}`}>
                      <line x1="20" y1={y} x2="540" y2={y} stroke="#eef2f7" strokeWidth="1" />
                      <text x="14" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                        {Math.round(val)}
                      </text>
                    </g>
                  );
                });
              })()}

              {/* X axis ticks (start / middle / end) */}
              {(() => {
                if (!activeSeries.length) return null;
                const pad = 20;
                const innerW = 560 - pad * 2;
                const n = activeSeries.length;
                const idxs = [0, Math.floor((n - 1) / 2), n - 1].filter(
                  (v, i, arr) => arr.indexOf(v) === i
                );

                return idxs.map((idx) => {
                  const x = pad + (idx * innerW) / Math.max(n - 1, 1);
                  const label = xLabels[idx] ?? "";
                  return (
                    <g key={`x-${idx}`}>
                      <line x1={x} y1="200" x2={x} y2="205" stroke="#cbd5e1" strokeWidth="1" />
                      <text x={x} y="216" textAnchor="middle" fontSize="10" fill="#94a3b8">
                        {label}
                      </text>
                    </g>
                  );
                });
              })()}

              {/* AREA + LINE */}
              {areaPath && <path d={areaPath} fill="url(#fillBlue)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="rgba(37,99,235,1)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              )}

              {/* HOVER DOT + TOOLTIP */}
              {hover && activeSeries[hover.i] != null && (
                <>
                  {/* vertical guide */}
                  <line
                    x1={hover.x}
                    y1="20"
                    x2={hover.x}
                    y2="200"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />

                  {/* point */}
                  <circle cx={hover.x} cy={hover.y} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />

                  {/* tooltip box */}
                  <g transform={`translate(${Math.min(420, hover.x + 10)}, ${Math.max(26, hover.y - 18)})`}>
                    <rect width="120" height="34" rx="8" fill="#0f172a" opacity="0.92" />
                    <text x="10" y="14" fontSize="10" fill="#e2e8f0">
                      {xLabels[hover.i] ?? ""}
                    </text>
                    <text x="10" y="27" fontSize="12" fill="#ffffff" fontWeight="700">
                      {activeSeries[hover.i]} users
                    </text>
                  </g>
                </>
              )}
            </svg>
          </div>
        </section>

        {/* Right panel */}
        <section className="tm-card tm-card-map">
        <div className="tm-card-head tm-head-split">
          <div className="tm-demo-head">
            <div className="tm-card-title">User Demographics</div>

            <div className="tm-demo-top">
              {/* LEFT: total users + joined this week */}
              <div className="tm-demo-left">
                <div className="tm-demo-big">{(stats.totalUsers ?? 0).toLocaleString()}</div>
                <div className="tm-trend tm-down">
                  <ArrowDownRight size={14} /> {stats.newSignups.toLocaleString()} joined this week
                </div>
              </div>

              {/* RIGHT: total itineraries */}
              <div className="tm-demo-right">
                <div className="tm-world-big">{(stats.totalItineraries ?? 0).toLocaleString()}</div>
                <div className="tm-world-small">itineraries worldwide</div>
              </div>
            </div>
          </div>
        </div>
          {/* CLEAN GREY MAP */}
          <div className="tm-mapwrap tm-leaflet tm-clean-map">
            <MapContainer
              center={[20, 0]}
              zoom={2}
              scrollWheelZoom={false}
              dragging={true}
              zoomControl={false}
              style={{ height: "100%", width: "100%" }}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

            {mapMarkers.map((m) => (
              <CircleMarker key={`mini-${m.country}`} center={m.coords} radius={6} pathOptions={{ color: "#2563eb" }}>
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  {m.country} — {m.percent}%
                </Tooltip>
              </CircleMarker>
            ))}
            </MapContainer>
          </div>

          {/* Country list */}
          <div className="tm-created">
            <div className="tm-countrylist">
              {computedCountryStats.map((c) => {
                const meta = getMeta(c.country);
                const flagUrl = meta.flag ? `https://flagcdn.com/w20/${meta.flag}.png` : "";
                return (
                  <div key={c.country} className="tm-countryrow">
                    <div className="tm-countryleft">
                      {flagUrl ? (
                        <img className="tm-flagimg" src={flagUrl} alt={`${c.country} flag`} />
                      ) : (
                        <span className="tm-flagimg tm-flagfallback">🌐</span>
                      )}
                      <span className="tm-countryname">{c.country}</span>
                    </div>
                    <div className="tm-countryright">
                      <span className="tm-cpct">{c.percent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Popular itineraries */}
        {!hidePopularItineraries && (
        <section className="tm-card tm-card-popular">
          <div className="tm-card-head">
            <div>
              <div className="tm-card-title">Popular Itineraries</div>
              <div className="tm-muted">Total itineraries</div>
            </div>
          </div>

          <div className="tm-popGrid">
            <div className="tm-popLeft">
              <div className="tm-popCountryList">
                {computedPopular.map((p) => {
                  const meta = getMeta(p.name);
                  const flagUrl = meta.flag ? `https://flagcdn.com/w20/${meta.flag}.png` : "";

                  return (
                    <div key={p.name} className="tm-popCountryRow">
                      <div className="tm-popCountryLeft">
                        {flagUrl ? (
                          <img className="tm-flagimg" src={flagUrl} alt={`${p.name} flag`} />
                        ) : (
                          <span className="tm-flagimg tm-flagfallback">🌐</span>
                        )}
                        <span className="tm-countryname">{p.name}</span>
                      </div>

                      <div className="tm-popCountryRight">
                        <div className="tm-popbar">
                          <div className="tm-popfill" style={{ width: `${p.percent}%` }} />
                        </div>
                        <div className="tm-poppct">{p.percent}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="tm-popMap tm-leaflet tm-clean-map">
              <MapContainer
                center={[20, 0]}
                zoom={1}
                scrollWheelZoom={true}
                dragging={false}
                doubleClickZoom={true}
                zoomControl={false}
                touchZoom={true}
                boxZoom={false}
                keyboard={false}
                style={{ height: "100%", width: "100%" }}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              {popularMarkers.map((m) => (
                <CircleMarker key={`mini-${m.name}`} center={m.coords} radius={6} pathOptions={{ color: "#2563eb" }}>
                  <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                    {m.name} — {m.percent}%
                  </Tooltip>
                </CircleMarker>
              ))}
              </MapContainer>
            </div>
          </div>
        </section>
        )}
      </div>

      <style>{`
        .tm-wrap{
          padding: 0;
          background: transparent;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
          color: #0f172a;
        }

        .tm-top{
          display:grid;
          grid-template-columns: 1fr 420px;
          gap: 16px;
          align-items:start;
          margin-bottom: 14px;
        }
        .tm-titleBlock{ min-width: 0; }
        .tm-title{
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
        }
        .tm-subtitle{
          margin: 0.2rem 0 0;
          color: #6b7280;
          font-size: 0.9rem;
          font-weight: 400;
          line-height: 1.45;
          max-width: 520px;
        }
        .tm-error{
          margin-top: 8px;
          font-size: 12px;
          font-weight: 800;
          color: #ef4444;
        }
        .tm-substat-label{
          color:#ef4444;
          font-weight: 900;
        }
        .tm-filter{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          justify-items: stretch;
        }
        .tm-filter-item{ display:flex; align-items:center; gap:8px; }
        .tm-filter-label{ font-size: 12px; font-weight: 800; color:#64748b; }
        .tm-date-wrap{ position:relative; display:flex; align-items:center; }
        .tm-date{
          height: 34px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          padding: 0 34px 0 12px;
          font-size: 12px;
          background:#fff;
          color:#0f172a;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }
        .tm-date::-webkit-calendar-picker-indicator{
          opacity: 0;
          display: none;
        }
        .tm-cal-ico{
          position:absolute;
          right: 10px;
          color:#94a3b8;
          pointer-events:none;
        }
        .tm-apply{
          grid-column: 1 / -1;
          justify-self: end;
          width: fit-content;

          height: 36px;
          padding: 0 16px;
          border-radius: 999px;
          border: none;
          background: #2563eb;
          color: #fff;
          font-weight: 900;
          cursor: pointer;

          box-shadow: 0 10px 18px rgba(37, 99, 235, 0.25);
          transition: transform 0.12s ease, filter 0.12s ease;
          position: relative;
          z-index: 5;
        }
        .tm-apply:disabled{
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }
        .tm-apply:hover{ filter: brightness(1.03); transform: translateY(-1px); }
        .tm-apply:active{ transform: translateY(0px); }

        .tm-kpis{
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }
        .tm-kpi{
          background:#fff;
          border: 1px solid #e8eef7;
          border-radius: 16px;
          padding: 14px 16px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
        }
        .tm-kpi-title{
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
          color:#64748b;
        }
        .tm-kpi-value{
          font-size: 22px;
          font-weight: 1000;
          margin-top: 6px;
        }
        .tm-kpi-bar{
          height: 8px;
          border-radius: 999px;
          margin-top: 10px;
          width: 70%;
          background: #e5e7eb;
          overflow:hidden;
        }
        .tm-demo-top{
          display:flex;
          justify-content: space-between;
          align-items:flex-start;
          gap: 12px;
          margin-top: 8px;
          width: 100%;
        }
        .tm-demo-head { 
          width: 100%; 
        }
        .tm-demo-left{
          display:flex;
          flex-direction: column;
          gap: 6px;
        }

        .tm-demo-right{
          margin-left: auto;
          text-align: right;
        }

        .tm-demo-big{
          font-size: 18px;
          font-weight: 1000;
          line-height: 1;
        }

        .tm-bar-blue{ background: linear-gradient(90deg, #cfe0ff, #2563eb); }
        .tm-bar-pink{ background: linear-gradient(90deg, #ffd6ea, #ec4899); }
        .tm-bar-green{ background: linear-gradient(90deg, #bbf7d0, #16a34a); }
        .tm-bar-purple{ background: linear-gradient(90deg, #ddd6fe, #7c3aed); }

        .tm-kpi-foot{
          margin-top: 10px;
          font-size: 12px;
          color:#94a3b8;
          font-weight: 700;
        }

        .tm-grid{
          display:grid;
          grid-template-columns: 1.35fr 1fr;
          grid-template-areas:
            "active map"
            "popular map";
          gap: 12px;
        }

        .tm-card{
          background:#fff;
          border: 1px solid #e8eef7;
          border-radius: 16px;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
          padding: 16px;
          box-sizing: border-box;
        }
        .tm-card-active{ grid-area: active; }
        .tm-card-map{ grid-area: map; }
        .tm-card-popular{ grid-area: popular; }

        .tm-card-title{ font-weight: 900; color:#0f172a; font-size: 14px; }
        .tm-muted{ font-size: 12px; color:#94a3b8; margin-top: 3px; font-weight: 700; }

        .tm-card-head{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px; }
        .tm-card-statrow{ display:flex; align-items:center; gap:10px; margin-top: 6px; }
        .tm-stat-main{ font-size: 18px; font-weight: 1000; }
        .tm-trend{ display:inline-flex; align-items:center; gap:6px; font-size: 12px; font-weight: 900; }
        .tm-up{ color:#16a34a; }
        .tm-down{ color:#ef4444; }

        .tm-chart{
          margin-top: 10px;
          background:#f7faff;
          border-radius: 14px;
          padding: 10px;
          border: 1px solid #eef2ff;
        }
        .tm-chart-svg{ width: 100%; height: 190px; display:block; }
        .tm-pct{ font-size: 12px; font-weight: 900; fill:#94a3b8; }
        .tm-pct-muted{ fill:#94a3b8; }

        .tm-substat{
          margin-top: 6px;
          font-size: 12px;
          color:#64748b;
          font-weight: 800;
          display:flex;
          gap:8px;
          align-items:center;
        }
        .tm-substat-num{ color:#0f172a; font-weight: 1000; }

        .tm-worldstat{ text-align:right; }
        .tm-world-big{ font-size: 24px; font-weight: 1000; line-height: 1; }
        .tm-world-small{ font-size: 11px; color:#94a3b8; font-weight: 800; }

        .tm-mapwrap{
          position:relative;
          height: 220px;
          border-radius: 14px;
          background:#f8fafc;
          border: none;
          overflow:hidden;
          margin-top: 8px;
        }

        .tm-leaflet{
          overflow: hidden;
          border-radius: 14px;
          border: 1px solid #eef2f7;
          background: #f8fafc;
        }
        .tm-leaflet .leaflet-container{
          height: 100%;
          width: 100%;
          background: #f8fafc;
        }
        .tm-leaflet .leaflet-control-container{ display: none; }

        .tm-clean-map .leaflet-tile{
          filter: grayscale(1) contrast(0.95) brightness(1.08);
          opacity: 0.9;
        }

        .tm-created{ margin-top: 10px; }
        .tm-countrylist{ display:flex; flex-direction:column; gap: 10px; }
        .tm-countryrow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eef2f7;
        }
        .tm-countryrow:last-child{ border-bottom:none; padding-bottom: 0; }

        .tm-countryleft{ display:flex; align-items:center; gap: 10px; }
        .tm-flagimg{
          width: 20px;
          height: 14px;
          border-radius: 3px;
          display:inline-block;
          object-fit: cover;
          box-shadow: 0 1px 2px rgba(15,23,42,0.12);
        }
        .tm-flagfallback{
          display:flex;
          align-items:center;
          justify-content:center;
          background:#f1f5f9;
          border: 1px solid #e2e8f0;
          font-size: 12px;
        }
        .tm-countryname{ font-size: 13px; font-weight: 900; color:#0f172a; }
        .tm-cpct{ width: 42px; text-align:right; font-size: 12px; font-weight: 1000; color:#0f172a; }

        /* Popular layout */
        .tm-popGrid{
          display: grid;
          grid-template-columns: 1fr 260px;
          gap: 12px;
          margin-top: 10px;
          align-items: stretch;
        }
        .tm-popMap{
          height: 140px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #eef2f7;
          background: #f8fafc;
        }
        .tm-popCountryList{
          margin-top: 12px;
          display:flex;
          flex-direction: column;
          gap: 12px;
        }
        .tm-popCountryRow{
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap: 14px;
        }
        .tm-popCountryLeft{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width: 0;
        }
        .tm-popCountryRight{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width: 160px;
        }
        .tm-popbar{
          flex:1;
          height: 10px;
          background:#eef2f7;
          border-radius: 999px;
          overflow:hidden;
        }
        .tm-popfill{
          height:100%;
          background:#22c55e;
          border-radius: 999px;
        }
        .tm-poppct{
          width: 44px;
          text-align:right;
          font-size: 13px;
          font-weight: 1000;
          color:#0f172a;
        }

        @media (max-width: 1100px){
          .tm-kpis{ grid-template-columns: repeat(2, minmax(0,1fr)); }
          .tm-top{
            display:flex;
            align-items:flex-start;
            justify-content: space-between;
            gap: 16px;
          }
          .tm-filter{
            display:flex;
            align-items:center;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          .tm-popGrid{ grid-template-columns: 1fr; }
          .tm-popMap{ height: 180px; }
        }
      `}</style>
    </div>
  );
}
