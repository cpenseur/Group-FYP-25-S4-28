// frontend/src/pages/notesAndChecklistPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTripId } from "../hooks/useDecodedParams";
import { encodeId } from "../lib/urlObfuscation";

import TripSubHeader from "../components/TripSubHeader";
import ItineraryMap, { MapItineraryItem } from "../components/ItineraryMap";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

/* =========================
   Types (match F1 response)
========================= */

type ItineraryItem = {
  id: number;
  title: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  sort_order: number;
  day: number | null; // TripDay PK
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

/* =========================
   Notes/Checklist types
   (MATCH PYTHON BACKEND)
========================= */

interface Note {
  id: number;
  item: number; // backend field
  content: string;
  created_at?: string;
  updated_at?: string;
}

interface ItineraryItemTag {
  id: number;
  item: number;
  tag: string;
  created_at?: string;
}

interface ChecklistItem {
  id: number;
  checklist?: number;
  label: string;
  is_completed: boolean;
  sort_order?: number;
  due_date?: string | null;
}

interface Checklist {
  id: number;
  trip?: number | null;
  name: string;
  description?: string | null;
  checklist_type?: string | null;
  items: ChecklistItem[];
}

type MenuType = "notes" | "checklists" | null;
type ModalType =
  | "noteForm"
  | "notesList"
  | "checklistForm"
  | "checklistList"
  | "deleteConfirm"
  | null;

export default function NotesAndChecklistPage() {
  const navigate = useNavigate();
  const tripId = useTripId();

  const tripIdNum = useMemo(() => Number(tripId), [tripId]);

  // auth user (optional)
  const [user, setUser] = useState<any>(null);

  // Trip data for map + sidebar
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [days, setDays] = useState<TripDayResponse[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [mapItems, setMapItems] = useState<MapItineraryItem[]>([]);
  const [loadingTrip, setLoadingTrip] = useState(false);

  // Selected itinerary item for notes
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Notes / Checklists
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const [tagsByItem, setTagsByItem] = useState<Record<number, ItineraryItemTag[]>>({});
  const [newTagsInput, setNewTagsInput] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [newChecklistName, setNewChecklistName] = useState("");
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [editingChecklistItems, setEditingChecklistItems] = useState<ChecklistItem[]>([]);

  const [openMenu, setOpenMenu] = useState<MenuType>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "note" | "checklist";
    id: number;
  } | null>(null);

  // UI: previews
  const NOTES_PREVIEW_COUNT = 3;
  const CHECKLISTS_PREVIEW_COUNT = 3;
  const CHECKLIST_ITEMS_PREVIEW_COUNT = 3;

  const notesPreview = useMemo(
    () => (Array.isArray(notes) ? notes.slice(0, NOTES_PREVIEW_COUNT) : []),
    [notes]
  );

  const checklistsPreview = useMemo(
    () =>
      Array.isArray(checklists) ? checklists.slice(0, CHECKLISTS_PREVIEW_COUNT) : [],
    [checklists]
  );

  /* =========================
     Load user (supabase)
  ========================= */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    })();
  }, []);

  /* =========================
     Load trip (F1) for map + sidebar
  ========================= */
  useEffect(() => {
    if (!tripIdNum || Number.isNaN(tripIdNum)) return;

    (async () => {
      try {
        setLoadingTrip(true);

        const data: TripResponse = await apiFetch(`/f1/trips/${tripIdNum}/`);

        const safeDays = Array.isArray(data?.days) ? data.days : [];
        const safeItems = Array.isArray(data?.items) ? data.items : [];

        setTrip(data);
        setDays(safeDays);
        setItems(safeItems);

        if (safeItems.length > 0) setSelectedItemId(safeItems[0].id);

        const dayIndexMap = new Map<number, number>();
        safeDays.forEach((d) => dayIndexMap.set(d.id, d.day_index));

        const itemsInTripOrder = [...safeItems].sort((a, b) => {
          const da = dayIndexMap.get(a.day ?? 0) ?? 0;
          const db = dayIndexMap.get(b.day ?? 0) ?? 0;
          if (da !== db) return da - db;
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        });

        const mapped: MapItineraryItem[] = itemsInTripOrder.map((it, idx) => ({
            id: it.id,
            title: it.title,
            address: it.address ?? null,
            lat: it.lat,
            lon: it.lon,
            sort_order: idx + 1,
            day_index: it.day ? dayIndexMap.get(it.day) ?? null : null,
            stop_index: null,
          }));

        setMapItems(mapped);
      } catch (e) {
        console.error("Failed to load trip for notes page", e);
        setTrip(null);
        setDays([]);
        setItems([]);
        setMapItems([]);
      } finally {
        setLoadingTrip(false);
      }
    })();
  }, [tripIdNum]);

  /* =========================
     Helpers: refresh F3 lists
  ========================= */
  const refreshNotes = async () => {
    if (!tripIdNum || Number.isNaN(tripIdNum)) return;
    try {
      const data = await apiFetch(`/f3/notes/?trip=${tripIdNum}`);
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
    }
  };

  const refreshChecklists = async () => {
    if (!tripIdNum || Number.isNaN(tripIdNum)) return;
    try {
      const data = await apiFetch(`/f3/checklists/?trip=${tripIdNum}`);
      setChecklists(Array.isArray(data) ? data : []);
    } catch {
      setChecklists([]);
    }
  };

  const parseTags = (raw: string) =>
    raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const getTagsForItem = (itemId: number) => tagsByItem[itemId] || [];

  const deleteTagsForItem = async (itemId: number) => {
    const existing = getTagsForItem(itemId);
    if (existing.length === 0) return;
    await Promise.all(
      existing.map((t) =>
        apiFetch(`/f3/tags/${t.id}/`, { method: "DELETE" }).catch(() => null)
      )
    );
    await refreshTagsByTrip();
  };

  const syncTagsForItem = async (itemId: number, rawInput: string) => {
    const desired = parseTags(rawInput);
    const desiredSet = new Set(desired.map((t) => t.toLowerCase()));
    const existing = getTagsForItem(itemId);
    const existingByLower = new Map(existing.map((t) => [t.tag.toLowerCase(), t]));

    const toDelete = existing.filter((t) => !desiredSet.has(t.tag.toLowerCase()));
    const toAdd = desired.filter((t) => !existingByLower.has(t.toLowerCase()));

    await Promise.all(
      toDelete.map((t) =>
        apiFetch(`/f3/tags/${t.id}/`, { method: "DELETE" }).catch(() => null)
      )
    );

    await Promise.all(
      toAdd.map((tag) =>
        apiFetch(`/f3/tags/`, {
          method: "POST",
          body: JSON.stringify({ item: itemId, tag }),
        }).catch(() => null)
      )
    );

    await refreshTagsByTrip();
  };

  const refreshTagsByTrip = async () => {
    if (!tripIdNum || Number.isNaN(tripIdNum)) return;
    try {
      const data = await apiFetch(`/f3/tags/?trip=${tripIdNum}`);
      const grouped: Record<number, ItineraryItemTag[]> = {};
      if (Array.isArray(data)) {
        data.forEach((t) => {
          if (!grouped[t.item]) grouped[t.item] = [];
          grouped[t.item].push(t);
        });
      }
      setTagsByItem(grouped);
    } catch {
      setTagsByItem({});
    }
  };

  /* =========================
     Load + poll notes & checklists (F3)
  ========================= */
  useEffect(() => {
    if (!tripIdNum || Number.isNaN(tripIdNum)) return;

    let isActive = true;
    const poll = async () => {
      if (!isActive) return;
      await Promise.all([refreshNotes(), refreshChecklists(), refreshTagsByTrip()]);
    };

    poll();
    const intervalId = window.setInterval(poll, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripIdNum]);

  /* =========================
     Outside click closes menu
  ========================= */
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".menu-wrapper")) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const toggleMenu = (menu: Exclude<MenuType, null>) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  /* =========================
     REAL DB actions (F3)
  ========================= */

  const saveNote = async () => {
    if (!newNote.trim()) return false;

    const itemId = selectedItemId ?? (items.length ? items[0].id : null);
    if (!itemId) {
      alert("No itinerary item found for this trip. Add itinerary first.");
      return false;
    }

    try {
      if (editingNote) {
        const updated = await apiFetch(`/f3/notes/${editingNote.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ content: newNote, item: itemId }),
        });
        setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? updated : n)));
        setEditingNote(null);
      } else {
        const created = await apiFetch(`/f3/notes/`, {
          method: "POST",
          body: JSON.stringify({ item: itemId, content: newNote }),
        });
        setNotes((prev) => [created, ...prev]);
      }
      if (editingNote) {
        await syncTagsForItem(itemId, newTagsInput);
        setNewTagsInput("");
        setTagError(null);
      } else {
        const parsedTags = parseTags(newTagsInput);
        if (parsedTags.length > 0) {
          await Promise.all(
            parsedTags.map((tag) =>
              apiFetch(`/f3/tags/`, {
                method: "POST",
                body: JSON.stringify({ item: itemId, tag }),
              }).catch(() => null)
            )
          );
          await refreshTagsByTrip();
          setNewTagsInput("");
          setTagError(null);
        }
      }
      setNewNote("");
      return true;
    } catch (e) {
      console.error(e);
      alert("Failed to save note (check backend/auth).");
      return false;
    }
  };

  const deleteNote = async (id: number) => {
    const noteToDelete = notes.find((n) => n.id === id);
    const itemId = noteToDelete?.item ?? null;
    try {
      await apiFetch(`/f3/notes/${id}/`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (itemId) {
        const remainingForItem = notes.filter((n) => n.item === itemId && n.id !== id)
          .length;
        if (remainingForItem === 0) {
          await deleteTagsForItem(itemId);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete note.");
    }
  };

  const saveChecklist = async () => {
    if (!newChecklistName.trim()) return false;

    try {
      let checklist: any;
      if (editingChecklist) {
        checklist = await apiFetch(`/f3/checklists/${editingChecklist.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ name: newChecklistName, trip: tripIdNum }),
        });
      } else {
        checklist = await apiFetch(`/f3/checklists/`, {
          method: "POST",
          body: JSON.stringify({ name: newChecklistName, trip: tripIdNum }),
        });
      }

      if (editingChecklist) {
        const oldItems = await apiFetch(`/f3/checklist-items/?checklist=${checklist.id}`);
        if (Array.isArray(oldItems)) {
          await Promise.all(
            oldItems.map((it: any) =>
              apiFetch(`/f3/checklist-items/${it.id}/`, { method: "DELETE" })
            )
          );
        }
      }

      const cleanItems = editingChecklistItems
        .map((it, idx) => ({
          checklist: checklist.id,
          label: it.label.trim(),
          is_completed: !!it.is_completed,
          sort_order: idx,
        }))
        .filter((it) => it.label.length > 0);

      await Promise.all(
        cleanItems.map((payload) =>
          apiFetch(`/f3/checklist-items/`, {
            method: "POST",
            body: JSON.stringify(payload),
          })
        )
      );

      await refreshChecklists();

      setNewChecklistName("");
      setEditingChecklistItems([]);
      setEditingChecklist(null);
      return true;
    } catch (e) {
      console.error(e);
      alert("Failed to save checklist.");
      return false;
    }
  };

  const deleteChecklist = async (id: number) => {
    try {
      await apiFetch(`/f3/checklists/${id}/`, { method: "DELETE" });
      setChecklists((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete checklist.");
    }
  };

  const toggleItem = async (checklistId: number, itemId: number) => {
    const checklist = checklists.find((c) => c.id === checklistId);
    const item = checklist?.items.find((i) => i.id === itemId);
    if (!item) return;

    try {
      await apiFetch(`/f3/checklist-items/${itemId}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_completed: !item.is_completed }),
      });
      await refreshChecklists();
    } catch (e) {
      console.error(e);
      alert("Failed to update checklist item.");
    }
  };

  /* =========================
     Modal open/close helpers
  ========================= */
  const openNoteForm = (note?: Note) => {
    setEditingNote(note || null);
    setNewNote(note?.content || "");

    if (note?.item) setSelectedItemId(note.item);
    if (note?.item) {
      const existingTags = getTagsForItem(note.item).map((t) => t.tag).join(", ");
      setNewTagsInput(existingTags);
    } else {
      setNewTagsInput("");
    }

    setActiveModal("noteForm");
    setOpenMenu(null);
  };

  const openChecklistForm = (checklist?: Checklist) => {
    setEditingChecklist(checklist || null);
    setNewChecklistName(checklist?.name || "");
    setEditingChecklistItems(checklist?.items ? checklist.items.map((i) => ({ ...i })) : []);
    setActiveModal("checklistForm");
    setOpenMenu(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setEditingNote(null);
    setEditingChecklist(null);
    setDeleteTarget(null);
    setNewNote("");
    setNewTagsInput("");
    setTagError(null);
    setNewChecklistName("");
    setEditingChecklistItems([]);
  };

  const requestDeleteNote = (id: number) => {
    setDeleteTarget({ type: "note", id });
    setActiveModal("deleteConfirm");
  };

  const requestDeleteChecklist = (id: number) => {
    setDeleteTarget({ type: "checklist", id });
    setActiveModal("deleteConfirm");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "note") await deleteNote(deleteTarget.id);
    if (deleteTarget.type === "checklist") await deleteChecklist(deleteTarget.id);
    closeModal();
  };

  /* =========================
     Checklist form local rows
  ========================= */
  const addChecklistItemRow = () => {
    setEditingChecklistItems((prev) => [
      ...prev,
      { id: Date.now(), label: "", is_completed: false },
    ]);
  };

  const updateChecklistItemLabel = (id: number, label: string) => {
    setEditingChecklistItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label } : item))
    );
  };

  const toggleChecklistItemCompleted = (id: number) => {
    setEditingChecklistItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_completed: !item.is_completed } : item
      )
    );
  };

  const removeChecklistItemRow = (id: number) => {
    setEditingChecklistItems((prev) => prev.filter((item) => item.id !== id));
  };

  /* =========================
     Sidebar: quick day summary
  ========================= */
  const getStopsForDay = (dayId: number) => items.filter((it) => it.day === dayId).length;

  /* =========================
     Small preview cards
  ========================= */
  const noteCard = (n: Note) => {
    const itemTitle = items.find((it) => it.id === n.item)?.title ?? "Itinerary stop";

    return (
      <div
        key={n.id}
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 16,
          background: "white",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
          {itemTitle}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(tagsByItem[n.item] || []).map((t) => (
            <span
              key={t.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 10px",
                borderRadius: 999,
                background: "#e5e7eb",
                color: "#4b5563",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {t.tag}
            </span>
          ))}
        </div>

        <div style={{ color: "#111827", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>
          {n.content.length > 160 ? n.content.slice(0, 160) + "…" : n.content}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 6, justifyContent: "flex-end" }}>
          <button
            style={iconBtnStyle}
            onClick={() => openNoteForm(n)}
            type="button"
            aria-label="Edit note"
          >
            <EditIcon />
          </button>
          <button
            style={iconDangerBtnStyle}
            onClick={() => requestDeleteNote(n.id)}
            type="button"
            aria-label="Delete note"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    );
  };

  const checklistCard = (c: Checklist) => {
    const previewItems = (c.items || []).slice(0, CHECKLIST_ITEMS_PREVIEW_COUNT);

    return (
      <div
        key={c.id}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          background: "white",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 800, color: "#111827", fontSize: 14 }}>{c.name}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={iconBtnStyle}
              onClick={() => openChecklistForm(c)}
              type="button"
              aria-label="Edit checklist"
            >
              <EditIcon />
            </button>
            <button
              style={iconDangerBtnStyle}
              onClick={() => requestDeleteChecklist(c.id)}
              type="button"
              aria-label="Delete checklist"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {previewItems.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 13 }}>No items yet.</div>
          ) : (
            previewItems.map((i) => (
              <label
                key={i.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                <input
                  type="checkbox"
                  checked={i.is_completed}
                  onChange={() => toggleItem(c.id, i.id)}
                />
                <span style={{ textDecoration: i.is_completed ? "line-through" : "none" }}>
                  {i.label}
                </span>
              </label>
            ))
          )}

          {c.items && c.items.length > CHECKLIST_ITEMS_PREVIEW_COUNT && (
            <button
              style={linkBtnStyle}
              onClick={() => setActiveModal("checklistList")}
              type="button"
            >
              View more items…
            </button>
          )}
        </div>

        <div style={{ marginTop: 12 }} />
      </div>
    );
  };

  return (
    <>
      <TripSubHeader />

      <div
        style={{
          background: "#f5f7fb",
          minHeight: "100vh",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: 24,
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr 0.42fr",
            gap: 18,
            alignItems: "start",
          }}
        >
          {/* LEFT: Map */}
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              border: "1px solid #e8edff",
              boxShadow: "0 8px 24px rgba(24, 49, 90, 0.08)",
              overflow: "hidden",
              minHeight: 560,
            }}
          >
            <ItineraryMap items={mapItems} />
          </div>

          {/* MIDDLE: Notes & Checklists panels */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Notes */}
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 8px 24px rgba(24, 49, 90, 0.08)",
                border: "1px solid #e8edff",
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1a2b4d" }}>
                  Notes
                </h2>

                <div className="menu-wrapper" style={{ position: "relative", display: "flex", gap: 8 }}>
                  

                  <button
                    onClick={() => toggleMenu("notes")}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      border: "1px solid #dbe5ff",
                      background: "#eef2ff",
                      cursor: "pointer",
                      fontWeight: 800,
                    }}
                    type="button"
                  >
                    …
                  </button>

                  {openMenu === "notes" && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 46,
                        background: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
                        overflow: "hidden",
                        minWidth: 170,
                        zIndex: 50,
                      }}
                    >
                      <button style={menuBtnStyle} onClick={() => openNoteForm()}>
                        + Add Note
                      </button>
                      <button style={menuBtnStyle} onClick={() => setActiveModal("notesList")}>
                        View Notes
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {notes.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    No notes yet. Click “…” → Add Note.
                  </div>
                ) : (
                  notesPreview.map(noteCard)
                )}

                {notes.length > NOTES_PREVIEW_COUNT && (
                  <button
                    style={{ ...linkBtnStyle, alignSelf: "flex-start" }}
                    onClick={() => setActiveModal("notesList")}
                    type="button"
                  >
                    View all notes…
                  </button>
                )}
              </div>
            </div>

            {/* Checklists */}
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 8px 24px rgba(24, 49, 90, 0.08)",
                border: "1px solid #e8edff",
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1a2b4d" }}>
                  Checklists
                </h2>

                <div className="menu-wrapper" style={{ position: "relative", display: "flex", gap: 8 }}>
                  

                  <button
                    onClick={() => toggleMenu("checklists")}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      border: "1px solid #dbe5ff",
                      background: "#eef2ff",
                      cursor: "pointer",
                      fontWeight: 800,
                    }}
                    type="button"
                  >
                    …
                  </button>

                  {openMenu === "checklists" && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 46,
                        background: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
                        overflow: "hidden",
                        minWidth: 190,
                        zIndex: 50,
                      }}
                    >
                      <button style={menuBtnStyle} onClick={() => openChecklistForm()}>
                        + Add Checklist
                      </button>
                      <button style={menuBtnStyle} onClick={() => setActiveModal("checklistList")}>
                        View Checklists
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {checklists.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    No checklists yet. Click “…” → Add Checklist.
                  </div>
                ) : (
                  checklistsPreview.map(checklistCard)
                )}

                {checklists.length > CHECKLISTS_PREVIEW_COUNT && (
                  <button
                    style={{ ...linkBtnStyle, alignSelf: "flex-start" }}
                    onClick={() => setActiveModal("checklistList")}
                    type="button"
                  >
                    View all checklists…
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Planbot + mini itinerary */}
          <div
            style={{
              position: "sticky",
              top: 90,
              height: "calc(87vh - 90px)",
              padding: "0.75rem 0.85rem",
              background: "linear-gradient(180deg,#f5f3ff 0%,#eef2ff 45%,#e0f2fe 100%)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => navigate(`/v/${encodeId(tripIdNum!)}/ch`)}
              style={{
                alignSelf: "stretch",
                borderRadius: "999px",
                border: "none",
                background: "linear-gradient(135deg,#fb923c 0%,#f97316 40%,#facc15 100%)",
                color: "white",
                padding: "0.5rem 0.9rem",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 18px rgba(248,113,22,0.35)",
                marginBottom: 4,
              }}
            >
              ✨ Planbot
            </button>

            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1f2933", marginBottom: 4 }}>
              Itinerary
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
              {days.map((day) => {
                const d = day.date ? new Date(day.date) : null;
                const shortDow = d
                  ? d.toLocaleDateString(undefined, { weekday: "short" })
                  : "DAY";
                const dayMonth = d
                  ? d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })
                  : `${day.day_index}`;

                const stops = getStopsForDay(day.id);

                return (
                  <div
                    key={day.id}
                    style={{
                      padding: "0.35rem 0.35rem",
                      borderRadius: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      cursor: "default",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827" }}>
                          {shortDow} <span style={{ fontWeight: 500 }}>{dayMonth}</span>
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "0.05rem 0.45rem",
                            borderRadius: 999,
                            backgroundColor: "rgba(148,163,184,0.18)",
                            color: "#374151",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Day {day.day_index}
                        </span>
                      </div>

                      <span style={{ marginTop: 2, fontSize: "0.7rem", color: "#9ca3af", fontWeight: 400 }}>
                        {stops} stop{stops !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ============ Modals ============ */}
        {activeModal === "noteForm" && (
          <Modal onClose={closeModal} title={editingNote ? "Edit Note" : "Add Note"}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                Attach note to itinerary stop
              </div>
              <select
                value={selectedItemId ?? ""}
                onChange={(e) => setSelectedItemId(Number(e.target.value))}
                style={inputStyle}
              >
                {items.length === 0 && (
                  <option value="" disabled>
                    No itinerary items yet
                  </option>
                )}
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                Tags (comma separated)
              </div>
              <input
                value={newTagsInput}
                onChange={(e) => setNewTagsInput(e.target.value)}
                placeholder="Cafe, Zoo, Landmark..."
                style={inputStyle}
              />
              {tagError && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>{tagError}</div>}
            </div>

            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write your note…"
              style={textAreaStyle}
            />

            <div style={modalFooterStyle}>
              <button onClick={closeModal} style={secondaryBtnStyle}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ok = await saveNote();
                  if (ok) closeModal();
                }}
                style={primaryBtnStyle}
              >
                Save
              </button>
            </div>
          </Modal>
        )}

        {activeModal === "notesList" && (
          <Modal onClose={closeModal} title={`Notes (${notes.length})`}>
            {notes.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No notes yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {notes.map(noteCard)}
              </div>
            )}
          </Modal>
        )}

        {activeModal === "checklistForm" && (
          <Modal onClose={closeModal} title={editingChecklist ? "Edit Checklist" : "Add Checklist"}>
            <input
              value={newChecklistName}
              onChange={(e) => setNewChecklistName(e.target.value)}
              placeholder="Checklist name"
              style={inputStyle}
            />

            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 700, color: "#111827" }}>Items</div>
                <button onClick={addChecklistItemRow} style={secondaryBtnStyle} type="button">
                  + Add Item
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                {editingChecklistItems.length === 0 && (
                  <div style={{ color: "#6b7280" }}>No items yet.</div>
                )}

                {editingChecklistItems.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr auto",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={it.is_completed}
                      onChange={() => toggleChecklistItemCompleted(it.id)}
                    />
                    <input
                      value={it.label}
                      onChange={(e) => updateChecklistItemLabel(it.id, e.target.value)}
                      placeholder="Item label"
                      style={inputStyle}
                    />
                    <button
                      onClick={() => removeChecklistItemRow(it.id)}
                      style={iconDangerBtnStyle}
                      type="button"
                      aria-label="Delete item"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button onClick={closeModal} style={secondaryBtnStyle}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ok = await saveChecklist();
                  if (ok) closeModal();
                }}
                style={primaryBtnStyle}
              >
                Save
              </button>
            </div>
          </Modal>
        )}

        {activeModal === "checklistList" && (
          <Modal onClose={closeModal} title={`Checklists (${checklists.length})`}>
            {checklists.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No checklists yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {checklists.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 12,
                      background: "white",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#111827" }}>{c.name}</div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      {(c.items || []).map((i) => (
                        <label key={i.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={i.is_completed}
                            onChange={() => toggleItem(c.id, i.id)}
                          />
                          <span style={{ color: "#111827" }}>{i.label}</span>
                        </label>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                      <button
                        style={iconBtnStyle}
                        onClick={() => openChecklistForm(c)}
                        type="button"
                        aria-label="Edit checklist"
                      >
                        <EditIcon />
                      </button>
                      <button
                        style={iconDangerBtnStyle}
                        onClick={() => requestDeleteChecklist(c.id)}
                        type="button"
                        aria-label="Delete checklist"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}

        {activeModal === "deleteConfirm" && (
          <Modal onClose={closeModal} title="Confirm Delete">
            <div style={{ color: "#111827" }}>Are you sure you want to delete this?</div>
            <div style={modalFooterStyle}>
              <button onClick={closeModal} style={secondaryBtnStyle}>
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} style={dangerBtnStyle}>
                Delete
              </button>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

/* =========================
   Small reusable UI bits
========================= */

const menuBtnStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: "none",
  background: "white",
  cursor: "pointer",
  fontWeight: 600,
  boxSizing: "border-box",
};

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 620,
          maxWidth: "100%",
          background: "white",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 18px 45px rgba(0,0,0,0.25)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
            }}
            type="button"
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: 14, boxSizing: "border-box" }}>{children}</div>
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 16.5V20h3.5L19 8.5 15.5 5 4 16.5Zm16.7-10.7a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.2 1.2L19.5 7l1.2-1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z"
        fill="currentColor"
      />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "12px 14px",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
  display: "block",
};

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minHeight: 170,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "12px 14px",
  outline: "none",
  fontSize: 14,
  resize: "vertical",
  boxSizing: "border-box",
  display: "block",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 16,
};

const primaryBtnStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 16px",
  cursor: "pointer",
  background: "linear-gradient(120deg, #2f7bff, #53a3ff)",
  color: "white",
  fontWeight: 800,
};

const secondaryBtnStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "10px 16px",
  cursor: "pointer",
  background: "white",
  color: "#111827",
  fontWeight: 700,
};

const iconBtnStyle: React.CSSProperties = {
  border: "1px solid #dbe5ff",
  borderRadius: 10,
  width: 36,
  height: 36,
  cursor: "pointer",
  background: "#eaf2ff",
  color: "#1e3a8a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 6px 12px rgba(30, 64, 175, 0.12)",
};

const iconDangerBtnStyle: React.CSSProperties = {
  ...iconBtnStyle,
  background: "#ffe4e6",
  border: "1px solid #fecdd3",
  color: "#be123c",
  boxShadow: "0 6px 12px rgba(190, 18, 60, 0.12)",
};

const dangerBtnStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 16px",
  cursor: "pointer",
  background: "#fee2e2",
  color: "#b91c1c",
  fontWeight: 800,
};

const linkBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#2563eb",
  fontWeight: 700,
  fontSize: 13,
  padding: 0,
};

