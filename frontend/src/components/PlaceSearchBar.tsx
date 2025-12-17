import { useEffect, useRef, useState } from "react";

export type GeocodeFeature = {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  raw: any;
};

type Props = {
  onSelect: (feature: GeocodeFeature) => void;

  // ✅ bias using trip info (no ISO needed)
  biasCity?: string;
  biasCountry?: string;
};

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const q =
    s1 * s1 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(q)));
}

function getAddr(feat: GeocodeFeature) {
  return feat.raw?.properties?.address || {};
}

function rankFeature(
  feat: GeocodeFeature,
  biasCountryNorm: string,
  biasCityNorm: string,
  biasCityCenter: [number, number] | null
) {
  const addr = getAddr(feat);
  const ctry = norm(addr.country || "");
  const city =
    norm(addr.city || addr.town || addr.village || addr.municipality || "");

  const inCountry = biasCountryNorm && ctry === biasCountryNorm;
  const inCity = biasCityNorm && city === biasCityNorm;

  let dist = 999999;
  if (biasCityCenter && Array.isArray(feat.center)) {
    dist = haversineKm(biasCityCenter, feat.center);
  }

  // lower is better
  return (
    (inCountry ? 0 : 1000) +
    (inCity ? 0 : 50) +
    Math.min(dist, 500) // cap so weird far distances don't explode sort
  );
}


