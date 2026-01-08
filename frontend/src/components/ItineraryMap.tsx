// frontend/src/components/ItineraryMap.tsx
/*
import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

export type MapItineraryItem = {
  id: number;
  title: string;
  address?: string | null;
  lat: number | null;
  lon: number | null;
  sort_order?: number | null;   // global sequence 1..N
  day_index?: number | null;    // which day (for color)
  stop_index?: number | null;   // stop number within that day
};

type ItineraryMapProps = {
  items: MapItineraryItem[];
};

const mapDayColorPalette = [
  "#746ee5ff", // indigo
  "#b13171ff", // pink
  "#2fa57eff", // emerald
  "#eb904eff", // orange
  "#56acd4ff", // sky
  "#bc78fbff", // purple
];

function getMapDayColor(dayIndex: number | null | undefined): string {
  if (!dayIndex || dayIndex <= 0) return "#4f46e5";
  const idx =
    ((dayIndex - 1) % mapDayColorPalette.length +
      mapDayColorPalette.length) %
    mapDayColorPalette.length;
  return mapDayColorPalette[idx];
}

const ItineraryMap: React.FC<ItineraryMapProps> = ({ items }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultCenter: [number, number] = [103.8198, 1.3521];
    const styleUrl =
      "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: defaultCenter,
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("error", (e) => {
      console.error("MapLibre error:", (e as any).error);
    });

    mapRef.current = map;
  }, []);

  // Update markers + route when items change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const coords: [number, number][] = [];

    const sorted = [...items].sort((a, b) => {
      const sa = a.sort_order ?? 0;
      const sb = b.sort_order ?? 0;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });

    sorted.forEach((item) => {
      if (item.lat == null || item.lon == null) return;

      const seq = item.sort_order ?? 0; // global sequence
      const dayIdx = item.day_index ?? 1;
      const stopIdx = item.stop_index ?? null;

      const color = getMapDayColor(dayIdx);

      const el = document.createElement("div");
      el.style.width = "26px";
      el.style.height = "26px";
      el.style.borderRadius = "999px";
      el.style.background = color;
      el.style.color = "white";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "11px";
      el.style.fontWeight = "600";
      el.style.boxShadow = "0 2px 6px rgba(15,23,42,0.35)";
      el.textContent = seq ? String(seq) : "";

      const dayLabel = item.day_index ? `Day ${item.day_index}` : "";
      const stopLabel = stopIdx ? ` · Stop ${stopIdx}` : "";

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lon, item.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>${seq ? seq + ". " : ""}${item.title}</strong><br/>
            ${dayLabel}${stopLabel}<br/>
            ${item.address || ""}`
          )
        )
        .addTo(map);

      markersRef.current.push(marker);
      coords.push([item.lon, item.lat]);
    });

    if (coords.length) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c as any),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 13 });
    }

    const ROUTE_ID = "itinerary-route";

    if (coords.length >= 2) {
      const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
        properties: {},
      };

      if (map.getSource(ROUTE_ID)) {
        (map.getSource(ROUTE_ID) as maplibregl.GeoJSONSource).setData(
          routeGeoJson
        );
      } else {
        map.addSource(ROUTE_ID, {
          type: "geojson",
          data: routeGeoJson,
        });

        map.addLayer({
          id: ROUTE_ID,
          type: "line",
          source: ROUTE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#4f46e5",
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });
      }
    } else {
      if (map.getLayer("itinerary-route")) {
        map.removeLayer("itinerary-route");
      }
      if (map.getSource("itinerary-route")) {
        map.removeSource("itinerary-route");
      }
    }
  }, [items]);

  return (
    <div
      ref={mapContainerRef}
      style={{ width: "100%", height: "100%", minHeight: "520px" }}
    />
  );
};

export default ItineraryMap;
*/
// frontend/src/components/ItineraryMap.tsx
// frontend/src/components/ItineraryMap.tsx
// frontend/src/components/ItineraryMap.tsx
import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapItineraryItem = {
  id: number;
  title: string;
  address?: string | null;
  lat: number | null;
  lon: number | null;
  sort_order?: number | null; // global sequence 1..N
  day_index?: number | null;  // which day (for color)
  stop_index?: number | null; // stop number within that day
};

// NEW: Photo marker type
export type PhotoMarker = {
  id: number;
  lat: number;
  lon: number;
  file_url: string;
  caption?: string;
  itinerary_item?: number;
};

type ItineraryMapProps = {
  items: MapItineraryItem[];
  photos?: PhotoMarker[]; // NEW: Optional photo markers
};

const mapDayColorPalette = [
  "#746ee5ff",
  "#b13171ff",
  "#2fa57eff",
  "#eb904eff",
  "#56acd4ff",
  "#bc78fbff",
];

