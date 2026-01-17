// frontend/src/components/ItineraryMap.tsx
// ✅ FIXED: Better bounds handling, ensure numbered markers and routes are always visible
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

  // ✅ Compute bounds from items and photos
  const computedBounds = React.useMemo(() => {
    console.log("🔍 Computing bounds from items and photos...");
    console.log("  - items:", items.length);
    console.log("  - photos:", photos.length);
    
    const allPoints: Array<{ lat: number; lon: number }> = [];

    // Add item coordinates
    items.forEach(item => {
      if (item.lat != null && item.lon != null) {
        allPoints.push({ lat: item.lat, lon: item.lon });
      }
    });

    // Add photo coordinates
    photos.forEach(photo => {
      if (photo.lat != null && photo.lon != null) {
        allPoints.push({ lat: photo.lat, lon: photo.lon });
      }
    });

    console.log("  - Total points with coords:", allPoints.length);
    if (allPoints.length > 0) {
      console.log("  - Sample points:", allPoints.slice(0, 3));
    }

    if (allPoints.length === 0) {
      console.log("⚠️ No points with coordinates!");
      return null;
    }

    const lats = allPoints.map(p => p.lat);
    const lons = allPoints.map(p => p.lon);

    const boundsCalc = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };

    console.log("✅ Computed bounds:", boundsCalc);
    return boundsCalc;
  }, [items, photos]);

  // Use provided bounds or computed bounds
  const effectiveBounds = bounds || computedBounds;

  console.log("🗺️ ItineraryMap render:", {
    items: items.length,
    photos: photos.length,
    boundsProp: bounds,
    computedBounds: computedBounds,
    effectiveBounds: effectiveBounds
  });

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log("🏗️ Initializing map...");

    const styleUrl =
      "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: [139.6917, 35.6895], // Tokyo default
      zoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("error", (e) => {
      console.error("MapLibre error:", (e as any).error);
    });

    map.on("load", () => {
      console.log("✅ Map style loaded");
      styleReadyRef.current = true;
    });

    mapRef.current = map;

    return () => {
      console.log("🧹 Cleaning up map");
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      styleReadyRef.current = false;
      boundsAppliedRef.current = false;
    };
  }, []);

  // ✅ Apply bounds when map is ready and bounds are available
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !effectiveBounds) {
      console.log("⏳ Waiting for map or bounds...");
      return;
    }

    console.log("🎯 Bounds effect triggered");
    console.log("  - styleReady:", styleReadyRef.current);
    console.log("  - boundsApplied:", boundsAppliedRef.current);
    console.log("  - effectiveBounds:", effectiveBounds);

    const applyBounds = () => {
      if (!effectiveBounds) return;

      const { minLat, maxLat, minLon, maxLon } = effectiveBounds;

      console.log(`📐 Applying bounds: [${minLon}, ${minLat}] to [${maxLon}, ${maxLat}]`);

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
        console.log("✅ Bounds applied successfully!");
      } catch (err) {
        console.error("❌ Failed to apply bounds:", err);
      }
    };

    if (styleReadyRef.current && map.isStyleLoaded?.()) {
      console.log("✅ Style already loaded, applying bounds immediately");
      applyBounds();
    } else {
      console.log("⏳ Waiting for style to load...");
      const onLoad = () => {
        console.log("✅ Style loaded, applying bounds");
        styleReadyRef.current = true;
        applyBounds();
      };
      
      map.once("load", onLoad);
      
      return () => {
        map.off("load", onLoad);
      };
    }
  }, [effectiveBounds]);

  // Update stop markers + route when items change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    console.log("🎨 Updating markers and routes...");

    if (!styleReadyRef.current || !map.isStyleLoaded()) {
      console.log("⏳ Style not ready yet, waiting...");
      const onLoad = () => {
        styleReadyRef.current = true;
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

    console.log(`📍 Creating ${sorted.length} numbered markers...`);

    sorted.forEach((item, idx) => {
      if (item.lat == null || item.lon == null) return;

      const seq = item.sort_order ?? (idx + 1);
      const dayIdx = item.day_index ?? 1;

      const color = getMapDayColor(dayIdx);

      // ✅ Create numbered circular marker
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

      console.log(`  ✅ Marker ${seq}: ${item.title} at [${item.lon}, ${item.lat}]`);
    });

    // ✅ Route layer/source
    const removeRoute = () => {
      if (map.getLayer(ROUTE_ID)) {
        console.log("🗑️ Removing old route layer");
        map.removeLayer(ROUTE_ID);
      }
      if (map.getSource(ROUTE_ID)) {
        console.log("🗑️ Removing old route source");
        map.removeSource(ROUTE_ID);
      }
    };

    if (coords.length >= 2) {
      console.log(`🛣️ Creating route with ${coords.length} points`);

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

      console.log("✅ Route created!");
    } else {
      console.log("⚠️ Not enough points for route");
      removeRoute();
    }
  }, [items]);

  // Add photo markers when photos change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old photo markers
    photoMarkersRef.current.forEach((m) => m.remove());
    photoMarkersRef.current = [];

    if (!photos || photos.length === 0) return;

    console.log(`📸 Rendering ${photos.length} photo markers on map`);

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
      el.style.zIndex = "50";

      // Hover effect
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.1)";
        el.style.zIndex = "200";
      });

      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        el.style.zIndex = "50";
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

      {/* Photo preview modal */}
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