export default function PlaceSearchBar({ onSelect, biasCity = "", biasCountry = "" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const debounceRef = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // computed bias box around country (preferred) + optional city center
  const [biasViewbox, setBiasViewbox] = useState<string | null>(null);
  const [biasCityCenter, setBiasCityCenter] = useState<[number, number] | null>(null); // [lon, lat]

  useEffect(() => {
    let cancelled = false;

    async function geocodeJsonV2(q: string) {
      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2" +
        `&q=${encodeURIComponent(q)}` +
        "&limit=1&addressdetails=1";
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) throw new Error(`Bias geocode error ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data[0] : null;
    }

    async function buildBias() {
      const city = biasCity.trim();
      const country = biasCountry.trim();

      if (!city && !country) {
        setBiasViewbox(null);
        setBiasCityCenter(null);
        return;
      }

      try {
        // ✅ 1) Country bbox (so all in-country places are prioritised)
        if (country) {
          const c = await geocodeJsonV2(country);
          if (!cancelled && c?.boundingbox) {
            const south = parseFloat(c.boundingbox[0]);
            const north = parseFloat(c.boundingbox[1]);
            const west  = parseFloat(c.boundingbox[2]);
            const east  = parseFloat(c.boundingbox[3]);
            // viewbox expects west,north,east,south
            setBiasViewbox(`${west},${north},${east},${south}`);
          } else if (!cancelled) {
            setBiasViewbox(null);
          }
        } else {
          // no country: fallback to city bbox
          const c = await geocodeJsonV2(city);
          if (!cancelled && c?.boundingbox) {
            const south = parseFloat(c.boundingbox[0]);
            const north = parseFloat(c.boundingbox[1]);
            const west  = parseFloat(c.boundingbox[2]);
            const east  = parseFloat(c.boundingbox[3]);
            setBiasViewbox(`${west},${north},${east},${south}`);
          } else if (!cancelled) {
            setBiasViewbox(null);
          }
        }

        // ✅ 2) City center (optional): used only for ranking/boosting
        if (city) {
          const qCity = country ? `${city}, ${country}` : city;
          const c2 = await geocodeJsonV2(qCity);
          if (!cancelled && c2?.lon && c2?.lat) {
            setBiasCityCenter([parseFloat(c2.lon), parseFloat(c2.lat)]);
          } else if (!cancelled) {
            setBiasCityCenter(null);
          }
        } else if (!cancelled) {
          setBiasCityCenter(null);
        }
      } catch {
        if (!cancelled) {
          setBiasViewbox(null);
          setBiasCityCenter(null);
        }
      }
    }

    buildBias();
    return () => {
      cancelled = true;
    };
  }, [biasCity, biasCountry]);


  const mapToFeatures = (data: any): GeocodeFeature[] => {
    return (data.features || []).map((f: any): GeocodeFeature => {
      const props = f.properties || {};
      const display = props.display_name || "";
      const shortName =
        props.name || (display ? display.split(",")[0].trim() : "Location");

      let center: [number, number] = [0, 0];
      if (f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
        center = [f.geometry.coordinates[0], f.geometry.coordinates[1]];
      } else if (props.lon && props.lat) {
        center = [parseFloat(props.lon), parseFloat(props.lat)];
      }

      return {
        id: String(props.place_id ?? props.osm_id ?? f.id ?? shortName) + "_" + center.join(","),
        text: shortName,
        place_name: display || shortName,
        center,
        raw: f, // keep full raw, incl props.address
      };
    });
  };


  const uniqMerge = (a: GeocodeFeature[], b: GeocodeFeature[], limit: number) => {
    const seen = new Set<string>();
    const out: GeocodeFeature[] = [];

    const push = (x: GeocodeFeature) => {
      const key = `${norm(x.text)}__${x.center.join(",")}__${norm(x.place_name)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(x);
    };

    a.forEach(push);
    b.forEach(push);

    return out.slice(0, limit);
  };

  const fetchGeoJson = async (q: string, extra: string) => {
    const url =
      "https://nominatim.openstreetmap.org/search?format=geojson" +
      `&q=${encodeURIComponent(q)}` +
      "&addressdetails=1" +
      extra;

    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error(`Geocoding error ${res.status}`);
    return res.json();
  };

  // ---- search helper (trip-area first, then global) -------------------------
  const performSearch = async (q: string, allowFallback: boolean = true) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const biasCountryNorm = norm(biasCountry);
      const biasCityNorm = norm(biasCity);

      // 1) Country-bounded results (highest priority)
      let localFeats: GeocodeFeature[] = [];
      if (biasViewbox) {
        const dataLocal = await fetchGeoJson(
          trimmed,
          `&limit=12&viewbox=${encodeURIComponent(biasViewbox)}&bounded=1`
        );
        localFeats = mapToFeatures(dataLocal);
      }

      // 2) Global results (fallback to fill)
      let globalFeats: GeocodeFeature[] = [];
      const dataGlobal = await fetchGeoJson(trimmed, "&limit=18");
      globalFeats = mapToFeatures(dataGlobal);

      // merge + dedupe
      let feats = uniqMerge(localFeats, globalFeats, 18);

      // ✅ rank so same-country appears first, then same-city, then nearest-to-city
      feats = feats
        .map((f) => ({
          f,
          r: rankFeature(f, biasCountryNorm, biasCityNorm, biasCityCenter),
        }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.f)
        .slice(0, 5);

      // your token fallback (drop last word)
      if (feats.length === 0 && allowFallback) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const shorter = parts.slice(0, -1).join(" ");
          if (shorter.length >= 3) {
            await performSearch(shorter, false);
            return;
          }
        }
      }

      setResults(feats);
      setShowDropdown(true);
    } catch (err) {
      console.error("Geocode search failed:", err);
      setErrorMsg("Could not search locations. Please try again.");
      setResults([]);
      setShowDropdown(true);
    } finally {
      setIsLoading(false);
    }
  };


  // ---- debounced input handler -----------------------------------------
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    if (!value || value.trim().length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      performSearch(value);
    }, 400);
  };

  const handleSelect = (feat: GeocodeFeature) => {
    setShowDropdown(false);
    setResults([]);
    setQuery(feat.place_name || feat.text);
    onSelect(feat);
  };

  useEffect(() => {
    const handler = (evt: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(evt.target as Node)) setShowDropdown(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={`Search destinations…${biasCountry ? ` (prioritising ${biasCountry})` : ""}`}
        style={{
          width: "100%",
          borderRadius: "999px",
          border: "1px solid #d1d5db",
          padding: "0.55rem 1.1rem",
          fontSize: "0.9rem",
          boxShadow: "0 4px 20px rgba(15,23,42,0.12)",
          outline: "none",
        }}
      />

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            left: 0,
            right: 0,
            marginTop: 6,
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            boxShadow: "0 16px 35px rgba(15,23,42,0.30)",
            maxHeight: 260,
            overflowY: "auto",
            zIndex: 40,
          }}
        >
          {isLoading && (
            <div style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#6b7280" }}>
              Searching…
            </div>
          )}

          {errorMsg && !isLoading && (
            <div style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#b91c1c" }}>
              {errorMsg}
            </div>
          )}

          {!isLoading && !errorMsg && results.length === 0 && (
            <div style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#6b7280" }}>
              No results. Try a more specific name.
            </div>
          )}

          {results.map((feat) => (
            <button
              key={feat.id}
              type="button"
              onClick={() => handleSelect(feat)}
              style={{
                border: "none",
                background: "transparent",
                width: "100%",
                textAlign: "left",
                padding: "0.65rem 1rem",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                {feat.text}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{feat.place_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
