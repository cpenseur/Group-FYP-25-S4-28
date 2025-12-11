// frontend/src/pages/itineraryEditor.tsx
import { useEffect, useRef, useState, ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";

import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDndContext,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import PlaceSearchBar, { GeocodeFeature } from "../components/PlaceSearchBar";
import TripSubHeader from "../components/TripSubHeader";
import { apiFetch } from "../lib/apiClient";

/* -------------------- Time Edit Modal -------------------- */

function TimeEditModal({
  isOpen,
  item,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  onCancel,
  onSave,
}: {
  isOpen: boolean;
  item: ItineraryItem | null;
  startValue: string;
  endValue: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!isOpen || !item) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "420px",
          background: "white",
          borderRadius: "14px",
          padding: "1.3rem 1.4rem",
          boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
          Edit Time – {item.title}
        </div>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.8rem", color: "#374151" }}>Start</label>
            <input
              type="time"
              value={startValue}
              onChange={(e) => onStartChange(e.target.value)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "0.45rem",
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.8rem", color: "#374151" }}>End</label>
            <input
              type="time"
              value={endValue}
              onChange={(e) => onEndChange(e.target.value)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "0.45rem",
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.6rem",
            marginTop: "0.75rem",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "0.45rem 1rem",
              backgroundColor: "#e5e7eb",
              border: "none",
              borderRadius: 8,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={onSave}
            style={{
              padding: "0.45rem 1rem",
              backgroundColor: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Types -------------------- */

type ItineraryItem = {
  id: number;
  title: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  sort_order: number;
  day: number | null; // TripDay PK
  start_time?: string | null;
  end_time?: string | null;
};

type TripDayResponse = {
  id: number;
  trip: number;
  date: string | null;
  day_index: number;
  note: string | null;
};

type TripResponse = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  start_date: string | null;
  end_date: string | null;
  days: TripDayResponse[];
  items: ItineraryItem[];
};

type LegInfo = {
  from_id: number;
  to_id: number;
  distance_km: number;
  duration_min: number;
};

type SelectedPlace = {
  name: string;
  fullName: string;
  address: string;
  lat: number;
  lon: number;
};

/* -------------------- Helpers -------------------- */

function formatDayHeader(day: TripDayResponse): string {
  if (!day.date) return `Day ${day.day_index}`;
  const d = new Date(day.date);
  const weekDay = d.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return `Day ${day.day_index}  ${weekDay}, ${dateStr}`;
}

function formatTimeRange(item: ItineraryItem): string {
  if (!item.start_time && !item.end_time) return "";

  const fmt = (t: string | null | undefined) =>
    t
      ? new Date(t).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const start = fmt(item.start_time);
  const end = fmt(item.end_time);

  // Only start
  if (start && !end) return start;
  // Only end
  if (!start && end) return end;
  // Both
  return `${start} – ${end}`;
}

function getItemThumbnail(item: ItineraryItem): string | null {
  // Later: plug in Unsplash / Google Places here.
  // Example (pseudo):
  // const anyItem = item as any;
  // return anyItem.photo_url || anyItem.thumbnail_url || null;
  const anyItem = item as any;
  return anyItem.photo_url || anyItem.thumbnail_url || null;
}

function getItemsForDay(
  allItems: ItineraryItem[],
  dayId: number | null
): ItineraryItem[] {
  return allItems
    .filter((i) => i.day === dayId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/* -------------------- Sortable item component -------------------- */

function SortableItineraryCard({
  item,
  children,
}: {
  item: ItineraryItem;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: isDragging ? "#eef2ff" : "white",
    boxShadow: isDragging ? "0 8px 16px rgba(15,23,42,0.18)" : "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

/* -------------------- Day Droppable with highlight + placeholder index -------------------- */

function DayDroppable({
  day,
  allItems,
  children,
}: {
  day: TripDayResponse;
  allItems: ItineraryItem[];
  children: (opts: { isOver: boolean; placeholderIndex: number | null }) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.id}`, // distinguish day droppables from item ids
  });

  const { active, over } = useDndContext();

  let placeholderIndex: number | null = null;

  if (active && over) {
    const activeId = Number(active.id);
    const overId = over.id;

    if (activeId) {
      let targetDayId: number | null = null;
      let indexInDay = 0;

      if (typeof overId === "string" && overId.startsWith("day-")) {
        // hovering the "empty" area / bottom of a day
        targetDayId = Number(overId.slice(4));
        const destList = getItemsForDay(allItems, targetDayId);
        indexInDay = destList.length;
      } else {
        const destItemId =
          typeof overId === "number" ? overId : Number(overId);
        const destItem = allItems.find((i) => i.id === destItemId);

        if (destItem && destItem.day != null) {
          targetDayId = destItem.day;
          const destList = getItemsForDay(allItems, targetDayId);
          const idx = destList.findIndex((i) => i.id === destItemId);
          indexInDay = idx === -1 ? destList.length : idx;
        }
      }

      if (targetDayId === day.id) {
        placeholderIndex = indexInDay;
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        marginBottom: "1.1rem",
        borderRadius: 12,
        paddingBottom: 4,
        backgroundColor: isOver
          ? "rgba(129,140,248,0.08)" // soft highlight when dragging over this day
          : "transparent",
        transition: "background-color 120ms ease-out",
      }}
    >
      {children({ isOver, placeholderIndex })}
    </div>
  );
}


/* -------------------- Component -------------------- */

export default function ItineraryEditor() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const numericTripId = Number(tripId);

  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [days, setDays] = useState<TripDayResponse[]>([]);
  const [legs, setLegs] = useState<LegInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimising, setIsOptimising] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    null
  );

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Day header refs for scrolling from sidebar
  const dayHeaderRefs = useRef<Map<number, HTMLDivElement | null>>(
    new Map()
  );

  /* DnD sensors */

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5, // start drag after moving 5px
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,    // ms to hold before drag starts
      tolerance: 5,  // px finger can move during delay
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  /* -------- Time Editing State -------- */
  // Time edit modal
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [timeModalItem, setTimeModalItem] = useState<ItineraryItem | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Add stop modal
  const [addStopModalOpen, setAddStopModalOpen] = useState(false);
  const [addStopDayId, setAddStopDayId] = useState<number | null>(null);
  const [modalPlace, setModalPlace] = useState<SelectedPlace | null>(null);

  // Hovered day for sidebar
  const [hoveredDayId, setHoveredDayId] = useState<number | null>(null);

  // Collapsed days
  const [collapsedDayIds, setCollapsedDayIds] = useState<number[]>([]);


  function openTimeEditor(item: ItineraryItem) {
    setTimeModalItem(item);
    setTimeModalOpen(true);

    setEditStart(item.start_time ? item.start_time.slice(11, 16) : "");
    setEditEnd(item.end_time ? item.end_time.slice(11, 16) : "");
  }

  async function saveTimeModal() {
    if (!timeModalItem) return;
    const item = timeModalItem;

    const dayObj = days.find((d) => d.id === item.day);
    if (!dayObj) return;

    const date = dayObj.date; // YYYY-MM-DD

    const startISO = editStart ? `${date}T${editStart}:00` : null;
    const endISO = editEnd ? `${date}T${editEnd}:00` : null;

    await apiFetch(`/f1/itinerary-items/${item.id}/`, {
      method: "PATCH",
      body: JSON.stringify({
        start_time: startISO,
        end_time: endISO,
      }),
    });

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, start_time: startISO, end_time: endISO }
          : i
      )
    );

    setTimeModalOpen(false);
    setTimeModalItem(null);
  }

  const toggleDayCollapse = (dayId: number) => {
    setCollapsedDayIds((prev) =>
      prev.includes(dayId)
        ? prev.filter((id) => id !== dayId)
        : [...prev, dayId]
    );
  };


  /* ------------------ Load Trip ------------------ */

  useEffect(() => {
    if (!tripId) return;

    const loadTrip = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const data: TripResponse = await apiFetch(`/f1/trips/${tripId}/`);
        setTrip(data);

        const sortedItems = [...(data.items || [])].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
        setItems(sortedItems);

        const sortedDays = [...(data.days || [])].sort(
          (a, b) => a.day_index - b.day_index
        );
        setDays(sortedDays);
      } catch (err: any) {
        console.error("Failed to load trip:", err);
        setErrorMsg("Failed to load trip itinerary.");
      } finally {
        setIsLoading(false);
      }
    };

    loadTrip();
  }, [tripId]);

  /* ------------------ INIT MAP ------------------ */

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

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

  /* ------------- Update markers + polyline ------------- */

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const coords: [number, number][] = [];

    items.forEach((item, index) => {
      if (item.lat == null || item.lon == null) return;

      const marker = new maplibregl.Marker({ color: "#4f46e5" })
        .setLngLat([item.lon, item.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>${index + 1}. ${item.title}</strong><br/>${
              item.address || ""
            }`
          )
        )
        .addTo(map);

      markersRef.current.push(marker);
      coords.push([item.lon, item.lat]);
    });

    if (coords.length > 0) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c as any),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 13 });
    }

    if (coords.length >= 2) {
      const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
        properties: {},
      };

      if (map.getSource("itinerary-route")) {
        (map.getSource("itinerary-route") as maplibregl.GeoJSONSource).setData(
          routeGeoJson
        );
      } else {
        map.addSource("itinerary-route", {
          type: "geojson",
          data: routeGeoJson,
        });

        map.addLayer({
          id: "itinerary-route",
          type: "line",
          source: "itinerary-route",
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

  /* ------------- Search selection ------------- */

  const handlePlaceSelect = (feature: GeocodeFeature) => {
    if (!mapRef.current || !feature || !feature.center) return;
    const [lon, lat] = feature.center;

    const place: SelectedPlace = {
      name: feature.text || "Selected place",
      fullName: feature.place_name || "",
      address: feature.place_name || "",
      lat,
      lon,
    };

    setSelectedPlace(place);

    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
    }

    previewMarkerRef.current = new maplibregl.Marker({ color: "#ec4899" })
      .setLngLat([lon, lat])
      .addTo(mapRef.current);

    mapRef.current.flyTo({ center: [lon, lat], zoom: 15 });
  };

  /* ------------- Optimise route ------------- */

  const optimiseRoute = async () => {
    if (!numericTripId) return;
    setIsOptimising(true);
    setErrorMsg(null);

    try {
      const data = await apiFetch("/f1/route-optimize/", {
        method: "POST",
        body: JSON.stringify({ trip_id: numericTripId, profile: "driving-car" }),
      });

      const order: number[] = data?.optimized_order || [];
      const legsData: LegInfo[] = data?.legs || [];

      if (order.length > 0) {
        setItems((prev) => {
          const itemById = new Map(prev.map((i) => [i.id, i]));
          const reordered: ItineraryItem[] = [];
          order.forEach((id, idx) => {
            const item = itemById.get(id);
            if (item) {
              reordered.push({ ...item, sort_order: idx + 1 });
            }
          });
          return reordered;
        });
      }

      setLegs(legsData);
    } catch (err: any) {
      console.error("Failed to optimise route:", err);
      setErrorMsg("Could not optimise route right now.");
    } finally {
      setIsOptimising(false);
    }
  };

  const handleOptimiseRouteClick = async () => {
    await optimiseRoute();
  };

  /* ------------- Add selected place ------------- */

  const handleAddSelectedPlace = async () => {
    if (!numericTripId || !selectedPlace) {
      setErrorMsg("Please select a destination first.");
      return;
    }

    try {
      setErrorMsg(null);
      const payload = {
        trip: numericTripId,
        title: selectedPlace.name,
        address: selectedPlace.address,
        item_type: "place",
        lat: selectedPlace.lat,
        lon: selectedPlace.lon,
        is_all_day: false,
        sort_order: items.length + 1,
        day: days.length > 0 ? days[0].id : null, // default: first day if exists
      };

      const created: ItineraryItem | null = await apiFetch(
        "/f1/itinerary-items/",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (created) {
        setItems((prev) =>
          [...prev, created].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
          )
        );
        await optimiseRoute();
      }
    } catch (err: any) {
      console.error("Error adding stop:", err);
      setErrorMsg("Could not add this stop to the itinerary. Please try again.");
    }
  };

  /* ------------- Open add stop modal ------------- */
  function openAddStopModal(dayId: number) {
    setAddStopDayId(dayId);
    setModalPlace(null); // reset previous selection
    setAddStopModalOpen(true);
  }

  /* ------------- Add stop to specific day ------------- */
  async function handleAddStopToDay(dayId: number) {
    if (!selectedPlace) {
      setErrorMsg("Select a place from the map before adding a stop.");
      return;
    }

    try {
      const payload = {
        trip: numericTripId,
        title: selectedPlace.name,
        address: selectedPlace.address,
        item_type: "place",
        lat: selectedPlace.lat,
        lon: selectedPlace.lon,
        is_all_day: false,
        day: dayId,
        sort_order: getItemsForDay(items, dayId).length + 1,
      };

      const created: ItineraryItem = await apiFetch("/f1/itinerary-items/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setItems((prev) => [...prev, created]);
      setSelectedPlace(null);
    } catch (err) {
      console.error("Failed to add stop:", err);
      setErrorMsg("Could not add stop to this day.");
    }
  }

  /* ------------- Delete stop ------------- */

  const handleDeleteItem = async (itemId: number) => {
    try {
      await apiFetch(`/f1/itinerary-items/${itemId}/`, {
        method: "DELETE",
      });
      setItems((prev) =>
        prev
          .filter((i) => i.id !== itemId)
          .map((i, idx) => ({ ...i, sort_order: idx + 1 }))
      );
    } catch (err) {
      console.error("Failed to delete item:", err);
      setErrorMsg("Could not delete this stop. Please try again.");
    }
  };

  /* ------------- Leg lookup ------------- */

  const findLegForPair = (fromId: number, toId: number): LegInfo | undefined =>
    legs.find((leg) => leg.from_id === fromId && leg.to_id === toId);

  /* ------------- Scroll to day ------------- */

  const scrollToDay = (dayId: number) => {
    const el = dayHeaderRefs.current.get(dayId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /* ------------- Compute reordered items (for preview during drag) ------------- */

  const computeReorderedItems = (
    prevItems: ItineraryItem[],
    activeId: number,
    overIdRaw: unknown
  ): ItineraryItem[] => {
    const itemsCopy = prevItems.map((i) => ({ ...i }));
    const activeItem = itemsCopy.find((i) => i.id === activeId);
    if (!activeItem) return prevItems;

    // ---- 1) figure out target day + index ----
    let targetDayId: number | null = null;
    let targetIndex = 0;

    if (typeof overIdRaw === "string" && overIdRaw.startsWith("day-")) {
      // Dropped into empty/bottom area of that day
      targetDayId = Number(overIdRaw.slice(4));
      const destList = getItemsForDay(itemsCopy, targetDayId);
      targetIndex = destList.length;
    } else {
      const destItemId =
        typeof overIdRaw === "number" ? overIdRaw : Number(overIdRaw);
      if (!destItemId || Number.isNaN(destItemId)) return prevItems;

      const destItem = itemsCopy.find((i) => i.id === destItemId);
      if (!destItem) return prevItems;

      targetDayId = destItem.day ?? null;
      if (!targetDayId) return prevItems;

      const destList = getItemsForDay(itemsCopy, targetDayId);
      const idx = destList.findIndex((i) => i.id === destItemId);
      targetIndex = idx === -1 ? destList.length : idx;
    }

    const sourceDayId = activeItem.day;
    if (!sourceDayId || !targetDayId) return prevItems;

    // ---- 2) build per-day buckets ----
    const byDay: Record<number, ItineraryItem[]> = {};
    days.forEach((d) => {
      byDay[d.id] = getItemsForDay(itemsCopy, d.id).map((it) => ({ ...it }));
    });

    const sourceList = byDay[sourceDayId] ?? [];
    const destList =
      sourceDayId === targetDayId ? sourceList : byDay[targetDayId] ?? [];

    const sourceIndex = sourceList.findIndex((i) => i.id === activeId);
    if (sourceIndex === -1) return prevItems;

    // ✅ If it would land in the same slot → no change
    if (sourceDayId === targetDayId && sourceIndex === targetIndex) {
      return prevItems;
    }

    // ---- 3) mutate the per-day lists in memory ----
    if (sourceDayId === targetDayId) {
      // reorder within same day
      const reordered = arrayMove(sourceList, sourceIndex, targetIndex);
      byDay[sourceDayId] = reordered;
    } else {
      // move between days
      const [moved] = sourceList.splice(sourceIndex, 1);
      const movedWithNewDay: ItineraryItem = { ...moved, day: targetDayId };
      destList.splice(targetIndex, 0, movedWithNewDay);

      byDay[sourceDayId] = sourceList;
      byDay[targetDayId] = destList;
    }

    // ---- 4) reconstruct full flat list with new sort_order ----
    const updated: ItineraryItem[] = [];

    Object.entries(byDay).forEach(([dayIdStr, list]) => {
      const dayIdNum = Number(dayIdStr);
      list.forEach((it, idx) => {
        updated.push({
          ...it,
          day: dayIdNum,
          sort_order: idx + 1,
        });
      });
    });

    // keep any items whose day is null / not present (edge case)
    prevItems.forEach((it) => {
      if (
        (it.day == null || !byDay[it.day]) &&
        !updated.find((u) => u.id === it.id)
      ) {
        updated.push(it);
      }
    });

    // ---- 5) stable global sort: by day_index then sort_order ----
    const dayIndexMap = new Map(days.map((d) => [d.id, d.day_index]));
    updated.sort((a, b) => {
      const da = dayIndexMap.get(a.day ?? 0) ?? 0;
      const db = dayIndexMap.get(b.day ?? 0) ?? 0;
      if (da !== db) return da - db;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    return updated;
  };


  /* ------------- Drag & Drop handler (dnd-kit) ------------- */

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    if (!activeId) return;

    const prev = items;
    const overId = over.id;

    const newItems = computeReorderedItems(prev, activeId, overId);
    if (newItems === prev) return; // no actual change

    // Update UI once
    setItems(newItems);
    setLegs([]); // clear until next optimise

    // Persist only changed records
    const prevById = new Map(prev.map((i) => [i.id, i]));
    const changed = newItems.filter((it) => {
      const p = prevById.get(it.id);
      if (!p) return true;
      return p.day !== it.day || p.sort_order !== it.sort_order;
    });

    if (!changed.length) return;

    try {
      await Promise.all(
        changed.map((it) =>
          apiFetch(`/f1/itinerary-items/${it.id}/`, {
            method: "PATCH",
            body: JSON.stringify({
              day: it.day,
              sort_order: it.sort_order,
            }),
          })
        )
      );
    } catch (err) {
      console.error("Failed to persist new order:", err);
      setErrorMsg("Could not save new order; refreshing the page may help.");
    }
  };


  // ------------- Add Day Handler ------------- //

  async function handleAddDay() {
    if (!numericTripId) return;

    try {
      const nextIndex = days.length + 1;

      const payload = {
        trip: numericTripId,   // must be number
        day_index: nextIndex,  // REQUIRED by backend
        date: null,
        note: "",
      };

      const created: TripDayResponse = await apiFetch(`/f1/trip-days/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setDays((prev) =>
        [...prev, created].sort((a, b) => a.day_index - b.day_index)
      );
    } catch (err) {
      console.error("Failed to add day:", err);
      setErrorMsg("Could not add a new day right now.");
    }
  }

  // ------------- Delete Day Handler ------------- //

  async function handleDeleteDay(dayId: number) {
    try {
      await apiFetch(`/f1/trip-days/${dayId}/`, {
        method: "DELETE",
      });

      // Remove the day locally & reindex for consistency
      setDays((prev) => {
        const remaining = prev.filter((d) => d.id !== dayId);
        return remaining
          .sort((a, b) => a.day_index - b.day_index)
          .map((d, idx) => ({ ...d, day_index: idx + 1 }));
      });

      // Remove all items assigned to that day from the UI
      // (backend keeps them with day=null due to SET_NULL, but they won't show)
      setItems((prev) => prev.filter((item) => item.day !== dayId));
    } catch (err) {
      console.error("Failed to delete day:", err);
      setErrorMsg("Could not delete this day. Please try again.");
    }
  }


  /* -------------------- Render -------------------- */

  return (
    <>
      <TripSubHeader />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
          gap: "0.75rem",
          padding: "0.75rem 2rem 2rem",
          backgroundColor: "#f9fafb",
          minHeight: "calc(100vh - 120px)",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Left: map + search + preview panel */}
        <div
          style={{
            position: "relative",
            backgroundColor: "#e5e7eb",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 10px 25px rgba(15,23,42,0.16)",
          }}
        >
          {/* Floating Search Bar (centered) */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              width: "min(640px, calc(100% - 64px))",
              pointerEvents: "none",
            }}
          >
            <div style={{ pointerEvents: "auto" }}>
              <PlaceSearchBar onSelect={handlePlaceSelect} />
            </div>
          </div>

          <div
            ref={mapContainerRef}
            style={{ width: "100%", height: "100%", minHeight: "520px" }}
          />

          {selectedPlace && (
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 16,
                zIndex: 15,
                backgroundColor: "white",
                borderRadius: "16px",
                boxShadow: "0 -4px 20px rgba(15,23,42,0.25)",
                padding: "12px 16px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {selectedPlace.name}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#6b7280",
                    maxWidth: "420px",
                  }}
                >
                  {selectedPlace.fullName}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddSelectedPlace}
                style={{
                  borderRadius: "999px",
                  border: "none",
                  background:
                    "linear-gradient(135deg, #4f46e5 0%, #6366f1 40%, #ec4899 100%)",
                  color: "white",
                  padding: "0.55rem 1.4rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + Add to itinerary
              </button>
            </div>
          )}
        </div>

        {/* Right: Planbot + optimise + itinerary + day sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "12px",
                padding: "0.6rem 0.9rem",
                fontSize: "0.85rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Top controls: Planbot + Optimise */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => navigate(`/trip/${tripId}/chatbot`)}
              style={{
                borderRadius: "999px",
                border: "none",
                backgroundColor: "#f97316",
                color: "white",
                padding: "0.45rem 1.3rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 6px 15px rgba(249,115,22,0.35)",
              }}
            >
              Planbot
            </button>

            <button
              onClick={handleOptimiseRouteClick}
              disabled={isOptimising || items.length < 2}
              style={{
                borderRadius: "999px",
                border: "none",
                backgroundColor: "#6366f1",
                color: "white",
                padding: "0.45rem 1.3rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor:
                  isOptimising || items.length < 2 ? "not-allowed" : "pointer",
                opacity: items.length < 2 ? 0.6 : 1,
              }}
            >
              {isOptimising ? "Optimising..." : "Optimise route"}
            </button>
          </div>

          {/* Main itinerary card + day-sidebar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2.1fr) minmax(0, 0.75fr)",
              gap: "1rem",
              alignItems: "flex-start",
              flex: 1,
              maxHeight: "520px",
            }}
          >
            {/* Itinerary Planner with DnD */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "16px",
                  padding: "1rem 1.25rem",
                  boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    marginBottom: "0.75rem",
                  }}
                >
                  Itinerary Planner
                </div>

                {isLoading ? (
                  <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                    Loading itinerary...
                  </div>
                ) : items.length === 0 ? (
                  <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                    No stops yet. Use the search bar on the map to add your
                    first destination.
                  </div>
                ) : (
                  days.map((day) => {
                    const dayItems = getItemsForDay(items, day.id);

                    return (
                      <DayDroppable key={day.id} day={day} allItems={items}>
                        {({ placeholderIndex }) => {
                          // build list with optional placeholder
                          const rendered: ReactNode[] = [];

                          if (dayItems.length === 0 && placeholderIndex === null) {
                            rendered.push(
                              <div
                                key={`empty-${day.id}`}
                                style={{
                                  fontSize: "0.8rem",
                                  color: "#9ca3af",
                                  marginBottom: 4,
                                }}
                              >
                                No stops scheduled for this day yet.
                              </div>
                            );
                          } else {
                            dayItems.forEach((item, idx) => {
                              // ghost slot BEFORE this item
                              if (placeholderIndex === idx) {
                                rendered.push(
                                  <div
                                    key={`ph-${day.id}-${idx}`}
                                    style={{
                                      height: 64,
                                      borderRadius: 12,
                                      border: "1px dashed #9ca3af",
                                      backgroundColor: "#eef2ff",
                                    }}
                                  />
                                );
                              }

                              const allItemsSorted = [...items].sort(
                                (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                              );
                              const globalIdx = allItemsSorted.findIndex((i) => i.id === item.id);
                              const next =
                                globalIdx >= 0 && globalIdx < allItemsSorted.length - 1
                                  ? allItemsSorted[globalIdx + 1]
                                  : null;

                              const leg =
                                next && findLegForPair(item.id, next.id)
                                  ? findLegForPair(item.id, next.id)
                                  : undefined;

                              const thumbUrl = getItemThumbnail(item);
                              const timeLabel = formatTimeRange(item);

                              rendered.push(
                                <SortableItineraryCard key={item.id} item={item}>
                                  <div
                                    style={{
                                      borderRadius: "12px",
                                      padding: "0.6rem 0.8rem",
                                      border: "1px solid #e5e7eb",
                                      display: "grid",
                                      gridTemplateColumns: "auto 110px minmax(0, 1fr) auto",
                                      columnGap: "0.75rem",
                                      alignItems: "center",
                                      backgroundColor: "transparent",
                                    }}
                                  >
                                    {/* Sequence number */}
                                    <div
                                      style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: "999px",
                                        backgroundColor: "#4f46e5",
                                        color: "white",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {item.sort_order}
                                    </div>

                                    {/* Thumbnail */}
                                    <div
                                      style={{
                                        width: 100,
                                        height: 64,
                                        borderRadius: 12,
                                        background: thumbUrl
                                          ? `url(${thumbUrl}) center/cover no-repeat`
                                          : "linear-gradient(135deg,#bfdbfe,#a5b4fc)",
                                      }}
                                    />

                                    {/* Text block */}
                                    <div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          marginBottom: 2,
                                          gap: 8,
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontSize: "0.9rem",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {item.title}
                                        </div>

                                        {timeLabel && (
                                          <div
                                            style={{
                                              fontSize: "0.75rem",
                                              color: "#6b7280",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {timeLabel}
                                          </div>
                                        )}
                                      </div>

                                      {item.address && (
                                        <div
                                          style={{
                                            fontSize: "0.8rem",
                                            color: "#6b7280",
                                          }}
                                        >
                                          {item.address}
                                        </div>
                                      )}

                                      {leg && (
                                        <div
                                          style={{
                                            fontSize: "0.78rem",
                                            color: "#4b5563",
                                            marginTop: 4,
                                          }}
                                        >
                                          {`→ ${leg.distance_km} km, ~${leg.duration_min} min to next stop`}
                                        </div>
                                      )}

                                      {/* Time editor trigger */}
                                      <div
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "#6b7280",
                                          cursor: "pointer",
                                          marginTop: 6,
                                        }}
                                        onClick={() => openTimeEditor(item)}
                                      >
                                        {timeLabel || "Add time"}
                                      </div>
                                    </div>

                                    {/* Delete button */}
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-end",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(item.id)}
                                        style={{
                                          borderRadius: "999px",
                                          border: "none",
                                          padding: "0.15rem 0.7rem",
                                          fontSize: "0.7rem",
                                          backgroundColor: "#fee2e2",
                                          color: "#b91c1c",
                                          cursor: "pointer",
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </SortableItineraryCard>
                              );
                            });

                            // ghost slot at the very end
                            if (
                              placeholderIndex !== null &&
                              placeholderIndex === dayItems.length
                            ) {
                              rendered.push(
                                <div
                                  key={`ph-${day.id}-end`}
                                  style={{
                                    height: 64,
                                    borderRadius: 12,
                                    border: "1px dashed #9ca3af",
                                    backgroundColor: "#eef2ff",
                                  }}
                                />
                              );
                            }
                          }

                          return (
                            <>
                              {/* Day header */}
                              <div
                                ref={(el) => {
                                  dayHeaderRefs.current.set(day.id, el);
                                }}
                                style={{
                                  backgroundColor: "#f3f4ff",
                                  borderRadius: "999px",
                                  padding: "0.3rem 0.85rem",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  color: "#111827",
                                  marginBottom: "0.55rem",
                                  display: "inline-block",
                                }}
                              >
                                {formatDayHeader(day)}
                              </div>

                              {/* + Add Stop button */}
                              <button
                                type="button"
                                onClick={() => openAddStopModal(day.id)}
                                style={{
                                  margin: "4px 0 10px",
                                  borderRadius: "8px",
                                  border: "1px solid #d1d5db",
                                  backgroundColor: "#f9fafb",
                                  color: "#4f46e5",
                                  padding: "4px 10px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                + Add Stop
                              </button>

                              <SortableContext
                                items={dayItems.map((i) => i.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                  }}
                                >
                                  {rendered}
                                </div>
                              </SortableContext>
                            </>
                          );
                        }}
                      </DayDroppable>
                    );
                  })
                )}

              </div>
            </DndContext>

            {/* Day sidebar */}
            <div
              style={{
                borderRadius: "16px",
                padding: "0.75rem 0.85rem",
                backgroundColor: "white",
                boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
                maxHeight: "520px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Itinerary
              </div>

              {/* + Add Day button */}
              <button
                type="button"
                onClick={handleAddDay}
                style={{
                  width: "100%",
                  padding: "0.4rem 0.5rem",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "#4f46e5",
                  color: "white",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                + Add Day
              </button>

              {days.map((day) => {
                if (!day.date) {
                  return (
                    <div
                      key={day.id}
                      onMouseEnter={() => setHoveredDayId(day.id)}
                      onMouseLeave={() => setHoveredDayId(null)}
                      onClick={() => scrollToDay(day.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.35rem 0.45rem",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        marginBottom: 4,
                      }}
                    >
                      <span>DAY {day.day_index}</span>

                      {/* Delete day button – only show on hover & if >1 day */}
                      {hoveredDayId === day.id && days.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDay(day.id);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#9ca3af",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          title="Delete day"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                }

                const d = new Date(day.date);
                const shortDow = d.toLocaleDateString(undefined, {
                  weekday: "short",
                });
                const dayNum = d.toLocaleDateString(undefined, {
                  day: "2-digit",
                });
                const monthShort = d.toLocaleDateString(undefined, {
                  month: "short",
                });

                return (
                  <div
                    key={day.id}
                    onMouseEnter={() => setHoveredDayId(day.id)}
                    onMouseLeave={() => setHoveredDayId(null)}
                    onClick={() => scrollToDay(day.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.35rem 0.45rem",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      marginBottom: 4,
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                        {shortDow}
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {dayNum} {monthShort}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "#6b7280",
                          textAlign: "right",
                        }}
                      >
                        Day {day.day_index}
                      </div>

                      {/* Delete day button – only show on hover & if >1 day */}
                      {hoveredDayId === day.id && days.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDay(day.id);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#9ca3af",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          title="Delete day"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Time editing modal (start/end time for an item) */}
      <TimeEditModal
        isOpen={timeModalOpen}
        item={timeModalItem}
        startValue={editStart}
        endValue={editEnd}
        onStartChange={setEditStart}
        onEndChange={setEditEnd}
        onCancel={() => {
          setTimeModalOpen(false);
          setTimeModalItem(null);
        }}
        onSave={saveTimeModal}
      />

      {addStopModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          <div
            style={{
              width: "min(720px, 94%)",       // 🔥 WIDER MODAL
              background: "white",
              borderRadius: "28px",
              padding: "2rem 2.4rem 1.8rem", // 🔥 Thicker, modern modal padding
              boxShadow: "0 22px 55px rgba(15,23,42,0.38)",
              boxSizing: "border-box",
            }}
          >
            {/* Header */}
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#111827",
                margin: 0,
                marginBottom: "1.4rem",
              }}
            >
              Add Stop to{" "}
              <span style={{ color: "#4f46e5" }}>
                Day {days.find((d) => d.id === addStopDayId)?.day_index}
              </span>
            </h2>

            {/* Search bar */}
            <div style={{ width: "94%", marginBottom: "1.3rem" }}>
              <PlaceSearchBar
                onSelect={(f) =>
                  setModalPlace({
                    name: f.text || "Selected place",
                    fullName: f.place_name || "",
                    address: f.place_name || "",
                    lat: f.center?.[1],
                    lon: f.center?.[0],
                  })
                }
              />
            </div>

            {/* Selected place preview */}      
            {modalPlace && (
              <div
                style={{
                  marginTop: "0.3rem",
                  padding: "0.8rem 0.9rem",
                  background: "#f9fafb",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 2 }}>
                  {modalPlace.name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  {modalPlace.fullName}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div
              style={{
                marginTop: "1.4rem",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
              }}
            >
              <button
                onClick={() => {
                  setAddStopModalOpen(false);
                  setModalPlace(null);
                }}
                style={{
                  padding: "0.45rem 1.1rem",
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  if (!modalPlace || !addStopDayId) {
                    setErrorMsg("Please select a place before adding.");
                    return;
                  }

                  try {
                    const payload = {
                      trip: numericTripId,
                      day: addStopDayId,
                      title: modalPlace.name,
                      address: modalPlace.address,
                      lat: modalPlace.lat,
                      lon: modalPlace.lon,
                      item_type: "place",
                      is_all_day: false,
                      sort_order: getItemsForDay(items, addStopDayId).length + 1,
                    };

                    const created = await apiFetch("/f1/itinerary-items/", {
                      method: "POST",
                      body: JSON.stringify(payload),
                    });

                    setItems((prev) => [...prev, created]);
                    setAddStopModalOpen(false);
                    setModalPlace(null);
                  } catch (err) {
                    console.error("Failed to add stop:", err);
                    setErrorMsg("Could not add stop.");
                  }
                }}
                style={{
                  padding: "0.45rem 1.35rem",
                  borderRadius: "999px",
                  border: "none",
                  background:
                    "linear-gradient(135deg, #4f46e5 0%, #6366f1 40%, #ec4899 100%)",
                  color: "white",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 8px 20px rgba(79,70,229,0.35)",
                }}
              >
                Add Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
