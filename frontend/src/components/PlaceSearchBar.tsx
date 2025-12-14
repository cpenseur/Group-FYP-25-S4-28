// frontend/src/components/PlaceSearchBar.tsx
import { useEffect, useRef, useState } from "react";

export type GeocodeFeature = {
  id: string;
  text: string; // short name, e.g. "Tokyo Tower"
  place_name: string; // full label, e.g. "Tokyo Tower, Minato City, Tokyo, Japan"
  center: [number, number]; // [lon, lat]
  raw: any;
};

type Props = {
  onSelect: (feature: GeocodeFeature) => void;
};

export default function PlaceSearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const debounceRef = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ---- search helper (OpenStreetMap Nominatim) -------------------------
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
      const url =
        "https://nominatim.openstreetmap.org/search?format=geojson" +
        `&q=${encodeURIComponent(trimmed)}` +
        "&limit=5&addressdetails=1";

      const res = await fetch(url, {
        headers: {
          "Accept-Language": "en",
        },
      });

      if (!res.ok) {
        throw new Error(`Geocoding error ${res.status}`);
      }

      const data = await res.json();

      let feats: GeocodeFeature[] = (data.features || []).map(
        (f: any): GeocodeFeature => {
          const props = f.properties || {};
          const display = props.display_name || "";
          const shortName =
            props.name ||
            (display ? display.split(",")[0].trim() : "Location");

          let center: [number, number] = [0, 0];
          if (f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
            center = [f.geometry.coordinates[0], f.geometry.coordinates[1]];
          } else if (props.lon && props.lat) {
            center = [parseFloat(props.lon), parseFloat(props.lat)];
          }

          return {
            id:
              String(props.place_id ?? props.osm_id ?? f.id ?? shortName) +
              "_" +
              center.join(","),
            text: shortName,
            place_name: display || shortName,
            center,
            raw: f,
          };
        }
      );

      // ⭐ Fallback: if nothing found and we still have at least 2 tokens,
      // retry without the last (possibly incomplete) word.
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

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (!value || value.trim().length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      performSearch(value);
    }, 400);
  };

  // Enter key = choose first result (if available)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && results.length > 0) {
      handleSelect(results[0]);
    }
  };

  const handleSelect = (feat: GeocodeFeature) => {
    setShowDropdown(false);
    setResults([]);
    setQuery(feat.place_name || feat.text);
    onSelect(feat);
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (evt: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(evt.target as Node)) {
        setShowDropdown(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search destinations… (e.g. Tokyo Tower)"
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
            <div
              style={{
                padding: "0.75rem 1rem",
                fontSize: "0.85rem",
                color: "#6b7280",
              }}
            >
              Searching…
            </div>
          )}

          {errorMsg && !isLoading && (
            <div
              style={{
                padding: "0.75rem 1rem",
                fontSize: "0.85rem",
                color: "#b91c1c",
              }}
            >
              {errorMsg}
            </div>
          )}

          {!isLoading && !errorMsg && results.length === 0 && (
            <div
              style={{
                padding: "0.75rem 1rem",
                fontSize: "0.85rem",
                color: "#6b7280",
              }}
            >
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
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "#111827",
                  marginBottom: 2,
                }}
              >
                {feat.text}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#6b7280",
                }}
              >
                {feat.place_name}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
