// frontend/src/pages/itineraryEditor.tsx
import React, { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

import { ChevronDown, ChevronRight } from "lucide-react";

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

import PlaceAboutTab from "../components/PlaceAboutTab";
import PlaceSearchBar from "../components/PlaceSearchBar";
import PlaceTravelTab from "../components/PlaceTravelTab";
import AdaptivePlannerOverlay from "../components/AdaptivePlannerOverlay";
import TripSubHeader from "../components/TripSubHeader";
import { apiFetch } from "../lib/apiClient";
import ItineraryMap from "../components/ItineraryMap";
import planbotSmall from "../assets/planbotSmall.png";


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
  notes_summary?: string | null;
  preferences_text?: string | null;
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

type NearbyPOI = {
  xid: string;
  name: string;
  kinds: string | null;
  dist_m?: number | null;
  image_url?: string | null;
  wikipedia?: string | null;
};

type PlaceDetails = {
  item_id: number;
  xid?: string | null;

  name: string;
  description: string | null;

  notes_summary?: string | null;
  preferences_text?: string | null;

  about?: {
    why_go?: string[];
    know_before_you_go?: string[];
    getting_there?: string | null;
    best_time?: string | null;
    tips?: string[];
  };

  image_url: string | null;
  images?: string[];

  wikipedia: string | null;
  kinds: string | null;
  source: "opentripmap" | "wikipedia" | "none";

  address?: string | null;
  website?: string | null;
  phone?: string | null;
  opening_hours?: string | null;

  nearby?: NearbyPOI[];

  travel?: {
    transport_systems?: string[];
    currency_exchange?: string[];
    holidays_and_crowds?: string[];
    attraction_info?: string[];
  };

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

// Parse an ISO string but keep the wall-clock time the user entered
function parseWallClockDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  if (!datePart || !timePart) return null;
  const d = new Date(`${datePart}T${timePart}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTimeRange(item: ItineraryItem): string {
  if (!item.start_time && !item.end_time) return "";

  const fmt = (t: string | null | undefined) => {
    const d = parseWallClockDate(t);
    return d
      ? d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  };

  const start = fmt(item.start_time);
  const end = fmt(item.end_time);

  if (start && !end) return start;
  if (!start && end) return end;
  return `${start} – ${end}`;
}

function deriveDayDateISO(trip: TripResponse | null, day: TripDayResponse): string | null {
  if (day.date) return day.date; // already has YYYY-MM-DD
  if (!trip?.start_date) return null;

  const base = new Date(trip.start_date);
  if (Number.isNaN(base.getTime())) return null;

  const d = new Date(base);
  d.setDate(d.getDate() + (day.day_index - 1));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDayHeaderSmart(trip: TripResponse | null, day: TripDayResponse): string {
  const iso = deriveDayDateISO(trip, day);
  if (!iso) return `Day ${day.day_index}`;

  const d = new Date(iso);
  const weekDay = d.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `DAY ${day.day_index} ${weekDay}, ${dateStr}`;
}


function getItemThumbnail(item: ItineraryItem): string | null {
  const anyItem = item as any;
  return anyItem.photo_url || anyItem.thumbnail_url || null;
}

function hasAnyThumbnail(item: ItineraryItem): boolean {
  const u = getItemThumbnail(item);
  return typeof u === "string" && u.trim().length > 0;
}

function getItemsForDay(
  allItems: ItineraryItem[],
  dayId: number | null
): ItineraryItem[] {
  return allItems
    .filter((i) => i.day === dayId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

// -------------------- Day colour palette -------------------- //

const dayColorPalette = [
  "#746ee5ff", // indigo
  "#b13171ff", // pink
  "#2fa57eff", // emerald
  "#eb904eff", // orange
  "#56acd4ff", // sky
  "#bc78fbff", // purple
];

function getDayColor(dayIndex: number | null | undefined): string {
  if (!dayIndex || dayIndex <= 0) return "#6b7280"; // default gray
  const idx =
    ((dayIndex - 1) % dayColorPalette.length + dayColorPalette.length) %
    dayColorPalette.length;
  return dayColorPalette[idx];
}

/* -------------------- Formatters -------------------- */
function formatMeters(m?: number | null) {
  if (!m || m <= 0) return "";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function normalizeUrl(u?: string | null) {
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
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
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const fetchedThumbIdsRef = useRef<Set<number>>(new Set());
  const fetchedOpeningIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!items || items.length === 0) return;

    let cancelled = false;

    // Only hydrate a few at a time to avoid hammering backend
    const missing = items.filter((it) => !hasAnyThumbnail(it)).slice(0, 3);

    (async () => {
      for (const it of missing) {
        if (!it?.id) continue;
        if (cancelled) break;
        if (fetchedThumbIdsRef.current.has(it.id)) continue;
        fetchedThumbIdsRef.current.add(it.id);

        try {
          const details: any = await apiFetch(
            `/f1/itinerary-items/${it.id}/place-details/?include_images=0`
          );

          const url =
            (typeof details?.image_url === "string" && details.image_url.trim())
              ? details.image_url.trim()
              : (Array.isArray(details?.images) && details.images.length > 0 ? details.images[0] : null);

          if (!url) {
            await new Promise((r) => setTimeout(r, 250));
            continue;
          }

          if (!cancelled) {
            setItems((prev) =>
              prev.map((x) =>
                x.id === it.id ? ({ ...(x as any), thumbnail_url: url } as any) : x
              )
            );
          }

          // Persist thumbnail so it survives refresh
          if (!it.thumbnail_url) {
            try {
              await apiFetch(`/f1/itinerary-items/${it.id}/`, {
                method: "PATCH",
                body: JSON.stringify({ thumbnail_url: url }),
              });
            } catch {
              // non-blocking
            }
          }
        } catch {
          // ignore; keep fallback gradient UI
        }

        await new Promise((r) => setTimeout(r, 250));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items]);

  // Hydrate opening hours for items with scheduled times
  useEffect(() => {
    if (!items || items.length === 0) return;

    const needingHours = items
      .filter(
        (it) =>
          (it.start_time || it.end_time) &&
          !(it as any).opening_hours &&
          !fetchedOpeningIdsRef.current.has(it.id)
      )
      .slice(0, 5); // limit concurrent fetches

    needingHours.forEach((it) => {
      fetchedOpeningIdsRef.current.add(it.id);
      (async () => {
        try {
          const details: any = await apiFetch(
            `/f1/itinerary-items/${it.id}/place-details/?include_images=0`
          );
          if (!details?.opening_hours) return;
          setItems((prev) =>
            prev.map((x) =>
              x.id === it.id ? ({ ...(x as any), opening_hours: details.opening_hours } as any) : x
            )
          );
        } catch {
          // ignore missing hours
        }
      })();
    });
  }, [items]);


const [days, setDays] = useState<TripDayResponse[]>([]);
const [legs, setLegs] = useState<LegInfo[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isOptimising, setIsOptimising] = useState(false);
const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isOptimisingFull, setIsOptimisingFull] = useState(false);

  // Place overlay state
  const [placeOverlay, setPlaceOverlay] = useState<PlaceDetails | null>(null);
  const [placeOverlayLoading, setPlaceOverlayLoading] = useState(false);
  const [placeOverlayError, setPlaceOverlayError] = useState<string | null>(null);
  const [placeTab, setPlaceTab] = useState<"about" | "travel" | "nearby" | "photos">("about");
  const [openverseLoading, setOpenverseLoading] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(false);

  // Lightbox (photo overlay)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const photos = placeOverlay?.images || [];

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const showPrev = () => setLightboxIndex((i) => (i - 1 + photos.length) % photos.length);
  const showNext = () => setLightboxIndex((i) => (i + 1) % photos.length);

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen, photos.length]);

  useEffect(() => {
    if (!placeOverlay) return;
    if (placeTab !== "photos") return;

    const alreadyHasGallery = (placeOverlay.images?.length ?? 0) > 0;
    if (alreadyHasGallery) return;

    (async () => {
      setPhotosLoading(true);
      try {
        const data: PlaceDetails = await apiFetch(
          `/f1/itinerary-items/${placeOverlay.item_id}/place-details/?include_images=12`
        );

        setPlaceOverlay((prev) => {
          if (!prev || prev.item_id !== data.item_id) return prev;
          return {
            ...prev,
            image_url: prev.image_url || data.image_url,
            images: data.images || [],
          };
        });

        const missingAllImages =
          (!data.image_url || data.image_url.trim() === "") &&
          ((data.images?.length ?? 0) === 0);

        if (missingAllImages) {
          await fetchOpenverseImages(data);
        }
      } catch (err) {
        console.error("Failed to load photos:", err);
      } finally {
        setPhotosLoading(false);
      }
    })();
  }, [placeTab, placeOverlay?.item_id]);



  //* -------------------- Open place overlay -------------------- */
  async function openPlaceOverlay(item: ItineraryItem) {
    setLightboxOpen(false);
    setLightboxIndex(0);
    setPlaceOverlayLoading(true);
    setPlaceOverlayError(null);
    setPlaceTab("about");
    setOpenverseLoading(false);
    setPhotosLoading(false);

    try {
      const data: PlaceDetails = await apiFetch(
        `/f1/itinerary-items/${item.id}/place-details/?include_images=0`
      );

      setPlaceOverlay(data);

      // If we got a hero image, store it as the item's thumbnail so the list shows it too
      if (data?.image_url && !hasAnyThumbnail(item)) {
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id ? ({ ...(x as any), thumbnail_url: data.image_url } as any) : x
          )
        );
      }

    } catch (err: any) {
      console.error("Failed to load place details:", err);
      setPlaceOverlay(null);
      setPlaceOverlayError("Could not load place details.");
    } finally {
      setPlaceOverlayLoading(false);
    }
  }

  const pickImageUrls = (results: any[]): string[] => {
    const urls = (results || [])
      .map((r) => {
        // Openverse images typically provide 'thumbnail' (direct image),
        // and sometimes 'url' (landing page) — prefer thumbnail.
        return (
          r?.thumbnail ||
          r?.url ||
          r?.foreign_landing_url ||
          r?.detail_url ||
          null
        );
      })
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    // dedupe preserving order
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const u of urls) {
      if (!seen.has(u)) {
        seen.add(u);
        deduped.push(u);
      }
    }
    return deduped;
  };

  async function fetchOpenverseImages(details: PlaceDetails) {
    const queryParts = [
      details.name,
      trip?.main_city,
      "landmark",
    ].filter(Boolean);

    if (queryParts.length === 0) return;

    setOpenverseLoading(true);
    setPhotosLoading(true);

    try {
      const searchUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
        queryParts.join(" ")
      )}&page_size=12`;

      const resp = await fetch(searchUrl);
      if (!resp.ok) throw new Error(`Openverse status ${resp.status}`);

      const json = await resp.json();
      const urls = pickImageUrls(json?.results || []);
      if (urls.length === 0) return;

      setPlaceOverlay((prev) => {
        if (!prev || prev.item_id !== details.item_id) return prev;

        const merged = [
          ...(prev.images || []),
          ...urls,
        ];
        const unique = Array.from(new Set(merged));

        return {
          ...prev,
          image_url: prev.image_url || unique[0],
          images: unique,
        };
      });
    } catch (err) {
      console.error("Openverse fallback failed:", err);
    } finally {
      setOpenverseLoading(false);
      setPhotosLoading(false);
    }
  }

  /* -------------------- Apply updated items after optimisation -------------------- */
  const applyUpdatedItems = (
    updated: Array<{ id: number; day: number | null; sort_order: number }>
  ) => {
    const byId = new Map(updated.map((u) => [u.id, u]));
    setItems((prev) =>
      prev.map((it) => {
        const u = byId.get(it.id);
        return u ? { ...it, day: u.day, sort_order: u.sort_order } : it;
      })
    );
  };

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

  // Which day is "selected" in the mini calendar (for highlight + summary)
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);

  const selectedDay = useMemo(() => {
    if (!selectedDayId) return null;
    return days.find((d) => d.id === selectedDayId) ?? null;
  }, [days, selectedDayId]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDay?.id) return [];
    return getItemsForDay(items, selectedDay.id);
  }, [items, selectedDay?.id]);

  const dayISOMap = useMemo(() => {
    const m: Record<number, string> = {};
    days.forEach((d) => {
      const iso = deriveDayDateISO(trip, d);
      if (iso) m[d.id] = iso;
    });
    return m;
  }, [days, trip]);

  const itemsByDay = useMemo(() => {
    const m: Record<
      number,
      { id: number; title?: string | null; start_time?: string | null; end_time?: string | null; opening_hours?: string | null }[]
    > = {};
    days.forEach((d) => {
      m[d.id] = getItemsForDay(items, d.id).map((it) => ({
        id: it.id,
        title: it.title,
        start_time: it.start_time,
        end_time: it.end_time,
        opening_hours: (it as any).opening_hours ?? null,
      }));
    });
    return m;
  }, [days, items]);


  // remember items before drag started
  const dragOriginRef = useRef<ItineraryItem[] | null>(null);

  // Day header refs for scrolling from sidebar
  const dayHeaderRefs = useRef<Map<number, HTMLDivElement | null>>(
    new Map()
  );

  // Scroll container for the itinerary list (middle column)
  const itineraryScrollRef = useRef<HTMLDivElement | null>(null);

  const DAY_STICKY_OFFSET = 63; // pixels under the main header inside the card

  // Track the last drag preview arrangement so we don't setState with the same shape repeatedly
  const lastPreviewSigRef = useRef<string | null>(null);
  // Throttle drag-over previews so we don't synchronously chain updates during layout effects
  const previewRafRef = useRef<number | null>(null);

  // --- Global numbering + map items ---
  // Day index lookup: TripDay.id -> day_index (1,2,3...)
  const dayIndexMap = new Map(days.map((d) => [d.id, d.day_index]));

  // Items in trip order: by day_index, then sort_order inside the day
  const itemsInTripOrder = [...items].sort((a, b) => {
    const da = dayIndexMap.get(a.day ?? 0) ?? 0;
    const db = dayIndexMap.get(b.day ?? 0) ?? 0;
    if (da !== db) return da - db;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  // Global sequence number: 1,2,3 across the whole trip
  const sequenceMap = new Map<number, number>();
  itemsInTripOrder.forEach((it, idx) => {
    sequenceMap.set(it.id, idx + 1);
  });

  // Map items: include global seq, day_index, and stop_index-within-day
  const mapItems = itemsInTripOrder.map((it, idx) => {
    const dayIdx = dayIndexMap.get(it.day ?? 0) ?? null;
    const dayItems = getItemsForDay(items, it.day);
    const stopIndex =
      dayItems.findIndex((dItem) => dItem.id === it.id) + 1 || null;

    return {
      id: it.id,
      title: it.title,
      address: it.address,
      lat: it.lat,
      lon: it.lon,
      sort_order: idx + 1,          // global sequence for map labels
      day_index: dayIdx,            // for color-coding
      stop_index: stopIndex,        // "stop 2 in Day 3" etc
    };
  });

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

    const dateISO = deriveDayDateISO(trip, dayObj) ?? "";

    if (!dateISO) {
      setErrorMsg("This day has no date yet. Set a trip start date (or day date) first.");
      return;
    }

    const startISO = editStart ? `${dateISO}T${editStart}:00` : null;
    const endISO = editEnd ? `${dateISO}T${editEnd}:00` : null;

    try {
      await apiFetch(`/f1/itinerary-items/${item.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          start_time: startISO,
          end_time: endISO,
        }),
      });

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, start_time: startISO, end_time: endISO } : i
        )
      );

      setTimeModalOpen(false);
      setTimeModalItem(null);
    } catch (err) {
      console.error("Failed to save time:", err);
      setErrorMsg("Could not save time. Please try again.");
    }
  }

  const toggleDayCollapse = (dayId: number) => {
    setCollapsedDayIds((prev) =>
      prev.includes(dayId)
        ? prev.filter((id) => id !== dayId)
        : [...prev, dayId]
    );
  };

  /* ------------------ Load Trip ------------------ */
  
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

  useEffect(() => {
    if (!tripId) return;
    loadTrip();
  }, [tripId]);

  // Listen for "trip-updated" events to reload trip data
  useEffect(() => {
    const handler = (e: any) => {
      if (Number(e?.detail?.tripId) === Number(tripId)) loadTrip();
    };
    window.addEventListener("trip-updated", handler);
    return () => window.removeEventListener("trip-updated", handler);
  }, [tripId]);


  // When days first load, default-select the first day
  useEffect(() => {
    if (days.length > 0 && selectedDayId == null) {
      setSelectedDayId(days[0].id);
    }
  }, [days, selectedDayId]);

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

      const legsData: LegInfo[] = data?.legs || [];
      const updatedItems = data?.updated_items || [];

      if (updatedItems.length > 0) applyUpdatedItems(updatedItems);
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

  const optimiseFullTripRoute = async () => {
    if (!numericTripId) return;
    setIsOptimisingFull(true);
    setErrorMsg(null);

    try {
      const data = await apiFetch("/f1/route-optimize-full/", {
        method: "POST",
        body: JSON.stringify({ trip_id: numericTripId, profile: "driving-car" }),
      });

      const legsData: LegInfo[] = data?.legs || [];
      const updatedItems = data?.updated_items || [];

      if (updatedItems.length > 0) applyUpdatedItems(updatedItems);
      setLegs(legsData);
    } catch (err: any) {
      console.error("Failed to optimise full trip route:", err);
      setErrorMsg("Could not optimise the full trip right now.");
    } finally {
      setIsOptimisingFull(false);
    }
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

  /* ------------- Day summary (stops · km · duration) ------------- */

  const formatDurationShort = (minutes: number | undefined): string => {
    if (!minutes || minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  };

  const getDaySummary = (dayId: number) => {
    const dayItems = getItemsForDay(items, dayId);
    const stops = dayItems.length;

    let totalKm = 0;
    let totalMin = 0;

    for (let i = 0; i < dayItems.length - 1; i++) {
      const from = dayItems[i];
      const to = dayItems[i + 1];
      const leg = findLegForPair(from.id, to.id);
      if (leg) {
        totalKm += leg.distance_km || 0;
        totalMin += leg.duration_min || 0;
      }
    }

    return {
      stops,
      distanceKmLabel: totalKm > 0 ? `${totalKm.toFixed(1)} km` : "— km",
      durationLabel: formatDurationShort(totalMin),
    };
  };

  /* ------------- Scroll to day inside itinerary pane ------------- */

  const scrollToDay = (dayId: number) => {
    const el = dayHeaderRefs.current.get(dayId);
    const container = itineraryScrollRef.current;
    if (!el || !container) return;

    const containerTop = container.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;

    const offset =
      elTop -
      containerTop +
      container.scrollTop -
      DAY_STICKY_OFFSET -
      8; // small extra padding

    container.scrollTo({
      top: offset,
      behavior: "smooth",
    });
  };


  /* ------------- Compute reordered items (for preview during drag) ------------- */

  const computeReorderedItems = (
    prevItems: ItineraryItem[],
    activeId: number,
    overId: string | number
  ): ItineraryItem[] | null => {
    const itemsCopy = prevItems.map((i) => ({ ...i }));
    const activeItem = itemsCopy.find((i) => i.id === activeId);
    if (!activeItem) return null;

    let targetDayId: number | null = null;
    let targetIndex = 0;

    if (typeof overId === "string" && overId.startsWith("day-")) {
      targetDayId = Number(overId.slice(4));
      const destList = getItemsForDay(itemsCopy, targetDayId);
      targetIndex = destList.length;
    } else {
      const destItemId = Number(overId);
      const destItem = itemsCopy.find((i) => i.id === destItemId);
      if (!destItem) return null;

      targetDayId = destItem.day ?? null;
      if (!targetDayId) return null;

      const destList = getItemsForDay(itemsCopy, targetDayId);
      const idx = destList.findIndex((i) => i.id === destItemId);
      targetIndex = idx === -1 ? destList.length : idx;
    }

    const sourceDayId = activeItem.day;
    if (!sourceDayId || !targetDayId) return null;

    if (sourceDayId === targetDayId && activeId === Number(overId)) {
      return null;
    }

    const byDay: Record<number, ItineraryItem[]> = {};
    days.forEach((d) => {
      byDay[d.id] = getItemsForDay(itemsCopy, d.id).map((it) => ({ ...it }));
    });

    const sourceList = byDay[sourceDayId] ?? [];
    const destList =
      sourceDayId === targetDayId ? sourceList : byDay[targetDayId] ?? [];

    const sourceIndex = sourceList.findIndex((i) => i.id === activeId);
    if (sourceIndex === -1) return null;

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

    // Skip state updates if nothing about day or order actually changed
    // to avoid endless drag-over re-renders.
    const prevMap = new Map(prevItems.map((i) => [i.id, i]));
    const changed = updated.some((it) => {
      const prev = prevMap.get(it.id);
      if (!prev) return true;
      return prev.day !== it.day || prev.sort_order !== it.sort_order;
    });

    return changed ? updated : null;
  };

  const makeItemsSignature = (list: ItineraryItem[]): string => {
    // signature based on each item's day+sort_order keyed by id (order-independent)
    return [...list]
      .sort((a, b) => a.id - b.id)
      .map((it) => `${it.id}:${it.day ?? "null"}:${it.sort_order ?? 0}`)
      .join("|");
  };

  /* ------------- Drag & Drop handler (dnd-kit) ------------- */

  const handleDragStart = () => {
    dragOriginRef.current = items;
    lastPreviewSigRef.current = makeItemsSignature(items);
  };

  const handleDragCancel = () => {
    if (previewRafRef.current) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    if (dragOriginRef.current) {
      setItems(dragOriginRef.current);
      setLegs([]);
    }
    dragOriginRef.current = null;
    lastPreviewSigRef.current = null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    const overId = over.id;
    if (!activeId || !overId) return;

    const nextItems = computeReorderedItems(items, activeId, overId);
    if (!nextItems) return;

    const sig = makeItemsSignature(nextItems);
    if (sig === lastPreviewSigRef.current) return;
    lastPreviewSigRef.current = sig;

    if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    previewRafRef.current = requestAnimationFrame(() => {
      setItems(nextItems);
      setLegs([]);
      previewRafRef.current = null;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;
    lastPreviewSigRef.current = null;
    if (previewRafRef.current) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }

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

  /* ------------- Add Day helpers ------------- */
  function addDays(dateStr: string, daysToAdd: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + daysToAdd);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  async function patchTripEndDate(tripIdNum: number, endDate: string | null) {
    await apiFetch(`/f1/trips/${tripIdNum}/`, {
      method: "PATCH",
      body: JSON.stringify({ end_date: endDate }),
    });

    window.dispatchEvent(new CustomEvent("trip-updated", { detail: { tripId: tripIdNum } }));
  }


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

      // after created day is added to state
      if (trip?.start_date) {
        const newCount = (days.length + 1); // because you're adding one
        const newEnd = addDays(trip.start_date, newCount - 1);
        await patchTripEndDate(numericTripId, newEnd);

        // also update local trip state so UI stays in sync
        setTrip((prev) => (prev ? { ...prev, end_date: newEnd } : prev));
      }
    } catch (err) {
      console.error("Failed to add day:", err);
      setErrorMsg("Could not add a new day right now.");
    }
  }

  // ------------- Delete Day Handler ------------- //

  async function handleDeleteDay(dayId: number) {
    if (!numericTripId) return;

    // compute remainingCount from the CURRENT render snapshot
    // (safe because we're not depending on setState timing)
    const remainingCount = Math.max(days.filter((d) => d.id !== dayId).length, 1);

    try {
      await apiFetch(`/f1/trip-days/${dayId}/`, { method: "DELETE" });

      // keep UI responsive immediately
      setDays((prev) => {
        const remaining = prev.filter((d) => d.id !== dayId);
        // You can keep this normalization OR remove it and just reload.
        return remaining
          .sort((a, b) => a.day_index - b.day_index)
          .map((d, idx) => ({ ...d, day_index: idx + 1 }));
      });

      setItems((prev) => prev.filter((item) => item.day !== dayId));

      // now patch end_date based on remainingCount (NOT days.length)
      if (trip?.start_date) {
        const newEnd = addDays(trip.start_date, remainingCount - 1);
        await patchTripEndDate(numericTripId, newEnd);
        setTrip((prev) => (prev ? { ...prev, end_date: newEnd } : prev));
      }

      await loadTrip();

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
          padding: "0rem 0rem 2rem",
          backgroundColor: "#f9fafb",
          minHeight: "calc(90vh - 90px)",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 2fr) minmax(0, 2fr) minmax(0, 0.45fr)",
            columnGap: "0rem",
            rowGap: "1rem",
            alignItems: "flex-start",
            width: "100%",
            margin: 0,
            padding: 0,
          }}
        >
          {/* LEFT: Sticky Map */}
          <div
            style={{
              position: "sticky",
              top: 90,
              height: "calc(90vh - 90px)",
              background: "#e5e7eb",
              borderRadius: 0,
              overflow: "hidden",
              boxShadow: "none",
            }}
          >
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <ItineraryMap items={mapItems} />

              <AdaptivePlannerOverlay
                tripId={numericTripId}
                days={days}
                dayISOMap={dayISOMap}
                itemsByDay={itemsByDay}
                onApplied={() => loadTrip()}
                onItemsPatched={(updates) => {
                  setItems((prev) =>
                    prev.map((it) => {
                      const u = updates.find((x) => x.id === it.id);
                      if (!u) return it;
                      return {
                        ...it,
                        day: u.day !== undefined ? u.day : it.day,
                        sort_order: u.sort_order !== undefined ? u.sort_order : it.sort_order,
                        start_time: u.start_time !== undefined ? u.start_time : it.start_time,
                        end_time: u.end_time !== undefined ? u.end_time : it.end_time,
                      };
                    })
                  );
                }}
              />

              {/* Bottom place overlay */}
              {(placeOverlay || placeOverlayLoading || placeOverlayError) && (
                <div
                  style={{
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: 12,
                    zIndex: 50,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.96)",
                    border: "1px solid rgba(229,231,235,0.9)",
                    boxShadow: "0 18px 45px rgba(15,23,42,0.22)",
                    overflow: "hidden",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div style={{ padding: 12 }}>
                    {/* TOP ROW: Image + Title + Close */}
                    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                      {/* image */}
                      <div
                        style={{
                          width: 98,
                          minWidth: 98,
                          borderRadius: 14,
                          background: placeOverlay?.image_url
                            ? `url(${placeOverlay.image_url}) center/cover no-repeat`
                            : "linear-gradient(135deg,#bfdbfe,#a5b4fc)",
                        }}
                      />

                      {/* title + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div
                            style={{
                              fontSize: "0.95rem",
                              fontWeight: 750,
                              color: "#111827",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {placeOverlayLoading ? "Loading…" : (placeOverlay?.name || "Place")}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setPlaceOverlay(null);
                              setPlaceOverlayError(null);
                              setOpenverseLoading(false);
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              color: "#6b7280",
                              fontSize: 18,
                              lineHeight: "18px",
                            }}
                            title="Close"
                          >
                            ×
                          </button>
                        </div>

                        {/* quick meta line */}
                        {!placeOverlayLoading && !placeOverlayError && (
                          <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#6b7280" }}>
                            {placeOverlay?.kinds ? placeOverlay.kinds : "—"}
                            {placeOverlay?.address ? ` · ${placeOverlay.address}` : ""}
                          </div>
                        )}

                        {/* ✅ Notes + Preferences (under address) */}
                        {(placeOverlay?.notes_summary || placeOverlay?.preferences_text) && (
                          <div
                            style={{
                              marginTop: 8,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {placeOverlay?.notes_summary && (
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "#374151",
                                  background: "#f3f4f6",
                                  border: "1px solid #e5e7eb",
                                  padding: "8px 10px",
                                  borderRadius: 12,
                                  lineHeight: 1.35,
                                }}
                              >
                                <div style={{ fontWeight: 800, fontSize: "0.72rem", color: "#6b7280", marginBottom: 4 }}>
                                  Notes summary
                                </div>
                                {placeOverlay.notes_summary}
                              </div>
                            )}

                            {placeOverlay?.preferences_text && (
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "#374151",
                                  background: "#eef2ff",
                                  border: "1px solid #c7d2fe",
                                  padding: "8px 10px",
                                  borderRadius: 12,
                                  lineHeight: 1.35,
                                }}
                              >
                                <div style={{ fontWeight: 800, fontSize: "0.72rem", color: "#6b7280", marginBottom: 4 }}>
                                  Preferences
                                </div>
                                {placeOverlay.preferences_text}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TAB BAR */}
                    <div style={{ display: "flex", gap: 10, paddingTop: 10 }}>
                      {(["about", "travel", "nearby", "photos"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setPlaceTab(t)}
                          style={{
                            border: "none",
                            background: placeTab === t ? "#eef2ff" : "transparent",
                            color: placeTab === t ? "#4338ca" : "#6b7280",
                            fontWeight: 750,
                            fontSize: "0.78rem",
                            padding: "6px 10px",
                            borderRadius: 999,
                            cursor: "pointer",
                          }}
                        >
                          {t === "about"
                            ? "About"
                            : t === "travel"
                            ? "Travel"
                            : t === "nearby"
                            ? "Nearby"
                            : "Photos"}
                        </button>
                      ))}
                    </div>

                    {/* TAB CONTENT */}
                    <div style={{ marginTop: 10 }}>
                      {/* ERROR */}
                      {placeOverlayError && (
                        <div style={{ fontSize: "0.85rem", color: "#b91c1c" }}>
                          {placeOverlayError}
                        </div>
                      )}

                      {/* LOADING */}
                      {!placeOverlayError && placeOverlayLoading && (
                        <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                          Fetching place info…
                        </div>
                      )}

                      {/* ABOUT */}
                      {!placeOverlayError && !placeOverlayLoading && placeTab === "about" && placeOverlay && (
                        <div
                          style={{
                            maxHeight: 190,
                            overflowY: "auto",
                            paddingRight: 6,
                            position: "relative",

                            fontSize: "0.8rem",
                            color: "#6b7280",
                            lineHeight: 1.45,
                          }}
                        >
                          <PlaceAboutTab place={placeOverlay as any} hideHeroImage />

                          {/* extra info chips */}
                          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {placeOverlay?.opening_hours && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#374151",
                                  background: "#f3f4f6",
                                  padding: "5px 10px",
                                  borderRadius: 999,
                                }}
                              >
                                ⏰ {placeOverlay.opening_hours}
                              </span>
                            )}

                            {placeOverlay?.phone && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#374151",
                                  background: "#f3f4f6",
                                  padding: "5px 10px",
                                  borderRadius: 999,
                                }}
                              >
                                📞 {placeOverlay.phone}
                              </span>
                            )}

                            {placeOverlay?.website && normalizeUrl(placeOverlay.website) && (
                              <a
                                href={normalizeUrl(placeOverlay.website)!}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#4f46e5",
                                  background: "#eef2ff",
                                  padding: "5px 10px",
                                  borderRadius: 999,
                                  textDecoration: "none",
                                  fontWeight: 700,
                                }}
                              >
                                Website ↗
                              </a>
                            )}
                          </div>

                          {/* bottom fade gradient */}
                          <div
                            style={{
                              position: "sticky",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: 28,
                              pointerEvents: "none",
                              background:
                                "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.96))",
                            }}
                          />
                        </div>
                      )}

                      {/* TRAVEL */}
                      {!placeOverlayError && !placeOverlayLoading && placeTab === "travel" && placeOverlay && (
                        <div
                          style={{
                            maxHeight: 190,
                            overflowY: "auto",
                            paddingRight: 6,
                            position: "relative",
                            fontSize: "0.8rem",
                            color: "#6b7280",
                            lineHeight: 1.45,
                          }}
                        >
                          <PlaceTravelTab place={placeOverlay as any} />

                          {/* bottom fade gradient (keep same UI feel as other tabs) */}
                          <div
                            style={{
                              position: "sticky",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: 28,
                              pointerEvents: "none",
                              background:
                                "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.96))",
                            }}
                          />
                        </div>
                      )}


                      {/* NEARBY */}
                      {!placeOverlayError && !placeOverlayLoading && placeTab === "nearby" && (
                        <>
                          <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 8 }}>
                            {placeOverlay?.nearby?.length ? "Nearby places" : "No nearby places found."}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 170, overflowY: "auto", paddingRight: 6 }}>
                            {(placeOverlay?.nearby || []).slice(0, 12).map((p) => (
                              <div
                                key={p.xid}
                                style={{
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 12,
                                  padding: "8px 10px",
                                  background: "white",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                  <div style={{ fontSize: "0.84rem", fontWeight: 750, color: "#111827" }}>
                                    {p.name}
                                  </div>
                                  <div style={{ fontSize: "0.76rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                                    {formatMeters(p.dist_m)}
                                  </div>
                                </div>
                                <div style={{ marginTop: 3, fontSize: "0.75rem", color: "#6b7280" }}>
                                  {p.kinds || "—"}
                                </div>
                                {/* Optional: later make this clickable to fetch xid details */}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* PHOTOS */}
                      {!placeOverlayError && !placeOverlayLoading && placeTab === "photos" && (
                        <>
                          <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 8 }}>
                            {(photosLoading || openverseLoading)
                              ? "Loading photos…"
                              : (placeOverlay?.images?.length ?? 0) > 0
                              ? `${placeOverlay?.images?.length ?? 0} photos`
                              : "No photos available."}
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: 8,
                              maxHeight: 180,
                              overflowY: "auto",
                              paddingRight: 6,
                            }}
                          >
                            {(photosLoading || openverseLoading) && (placeOverlay?.images?.length ?? 0) === 0 ? (
                              Array.from({ length: 9 }).map((_, idx) => (
                                <div
                                  key={`sk-${idx}`}
                                  style={{
                                    width: "100%",
                                    paddingTop: "75%",
                                    borderRadius: 12,
                                    background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%)",
                                    backgroundSize: "400% 100%",
                                    animation: "tmShimmer 1.2s ease-in-out infinite",
                                  }}
                                />
                              ))
                            ) : (
                              (placeOverlay?.images || []).slice(0, 18).map((src, idx) => (
                                <button
                                  key={`${src}-${idx}`}
                                  type="button"
                                  onClick={() => openLightbox(idx)}
                                  style={{
                                    display: "block",
                                    border: "none",
                                    padding: 0,
                                    background: "transparent",
                                    borderRadius: 12,
                                    overflow: "hidden",
                                    cursor: "pointer",
                                  }}
                                  title="View photo"
                                >
                                  <div
                                    style={{
                                      width: "100%",
                                      paddingTop: "75%",
                                      background: `url(${src}) center/cover no-repeat`,
                                    }}
                                  />
                                </button>
                              ))
                            )}
                          </div>
                          {lightboxOpen && photos.length > 0 &&
                            createPortal(
                              <div
                                style={{
                                  position: "fixed",
                                  inset: 0,
                                  zIndex: 99999,
                                  background: "rgba(0,0,0,0.72)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: 24,
                                }}
                              >
                                {/* OUTER wrapper: allows arrows outside */}
                                <div
                                  style={{
                                    position: "relative",
                                    width: "min(1100px, 92vw)",
                                    height: "min(80vh, 720px)",
                                    overflow: "visible", // IMPORTANT
                                  }}
                                >
                                  {/* INNER frame: clips image nicely */}
                                  <div
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      borderRadius: 18,
                                      overflow: "hidden",
                                      background: "rgba(0,0,0,0.35)",
                                      boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
                                    }}
                                  >
                                    <img
                                      src={photos[lightboxIndex]}
                                      alt="Place photo"
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                        display: "block",
                                      }}
                                    />
                                  </div>

                                  {/* Close */}
                                  <button
                                    type="button"
                                    onClick={closeLightbox}
                                    style={{
                                      position: "absolute",
                                      top: 12,
                                      right: 12,
                                      width: 38,
                                      height: 38,
                                      borderRadius: 999,
                                      border: "1px solid rgba(255,255,255,0.22)",
                                      background: "rgba(0,0,0,0.40)",
                                      color: "white",
                                      cursor: "pointer",
                                      fontSize: 18,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      zIndex: 10,
                                    }}
                                    title="Close"
                                  >
                                    ×
                                  </button>

                                  {/* Arrows OUTSIDE the frame */}
                                  {photos.length > 1 && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={showPrev}
                                        style={{
                                          position: "absolute",
                                          left: -64,
                                          top: "50%",
                                          transform: "translateY(-50%)",
                                          width: 52,
                                          height: 52,
                                          borderRadius: 999,
                                          border: "1px solid rgba(255,255,255,0.22)",
                                          background: "rgba(0,0,0,0.40)",
                                          color: "white",
                                          cursor: "pointer",
                                          fontSize: 24,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          zIndex: 10,
                                        }}
                                        title="Previous"
                                      >
                                        ‹
                                      </button>

                                      <button
                                        type="button"
                                        onClick={showNext}
                                        style={{
                                          position: "absolute",
                                          right: -64,
                                          top: "50%",
                                          transform: "translateY(-50%)",
                                          width: 52,
                                          height: 52,
                                          borderRadius: 999,
                                          border: "1px solid rgba(255,255,255,0.22)",
                                          background: "rgba(0,0,0,0.40)",
                                          color: "white",
                                          cursor: "pointer",
                                          fontSize: 24,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          zIndex: 10,
                                        }}
                                        title="Next"
                                      >
                                        ›
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>,
                              document.body
                            )
                          }
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE: Optimise + Itinerary Planner (this scrolls) */}
          <div
            style={{
              height: "calc(90vh - 90px)",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
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

            {/* Scrollable itinerary pane */}
            <div
              ref={itineraryScrollRef}
              style={{
                backgroundColor: "white",
                padding: "0 1.25rem 1rem",
                boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
                overflowY: "auto",
                height: "100%",
              }}
            >
              {/* FULL-WIDTH sticky header background */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 30,
                  background: "white",
                  // remove the card padding effect
                  margin: "0 -1.25rem 0 -1.25rem",
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    Itinerary Planner
                  </div>

                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
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
                        boxShadow: "0 6px 15px rgba(99,102,241,0.35)",
                      }}
                      title="Reorders stops within each day for a more efficient daily route."
                    >
                      {isOptimising ? "Optimising..." : "Optimise daily routes"}
                    </button>

                    <button
                      onClick={optimiseFullTripRoute}
                      disabled={isOptimisingFull || items.length < 2}
                      style={{
                        borderRadius: "999px",
                        border: "1px solid #c7d2fe",
                        backgroundColor: "white",
                        color: "#4f46e5",
                        padding: "0.45rem 1.05rem",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        cursor:
                          isOptimisingFull || items.length < 2 ? "not-allowed" : "pointer",
                        opacity: items.length < 2 ? 0.6 : 1,
                        boxShadow: "0 6px 15px rgba(15,23,42,0.08)",
                      }}
                      title="Optimises the route across the entire trip and redistributes stops across days."
                    >
                      {isOptimisingFull ? "Optimising..." : "Optimise full trip"}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ height: "0.75rem" }} />

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                {isLoading ? (
                  <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                    Loading itinerary...
                  </div>
                ) : days.length === 0 ? (
                  <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                    No days yet.
                  </div>
                ) : (
                  days.map((day) => {
                    const dayItems = getItemsForDay(items, day.id);

                    return (
                      <DayDroppable key={day.id} dayId={day.id}>
                        {/* Sticky colored full-width day header pill */}
                        <div
                          ref={(el) => {dayHeaderRefs.current.set(day.id, el);}}
                          style={{
                            position: "sticky",
                            top: DAY_STICKY_OFFSET,
                            zIndex: 20,
                            marginBottom: "0.75rem",
                            borderRadius: "999px",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div
                            style={{
                              backgroundColor: "#f3f4ff",
                              borderRadius: "999px",
                              padding: "0.45rem 0.9rem",
                              display: "flex",
                              alignItems: "center",
                              width: "100%",
                              boxSizing: "border-box",
                              gap: "0.75rem",
                            }}
                          >
                            {/* Left: Day text */}
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                color: "#111827",
                                whiteSpace: "nowrap",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {formatDayHeaderSmart(trip, day)}
                            </div>

                            {/* Right: actions grouped together */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => openAddStopModal(day.id)}
                                style={{
                                  borderRadius: "8px",
                                  border: "1px solid #d1d5db",
                                  backgroundColor: "white",
                                  color: "#4f46e5",
                                  padding: "4px 10px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                + Add Stop
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDayCollapse(day.id);
                                }}
                                title={collapsedDayIds.includes(day.id) ? "Expand day" : "Collapse day"}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  padding: "2px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#6b7280",
                                }}
                              >
                                {collapsedDayIds.includes(day.id) ? (
                                  <ChevronRight size={16} />
                                ) : (
                                  <ChevronDown size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {!collapsedDayIds.includes(day.id) && (
                          <>
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

                                    const dayIndexNum = dayIndexMap.get(item.day ?? 0) ?? null;
                                    const baseColor = getDayColor(dayIndexNum);

                                    // create a soft/muted bubble using alpha on the hex (last 2 chars)
                                    const hex7 = baseColor.slice(0, 7); // strip the "ff" if present
                                    const bubbleBg = hex7 + "22";      // ~13% opacity
                                    const bubbleBorder = hex7 + "55";  // ~33% opacity;
                                    const bubbleText = hex7;           // full colour text

                                    return (
                                      <SortableItineraryCard
                                        key={item.id}
                                        item={item}
                                      >
                                        <div
                                          onClick={() => {
                                            setSelectedItemId(item.id);
                                            openPlaceOverlay(item);
                                          }}
                                          style={{
                                            borderRadius: "12px",
                                            padding: "0.6rem 0.8rem",
                                            border: "1px solid #e5e7eb",
                                            display: "grid",
                                            gridTemplateColumns:
                                              "auto 110px minmax(0, 1fr) auto",
                                            columnGap: "0.75rem",
                                            alignItems: "center",
                                            backgroundColor: "transparent",
                                            cursor: "pointer",
                                          }}
                                        >
                                          {/* Sequence number */}
                                          <div
                                            style={{
                                              width: 26,
                                              height: 26,
                                              borderRadius: "999px",
                                              backgroundColor: bubbleBg,
                                              color: bubbleText,
                                              border: `1px solid ${bubbleBorder}`,
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              fontSize: "0.75rem",
                                              fontWeight: 600,
                                            }}
                                          >
                                            {sequenceMap.get(item.id) ?? item.sort_order}
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
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openTimeEditor(item);
                                              }}
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
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteItem(item.id);
                                              }}
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
                          </>
                        )}
                      </DayDroppable>
                    );
                  })
                )}
              </DndContext>
            </div>
          </div>

          {/* RIGHT: Sticky mini calendar sidebar with Planbot + per-day summary */}
          <div
            style={{
              position: "sticky",
              top: 90,
              height: "calc(87vh - 90px)",
              borderRadius: 0,
              padding: "0.75rem 0.85rem",
              background:
                "linear-gradient(180deg,#f5f3ff 0%,#eef2ff 45%,#e0f2fe 100%)",
              boxShadow: "none",
              marginRight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflow: "hidden",
            }}
          >
            {/* Planbot pill at top */}
            <button
              type="button"
              onClick={() => navigate(`/trip/${tripId}/chatbot`)}
              style={{
                alignSelf: "stretch",
                borderRadius: "999px",
                border: "none",
                background:
                  "linear-gradient(135deg,#fb923c 0%,#f97316 40%,#facc15 100%)",
                color: "white",
                padding: "0.5rem 0.9rem",
                fontSize: "0.85rem",
                fontWeight: 700,
                gap: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 18px rgba(248,113,22,0.35)",
                marginBottom: 4,
              }}
            >
              <img
                src={planbotSmall}
                alt="Planbot"
                style={{
                width: 20,
                height: 20,
                objectFit: "contain",
                alignItems: "center",
                justifyContent: "center",
                }}
              /> 
              Planbot
            </button>

            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#1f2933",
                marginBottom: 4,
                paddingLeft: 2,
              }}
            >
              Itinerary
            </div>

            {/* Scrollable mini calendar list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                overflowY: "auto",
                paddingRight: 0,
                flex: 1,
                minHeight: 0,
              }}
            >
              {days.map((day) => {
                const d = day.date ? new Date(day.date) : null;
                const shortDow = d
                  ? d.toLocaleDateString(undefined, { weekday: "short" })
                  : "DAY";
                const dayMonth = d
                  ? d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })
                  : `${day.day_index}`;

                const { stops, distanceKmLabel, durationLabel } = getDaySummary(day.id);

                return (
                  <div
                    key={day.id}
                    onMouseEnter={() => setHoveredDayId(day.id)}
                    onMouseLeave={() => setHoveredDayId(null)}
                    onClick={() => {
                      setSelectedDayId(day.id);
                      scrollToDay(day.id);
                    }}
                    style={{
                      padding: "0.35rem 0.35rem",
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {/* Top line: date + Day # */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: "#111827",      // darker & bolder for date
                          }}
                        >
                          {shortDow} <span style={{ fontWeight: 500 }}>{dayMonth}</span>
                        </span>

                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "0.05rem 0.45rem",
                            borderRadius: 999,
                            backgroundColor: "rgba(148,163,184,0.18)", // soft pill
                            color: "#374151",
                            whiteSpace: "nowrap",
                            alignItems: "right",
                          }}
                        >
                          Day {day.day_index}
                        </span>
                      </div>

                      {/* Second line: soft summary */}
                      <span
                        style={{
                          marginTop: 2,
                          fontSize: "0.7rem",
                          color: "#9ca3af",        // lighter & softer
                          fontWeight: 400,
                        }}
                      >
                        {stops} stop{stops !== 1 ? "s" : ""} · {distanceKmLabel} ·{" "}
                        {durationLabel === "—" ? "time n/a" : `${durationLabel} est`}
                      </span>
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
                          fontSize: "0.85rem",
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
              })}

            </div>


            {/* Add day at bottom */}
            <button
              type="button"
              onClick={handleAddDay}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "0.4rem 0.5rem",
                borderRadius: 999,
                border: "none",
                backgroundColor: "#4f46e5",
                color: "white",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(79,70,229,0.25)",
              }}
            >
              + Add Day
            </button>
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
                biasCity={trip?.main_city ?? ""}
                biasCountry={trip?.main_country ?? ""}  
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
      <style>
        {`
          @keyframes tmShimmer {
            0% { background-position: 100% 0; }
            100% { background-position: 0 0; }
          }
        `}
      </style>
    </>
  );
}
