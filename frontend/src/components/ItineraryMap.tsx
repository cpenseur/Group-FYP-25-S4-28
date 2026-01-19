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
  sort_order?: number | null;
  day_index?: number | null;
  stop_index?: number | null;
};

export type PhotoMarker = {
  id: number;
  lat: number;
  lon: number;
  file_url: string;
  caption?: string;
  itinerary_item?: number;
};

interface MapBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

type ItineraryMapProps = {
  items: MapItineraryItem[];
  photos?: PhotoMarker[];
  bounds?: MapBounds | null;
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

const ItineraryMap: React.FC<ItineraryMapProps> = ({ 
  items, 
  photos = [],
  bounds = null
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const photoMarkersRef = useRef<maplibregl.Marker[]>([]);
  const styleReadyRef = useRef(false);
  const boundsAppliedRef = useRef(false);

  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMarker | null>(null);
  // FIX: Add state to trigger re-render when map style loads
  const [styleReady, setStyleReady] = useState(false);

  // Compute bounds from items and photos
  const computedBounds = React.useMemo(() => {
    const allPoints: Array<{ lat: number; lon: number }> = [];

    items.forEach(item => {
      if (item.lat != null && item.lon != null) {
        allPoints.push({ lat: item.lat, lon: item.lon });
      }
    });

    photos.forEach(photo => {
      if (photo.lat != null && photo.lon != null) {
        allPoints.push({ lat: photo.lat, lon: photo.lon });
      }
    });

    if (allPoints.length === 0) return null;

    const lats = allPoints.map(p => p.lat);
    const lons = allPoints.map(p => p.lon);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  }, [items, photos]);

  const effectiveBounds = bounds || computedBounds;

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const styleUrl = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: [139.6917, 35.6895],
      zoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("error", (e) => {
      console.error("MapLibre error:", (e as any).error);
    });

    // FIX: Set React state to trigger re-render of effects
    map.on("load", () => {
      styleReadyRef.current = true;
      setStyleReady(true);
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
      setStyleReady(false);
      boundsAppliedRef.current = false;
    };
  }, []);

  // Apply bounds when ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !effectiveBounds || !styleReady) return;

    const { minLat, maxLat, minLon, maxLon } = effectiveBounds;

    try {
      const bounds = new maplibregl.LngLatBounds(
        [minLon, minLat],
        [maxLon, maxLat]
      );

      map.fitBounds(bounds, {
        padding: 80,
        maxZoom: 13,
        duration: 500,
      });

      boundsAppliedRef.current = true;
    } catch (err) {
      console.error("Failed to apply bounds:", err);
    }
  }, [effectiveBounds, styleReady]);

  // Update markers and route - FIX: Wait for styleReady
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const coords: [number, number][] = [];

    const sorted = [...(items || [])].sort((a, b) => {
      const sa = a.sort_order ?? 0;
      const sb = b.sort_order ?? 0;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });

    sorted.forEach((item, idx) => {
      if (item.lat == null || item.lon == null) return;

      const seq = item.sort_order ?? (idx + 1);
      const dayIdx = item.day_index ?? 1;
      const color = getMapDayColor(dayIdx);

      // Create numbered marker
      const el = document.createElement("div");
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.borderRadius = "50%";
      el.style.background = color;
      el.style.color = "white";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "13px";
      el.style.fontWeight = "700";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.border = "2px solid white";
      el.style.cursor = "pointer";
      el.style.zIndex = "100";
      el.textContent = String(seq);

      const dayLabel = item.day_index ? `Day ${item.day_index}` : "";

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lon, item.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(
            `<div style="font-family: system-ui; padding: 4px;">
              <strong style="font-size: 14px;">${seq}. ${item.title}</strong><br/>
              ${dayLabel ? `<span style="color: #6b7280; font-size: 12px;">${dayLabel}</span><br/>` : ""}
              ${item.address ? `<span style="color: #6b7280; font-size: 11px;">${item.address}</span>` : ""}
            </div>`
          )
        )
        .addTo(map);

      markersRef.current.push(marker);
      coords.push([item.lon, item.lat]);
    });

    // Create route
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

      removeRoute();

      map.addSource(ROUTE_ID, { 
        type: "geojson", 
        data: routeGeoJson 
      });

      map.addLayer({
        id: ROUTE_ID,
        type: "line",
        source: ROUTE_ID,
        layout: { 
          "line-cap": "round", 
          "line-join": "round" 
        },
        paint: {
          "line-color": "#4f46e5",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });
    } else {
      removeRoute();
    }
  }, [items, styleReady]); // FIX: Add styleReady dependency

  // Add photo markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    photoMarkersRef.current.forEach((m) => m.remove());
    photoMarkersRef.current = [];

    if (!photos || photos.length === 0) return;

    photos.forEach((photo) => {
      if (!photo.lat || !photo.lon) return;

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
      el.style.zIndex = "50";

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.1)";
        el.style.zIndex = "200";
      });

      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        el.style.zIndex = "50";
      });

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedPhoto(photo);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([photo.lon, photo.lat])
        .addTo(map);

      photoMarkersRef.current.push(marker);
    });
  }, [photos, styleReady]); // FIX: Add styleReady dependency

  return (
    <>
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", minHeight: "520px" }}
      />

      {selectedPhoto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
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