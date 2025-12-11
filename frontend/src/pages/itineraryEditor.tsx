// frontend/src/pages/itineraryEditor.tsx
import { useEffect, useRef, useState, ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  MouseSensor,
  closestCenter,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import PlaceSearchBar from "../components/PlaceSearchBar";
import TripSubHeader from "../components/TripSubHeader";
import { apiFetch } from "../lib/apiClient";
import ItineraryMap from "../components/ItineraryMap";

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

  if (start && !end) return start;
  if (!start && end) return end;
  return `${start} – ${end}`;
}

function getItemThumbnail(item: ItineraryItem): string | null {
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

/* -------------------- Day Droppable with highlight -------------------- */

function DayDroppable({
  dayId,
  children,
}: {
  dayId: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayId}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        marginBottom: "1.1rem",
        borderRadius: 12,
        paddingBottom: 4,
        backgroundColor: isOver
          ? "rgba(129,140,248,0.08)"
          : "transparent",
        transition: "background-color 120ms ease-out",
      }}
    >
      {children}
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

  // Day header refs for scrolling from sidebar
  const dayHeaderRefs = useRef<Map<number, HTMLDivElement | null>>(
    new Map()
  );

  /* DnD sensors */

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  /* -------- Time Editing State -------- */

  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [timeModalItem, setTimeModalItem] = useState<ItineraryItem | null>(
    null
  );
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Add stop modal
  const [addStopModalOpen, setAddStopModalOpen] = useState(false);
  const [addStopDayId, setAddStopDayId] = useState<number | null>(null);
  const [modalPlace, setModalPlace] = useState<SelectedPlace | null>(null);

  // Hovered day for sidebar
  const [hoveredDayId, setHoveredDayId] = useState<number | null>(null);

  // remember items before drag started
  const dragOriginRef = useRef<ItineraryItem[] | null>(null);

  // Collapsed days (if you ever want collapsing)
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

    const date = dayObj.date;

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

  /* ------------- Open add stop modal ------------- */

  function openAddStopModal(dayId: number) {
    setAddStopDayId(dayId);
    setModalPlace(null);
    setAddStopModalOpen(true);
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
    overId: string | number
  ): ItineraryItem[] => {
    const itemsCopy = prevItems.map((i) => ({ ...i }));
    const activeItem = itemsCopy.find((i) => i.id === activeId);
    if (!activeItem) return prevItems;

    let targetDayId: number | null = null;
    let targetIndex = 0;

    if (typeof overId === "string" && overId.startsWith("day-")) {
      targetDayId = Number(overId.slice(4));
      const destList = getItemsForDay(itemsCopy, targetDayId);
      targetIndex = destList.length;
    } else {
      const destItemId = Number(overId);
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

    if (sourceDayId === targetDayId && activeId === Number(overId)) {
      return prevItems;
    }

    const byDay: Record<number, ItineraryItem[]> = {};
    days.forEach((d) => {
      byDay[d.id] = getItemsForDay(itemsCopy, d.id).map((it) => ({ ...it }));
    });

    const sourceList = byDay[sourceDayId] ?? [];
    const destList =
      sourceDayId === targetDayId ? sourceList : byDay[targetDayId] ?? [];

    const sourceIndex = sourceList.findIndex((i) => i.id === activeId);
    if (sourceIndex === -1) return prevItems;

    if (sourceDayId === targetDayId) {
      const reordered = arrayMove(sourceList, sourceIndex, targetIndex);
      byDay[sourceDayId] = reordered;
    } else {
      const [moved] = sourceList.splice(sourceIndex, 1);
      const movedWithNewDay: ItineraryItem = { ...moved, day: targetDayId };
      destList.splice(targetIndex, 0, movedWithNewDay);

      byDay[sourceDayId] = sourceList;
      byDay[targetDayId] = destList;
    }

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

    prevItems.forEach((it) => {
      if (!byDay[it.day ?? -1] && !updated.find((u) => u.id === it.id)) {
        updated.push(it);
      }
    });

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

  const handleDragStart = () => {
    dragOriginRef.current = items;
  };

  const handleDragCancel = () => {
    if (dragOriginRef.current) {
      setItems(dragOriginRef.current);
      setLegs([]);
    }
    dragOriginRef.current = null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    const overId = over.id;
    if (!activeId || !overId) return;

    const nextItems = computeReorderedItems(items, activeId, overId);
    if (nextItems !== items) {
      setItems(nextItems);
      setLegs([]);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;

    if (!origin) return;

    const finalItems = items;

    const prevById = new Map(origin.map((i) => [i.id, i]));
    const changed = finalItems.filter((it) => {
      const prev = prevById.get(it.id);
      if (!prev) return true;
      return prev.day !== it.day || prev.sort_order !== it.sort_order;
    });

    if (!changed.length) return;

    try {
      await Promise.all(
        changed.map((it) =>
          apiFetch(`/f1/itinerary-items/${it.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ day: it.day, sort_order: it.sort_order }),
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
        trip: numericTripId,
        day_index: nextIndex,
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

      setDays((prev) => {
        const remaining = prev.filter((d) => d.id !== dayId);
        return remaining
          .sort((a, b) => a.day_index - b.day_index)
          .map((d, idx) => ({ ...d, day_index: idx + 1 }));
      });

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
        {/* Left: map only (reusable component) */}
        <div
          style={{
            position: "relative",
            backgroundColor: "#e5e7eb",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 10px 25px rgba(15,23,42,0.16)",
          }}
        >
          <ItineraryMap items={items} />
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
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
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
                    No stops yet. Use the “+ Add Stop” button under any day to
                    add your first destination.
                  </div>
                ) : (
                  days.map((day) => {
                    const dayItems = getItemsForDay(items, day.id);

                    return (
                      <DayDroppable key={day.id} dayId={day.id}>
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
                            {dayItems.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  color: "#9ca3af",
                                  marginBottom: 4,
                                }}
                              >
                                No stops scheduled for this day yet.
                              </div>
                            ) : (
                              dayItems.map((item) => {
                                const allItemsSorted = [...items].sort(
                                  (a, b) =>
                                    (a.sort_order ?? 0) -
                                    (b.sort_order ?? 0)
                                );
                                const globalIdx = allItemsSorted.findIndex(
                                  (i) => i.id === item.id
                                );
                                const next =
                                  globalIdx >= 0 &&
                                  globalIdx < allItemsSorted.length - 1
                                    ? allItemsSorted[globalIdx + 1]
                                    : null;

                                const leg =
                                  next && findLegForPair(item.id, next.id)
                                    ? findLegForPair(item.id, next.id)
                                    : undefined;

                                const thumbUrl = getItemThumbnail(item);
                                const timeLabel = formatTimeRange(item);

                                return (
                                  <SortableItineraryCard
                                    key={item.id}
                                    item={item}
                                  >
                                    <div
                                      style={{
                                        borderRadius: "12px",
                                        padding: "0.6rem 0.8rem",
                                        border: "1px solid #e5e7eb",
                                        display: "grid",
                                        gridTemplateColumns:
                                          "auto 110px minmax(0, 1fr) auto",
                                        columnGap: "0.75rem",
                                        alignItems: "center",
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
                                          onClick={() =>
                                            handleDeleteItem(item.id)
                                          }
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
                              })
                            )}
                          </div>
                        </SortableContext>
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

      {/* Time editing modal */}
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

      {/* Add Stop modal */}
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
              width: "min(720px, 94%)",
              background: "white",
              borderRadius: "28px",
              padding: "2rem 2.4rem 1.8rem",
              boxShadow: "0 22px 55px rgba(15,23,42,0.38)",
              boxSizing: "border-box",
            }}
          >
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
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 2,
                  }}
                >
                  {modalPlace.name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  {modalPlace.fullName}
                </div>
              </div>
            )}

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
                      sort_order:
                        getItemsForDay(items, addStopDayId).length + 1,
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
