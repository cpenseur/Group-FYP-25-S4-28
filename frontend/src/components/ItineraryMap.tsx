// frontend/src/components/ItineraryMap.tsx
import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

export type MapItineraryItem = {
  id: number;
  title: string;
  address?: string | null;
  lat: number | null;
  lon: number | null;
  sort_order?: number | null;
};

type ItineraryMapProps = {
  items: MapItineraryItem[];
};

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

    sorted.forEach((item, idx) => {
      if (item.lat == null || item.lon == null) return;

      const marker = new maplibregl.Marker({ color: "#4f46e5" })
        .setLngLat([item.lon, item.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>${idx + 1}. ${item.title}</strong><br/>${
              item.address || ""
            }`
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