function getMapDayColor(dayIndex: number | null | undefined): string {
  if (!dayIndex || dayIndex <= 0) return "#4f46e5";
  const idx =
    ((dayIndex - 1) % mapDayColorPalette.length + mapDayColorPalette.length) %
    mapDayColorPalette.length;
  return mapDayColorPalette[idx];
}

const ROUTE_ID = "itinerary-route";

const ItineraryMap: React.FC<ItineraryMapProps> = ({ items, photos = [] }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const photoMarkersRef = useRef<maplibregl.Marker[]>([]); // NEW: Photo markers
  const styleReadyRef = useRef(false);

  // NEW: Photo preview state
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMarker | null>(null);

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultCenter: [number, number] = [103.8198, 1.3521];
    const styleUrl =
      "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: defaultCenter,
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("error", (e) => {
      console.error("MapLibre error:", (e as any).error);
    });

    map.on("load", () => {
      styleReadyRef.current = true;
    });

    mapRef.current = map;

    return () => {
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  // Update stop markers + route when items change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!styleReadyRef.current || !map.isStyleLoaded()) {
      const onLoad = () => {
        styleReadyRef.current = true;
        setTimeout(() => {}, 0);
      };
      map.once("load", onLoad);
      return () => {
        map.off("load", onLoad);
      };
    }

    // Clear old stop markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const coords: [number, number][] = [];

    const sorted = [...(items || [])].sort((a, b) => {
      const sa = a.sort_order ?? 0;
      const sb = b.sort_order ?? 0;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });

    sorted.forEach((item) => {
      if (item.lat == null || item.lon == null) return;

      const seq = item.sort_order ?? 0;
      const dayIdx = item.day_index ?? 1;
      const stopIdx = item.stop_index ?? null;

      const color = getMapDayColor(dayIdx);

      const el = document.createElement("div");
      el.style.width = "26px";
      el.style.height = "26px";
      el.style.borderRadius = "999px";
      el.style.background = color;
      el.style.color = "white";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "11px";
      el.style.fontWeight = "600";
      el.style.boxShadow = "0 2px 6px rgba(15,23,42,0.35)";
      el.textContent = seq ? String(seq) : "";

      const dayLabel = item.day_index ? `Day ${item.day_index}` : "";
      const stopLabel = stopIdx ? ` · Stop ${stopIdx}` : "";

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lon, item.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>${seq ? seq + ". " : ""}${item.title}</strong><br/>
            ${dayLabel}${stopLabel}<br/>
            ${item.address || ""}`
          )
        )
        .addTo(map);

      markersRef.current.push(marker);
      coords.push([item.lon, item.lat]);
    });

    // Fit bounds
    if (coords.length) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c as any),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      try {
        map.fitBounds(bounds, { padding: 60, maxZoom: 13 });
      } catch {
        // ignore fit errors
      }
    }

    // Route layer/source
    const removeRoute = () => {
      if (map.getLayer(ROUTE_ID)) map.removeLayer(ROUTE_ID);
      if (map.getSource(ROUTE_ID)) map.removeSource(ROUTE_ID);
    };

    if (coords.length >= 2) {
      const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      };

      if (map.getSource(ROUTE_ID)) {
        (map.getSource(ROUTE_ID) as maplibregl.GeoJSONSource).setData(routeGeoJson);
      } else {
        map.addSource(ROUTE_ID, { type: "geojson", data: routeGeoJson });
        map.addLayer({
          id: ROUTE_ID,
          type: "line",
          source: ROUTE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#4f46e5",
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });
      }
    } else {
      removeRoute();
    }
  }, [items]);

  // NEW: Add photo markers when photos change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old photo markers
    photoMarkersRef.current.forEach((m) => m.remove());
    photoMarkersRef.current = [];

    if (!photos || photos.length === 0) return;

    photos.forEach((photo) => {
      if (!photo.lat || !photo.lon) return;

      // Create photo marker element (square thumbnail)
      const el = document.createElement("div");
      el.style.width = "50px";
      el.style.height = "50px";
      el.style.borderRadius = "8px";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.overflow = "hidden";
      el.style.backgroundImage = `url(${photo.file_url})`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
      el.style.transition = "transform 0.2s ease";

      // Hover effect
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.1)";
      });

      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      // Click to preview
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedPhoto(photo);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([photo.lon, photo.lat])
        .addTo(map);

      photoMarkersRef.current.push(marker);
    });
  }, [photos]);

  return (
    <>
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", minHeight: "520px" }}
      />

      {/* NEW: Photo preview modal */}
      {selectedPhoto && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              background: "white",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.file_url}
              alt={selectedPhoto.caption || "Trip photo"}
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "70vh",
                objectFit: "contain",
              }}
            />
            {selectedPhoto.caption && (
              <div
                style={{
                  padding: "16px",
                  fontSize: "14px",
                  color: "#111827",
                  fontWeight: 600,
                }}
              >
                {selectedPhoto.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ItineraryMap;