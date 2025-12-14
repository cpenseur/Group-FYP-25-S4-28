import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

interface ChecklistItem {
  id: number;
  label: string;
  completed: boolean;
}
interface Checklist {
  id: number;
  name: string;
  items: ChecklistItem[];
}
interface Note {
  id: number;
  content: string;
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
  const [user, setUser] = useState<any>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);

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

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    getUser();
    loadNotes();
    loadChecklists();
  }, []);

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

  const loadNotes = async () => {
    try {
      const data = await apiFetch("/notes/dummy"); // TODO: replace with real endpoint
      setNotes(data || []);
    } catch (err) {
      console.error("Failed to load notes");
    }
  };

  const loadChecklists = async () => {
    try {
      const data = await apiFetch("/checklists/dummy"); // TODO: replace with real endpoint
      setChecklists(data || []);
    } catch (err) {
      console.error("Failed to load checklists");
    }
  };

  const saveNote = () => {
    if (!newNote.trim()) return false;
    if (editingNote) {
      setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? { ...n, content: newNote } : n)));
      setEditingNote(null);
    } else {
      setNotes((prev) => [...prev, { id: Date.now(), content: newNote }]);
    }
    setNewNote("");
    return true;
  };

  const deleteNote = (id: number) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const saveChecklist = () => {
    if (!newChecklistName.trim()) return false;
    if (editingChecklist) {
      setChecklists((prev) =>
        prev.map((c) =>
          c.id === editingChecklist.id ? { ...c, name: newChecklistName, items: editingChecklistItems } : c
        )
      );
      setEditingChecklist(null);
    } else {
      setChecklists((prev) => [...prev, { id: Date.now(), name: newChecklistName, items: editingChecklistItems }]);
    }
    setNewChecklistName("");
    setEditingChecklistItems([]);
    return true;
  };

  const deleteChecklist = (id: number) => setChecklists((prev) => prev.filter((c) => c.id !== id));

  const toggleItem = (checklistId: number, itemId: number) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i)),
            }
          : c
      )
    );
  };

  const openNoteForm = (note?: Note) => {
    setEditingNote(note || null);
    setNewNote(note?.content || "");
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

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "note") deleteNote(deleteTarget.id);
    if (deleteTarget.type === "checklist") deleteChecklist(deleteTarget.id);
    closeModal();
  };

  const addChecklistItemRow = () => {
    setEditingChecklistItems((prev) => [...prev, { id: Date.now(), label: "", completed: false }]);
  };

  const updateChecklistItemLabel = (id: number, label: string) => {
    setEditingChecklistItems((prev) => prev.map((item) => (item.id === id ? { ...item, label } : item)));
  };

  const toggleChecklistItemCompleted = (id: number) => {
    setEditingChecklistItems((prev) => prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)));
  };

  const removeChecklistItemRow = (id: number) => {
    setEditingChecklistItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <>
      {/* Inline CSS so you only need ONE TSX file */}
      <style>{`
        .notes-checklist-container {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
          padding: 24px;
          background: #f5f7fb;
          min-height: 100vh;
          font-family: "Inter", "Segoe UI", sans-serif;
        }

        .map-card {
          background: linear-gradient(135deg, #c8e4ff, #f2f7ff);
          border-radius: 18px;
          min-height: 520px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
          border: 1px solid #e5edff;
        }

        .panel-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-card {
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(24, 49, 90, 0.08);
          border: 1px solid #e8edff;
          padding: 16px 18px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .section-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1a2b4d;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .add-btn,
        .save-btn,
        .icon-btn {
          border: none;
          cursor: pointer;
          font-weight: 600;
        }

        .add-btn,
        .save-btn {
          background: linear-gradient(120deg, #2f7bff, #53a3ff);
          color: #fff;
          padding: 8px 12px;
          border-radius: 10px;
          box-shadow: 0 6px 14px rgba(47, 123, 255, 0.3);
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }

        .add-btn:hover,
        .save-btn:hover {
          transform: translateY(-1px);
        }

        .icon-btn {
          background: none;
          color: #1f3a6f;
          padding: 6px;
          border-radius: 8px;
        }

        .icon-btn.danger {
          color: #c0392b;
        }

        .menu-wrapper {
          position: relative;
        }

        .menu-btn {
          background: #eef2ff;
          border: 1px solid #d5def7;
          color: #33415c;
          border-radius: 10px;
          padding: 6px 10px;
          cursor: pointer;
        }

        .menu-dropdown {
          position: absolute;
          top: 40px;
          right: 0;
          background: #fff;
          border: 1px solid #dce5ff;
          border-radius: 14px;
          box-shadow: 0 10px 26px rgba(18, 35, 87, 0.12);
          display: flex;
          flex-direction: column;
          min-width: 180px;
          z-index: 5;
        }

        .menu-item {
          background: transparent;
          border: none;
          text-align: left;
          padding: 12px 14px;
          font-weight: 600;
          color: #1d2d50;
          cursor: pointer;
        }

        .menu-item:hover {
          background: #f2f6ff;
        }

        .input-row {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
        }

        textarea,
        input[type="text"] {
          flex: 1;
          border: 1px solid #d8e4ff;
          border-radius: 10px;
          padding: 10px 12px;
          background: #f8fbff;
          font-size: 14px;
          resize: vertical;
        }

        .note-card {
          background: #e9f2ff;
          border: 1px solid #d6e6ff;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .note-content {
          color: #1b2b4d;
          margin: 0;
          line-height: 1.4;
          overflow-wrap: anywhere;
          word-break: break-word;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .note-actions {
          display: flex;
          gap: 8px;
        }

        .checklist-card {
          border: 1px solid #dfe7ff;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
          background: #fff;
        }

        .checklist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .checklist-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          border-bottom: 1px solid #eef2ff;
        }

        .checklist-item:last-child {
          border-bottom: none;
        }

        .checklist-item .done {
          text-decoration: line-through;
          color: #6b7c9c;
        }

        .add-item-btn {
          background: none;
          border: 1px dashed #9bb8ff;
          color: #2f7bff;
          padding: 8px 10px;
          border-radius: 10px;
          margin-top: 8px;
          cursor: pointer;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(13, 24, 48, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
          padding: 20px;
        }

        .modal-card {
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          width: min(640px, 90vw);
          box-shadow: 0 14px 34px rgba(20, 45, 105, 0.18);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .close-btn {
          background: none;
          border: 1px solid #d5def7;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          cursor: pointer;
          font-size: 16px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 6px;
        }

        .ghost-btn {
          background: transparent;
          border: 1px solid #c8d6ff;
          color: #1f3a6f;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
        }

        .primary-btn {
          background: #1f6bce;
          color: #fff;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
        }

        .danger-btn {
          background: #d64545;
          color: #fff;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
        }

        .modal-list {
          max-height: 360px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .modal-list-item {
          border: 1px solid #e1e9ff;
          border-radius: 12px;
          padding: 12px;
          background: #f7f9ff;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .checklist-item-row h4 {
          margin: 0 0 6px 0;
        }

        .compact-list {
          margin: 0;
          padding-left: 18px;
          color: #1c2c4f;
        }

        .compact-list .done {
          text-decoration: line-through;
          color: #6b7c9c;
        }

        .muted {
          color: #7c8aa8;
        }

        .empty-copy {
          color: #6d7fa3;
          margin: 0;
        }

        .item-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .item-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .item-input {
          flex: 1;
          border: 1px solid #d8e4ff;
          border-radius: 8px;
          padding: 8px 10px;
          background: #f8fbff;
        }

        .add-item-inline {
          background: none;
          border: 1px dashed #9bb8ff;
          color: #2f7bff;
          padding: 8px 10px;
          border-radius: 10px;
          cursor: pointer;
          align-self: flex-start;
        }

        .confirm-copy {
          margin: 0 0 4px 0;
          color: #1a2b4d;
        }

        /* Allow full text in modals (no clamp), clamp in cards */
        .modal-card .note-content {
          display: block;
          -webkit-line-clamp: unset;
          -webkit-box-orient: unset;
          overflow: visible;
          overflow-wrap: anywhere;
          word-break: break-word;
          line-height: 1.5;
        }

        @media (max-width: 1024px) {
          .notes-checklist-container {
            grid-template-columns: 1fr;
          }
          .map-card {
            min-height: 320px;
          }
        }
      `}</style>

      <div className="notes-checklist-container">
        <div className="map-card">{/* TODO: embed real map here */}</div>

        <div className="panel-stack">
          <section className="section-card">
            <div className="section-header">
              <h2>Notes</h2>
              <div className="toolbar">
                <div className="menu-wrapper">
                  <button className="menu-btn" aria-label="Notes menu" onClick={() => toggleMenu("notes")}>
                    ⋯
                  </button>
                  {openMenu === "notes" && (
                    <div className="menu-dropdown">
                      <button className="menu-item" onClick={() => openNoteForm()}>
                        + Add New Note
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          setActiveModal("notesList");
                          setOpenMenu(null);
                        }}
                      >
                        See All Notes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {notes.map((note) => (
              <div key={note.id} className="note-card">
                <p className="note-content">{note.content}</p>
                <div className="note-actions">
                  <button className="icon-btn" title="Edit" onClick={() => openNoteForm(note)}>
                    ✏
                  </button>
                  <button className="icon-btn" title="Delete" onClick={() => requestDeleteNote(note.id)}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section className="section-card">
            <div className="section-header">
              <h2>Checklists</h2>
              <div className="toolbar">
                <div className="menu-wrapper">
                  <button className="menu-btn" aria-label="Checklist menu" onClick={() => toggleMenu("checklists")}>
                    ⋯
                  </button>
                  {openMenu === "checklists" && (
                    <div className="menu-dropdown">
                      <button className="menu-item" onClick={() => openChecklistForm()}>
                        + Add New Checklist
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          setActiveModal("checklistList");
                          setOpenMenu(null);
                        }}
                      >
                        See All Checklists
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {checklists.map((checklist) => (
              <div key={checklist.id} className="checklist-card">
                <div className="checklist-header">
                  <h3>{checklist.name}</h3>
                  <div>
                    <button className="icon-btn" title="Edit" onClick={() => openChecklistForm(checklist)}>
                      ✏
                    </button>
                    <button className="icon-btn" title="Delete" onClick={() => requestDeleteChecklist(checklist.id)}>
                      🗑
                    </button>
                  </div>
                </div>

                <ul>
                  {checklist.items.map((item) => (
                    <li key={item.id} className="checklist-item">
                      <input type="checkbox" checked={item.completed} onChange={() => toggleItem(checklist.id, item.id)} />
                      <span className={item.completed ? "done" : ""}>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>

        {activeModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              {activeModal === "noteForm" && (
                <>
                  <div className="modal-header">
                    <h3>{editingNote ? "Edit Note" : "Add Note"}</h3>
                    <button className="close-btn" aria-label="Close" onClick={closeModal}>
                      ×
                    </button>
                  </div>
                  <textarea placeholder="Write your note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
                  <div className="modal-actions">
                    <button className="ghost-btn" onClick={closeModal}>
                      Cancel
                    </button>
                    <button
                      className="primary-btn"
                      onClick={() => {
                        if (saveNote()) closeModal();
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </>
              )}

              {activeModal === "notesList" && (
                <>
                  <div className="modal-header">
                    <h3>All Notes</h3>
                    <button className="close-btn" aria-label="Close" onClick={closeModal}>
                      ×
                    </button>
                  </div>
                  <div className="modal-list">
                    {notes.length === 0 && <p className="empty-copy">No notes yet.</p>}
                    {notes.map((note) => (
                      <div key={note.id} className="modal-list-item">
                        <p className="note-content">{note.content}</p>
                        <div className="note-actions">
                          <button className="icon-btn" title="Edit" onClick={() => openNoteForm(note)}>
                            ✏
                          </button>
                          <button className="icon-btn" title="Delete" onClick={() => requestDeleteNote(note.id)}>
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeModal === "checklistForm" && (
                <>
                  <div className="modal-header">
                    <h3>{editingChecklist ? "Edit Checklist" : "Add Checklist"}</h3>
                    <button className="close-btn" aria-label="Close" onClick={closeModal}>
                      ×
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Checklist name..."
                    value={newChecklistName}
                    onChange={(e) => setNewChecklistName(e.target.value)}
                  />
                  <div className="item-editor">
                    {editingChecklistItems.map((item, idx) => (
                      <div key={item.id} className="item-row">
                        <input type="checkbox" checked={item.completed} onChange={() => toggleChecklistItemCompleted(item.id)} />
                        <input
                          className="item-input"
                          type="text"
                          placeholder={`Item ${idx + 1}`}
                          value={item.label}
                          onChange={(e) => updateChecklistItemLabel(item.id, e.target.value)}
                        />
                        <button className="icon-btn danger" title="Remove item" onClick={() => removeChecklistItemRow(item.id)}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <button className="add-item-inline" onClick={addChecklistItemRow}>
                      + Add Item
                    </button>
                  </div>
                  <div className="modal-actions">
                    <button className="ghost-btn" onClick={closeModal}>
                      Cancel
                    </button>
                    <button
                      className="primary-btn"
                      onClick={() => {
                        if (saveChecklist()) closeModal();
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </>
              )}

              {activeModal === "checklistList" && (
                <>
                  <div className="modal-header">
                    <h3>All Checklists</h3>
                    <button className="close-btn" aria-label="Close" onClick={closeModal}>
                      ×
                    </button>
                  </div>
                  <div className="modal-list">
                    {checklists.length === 0 && <p className="empty-copy">No checklists yet.</p>}
                    {checklists.map((checklist) => (
                      <div key={checklist.id} className="modal-list-item checklist-item-row">
                        <div>
                          <h4>{checklist.name}</h4>
                          <ul className="compact-list">
                            {checklist.items.length === 0 && <li className="muted">No items yet.</li>}
                            {checklist.items.map((item) => (
                              <li key={item.id} className={item.completed ? "done" : ""}>
                                {item.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="note-actions">
                          <button className="icon-btn" title="Edit" onClick={() => openChecklistForm(checklist)}>
                            ✏
                          </button>
                          <button className="icon-btn" title="Delete" onClick={() => requestDeleteChecklist(checklist.id)}>
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeModal === "deleteConfirm" && deleteTarget && (
                <>
                  <div className="modal-header">
                    <h3>Confirm Delete</h3>
                    <button className="close-btn" aria-label="Close" onClick={closeModal}>
                      ×
                    </button>
                  </div>
                  <p className="confirm-copy">Delete this {deleteTarget.type === "note" ? "note" : "checklist"}?</p>
                  <div className="modal-actions">
                    <button className="ghost-btn" onClick={closeModal}>
                      Cancel
                    </button>
                    <button className="danger-btn" onClick={handleDeleteConfirm}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
