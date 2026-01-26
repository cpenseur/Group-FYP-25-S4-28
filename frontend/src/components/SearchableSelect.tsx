import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = { label: string; value: string };

const DEFAULT_FONT = "Inter, 'Plus Jakarta Sans', 'Segoe UI', sans-serif";

type Props = {
  label?: string;
  placeholder?: string;
  value: SelectOption | null;
  options: SelectOption[];
  onChange: (next: SelectOption | null) => void;
  disabled?: boolean;
  required?: boolean;
  width?: string | number;
  fontFamily?: string;
};

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// lower = better; 9999 = no match
function scoreOption(label: string, q: string) {
  const s = norm(label);
  if (!q) return 0;

  if (s.startsWith(q)) return 0;

  // word boundary match: "new y" -> "New York"
  const wb = new RegExp(`\\b${escapeRegExp(q)}`);
  if (wb.test(s)) return 1;

  const idx = s.indexOf(q);
  if (idx >= 0) return 2 + Math.min(idx, 50);

  return 9999;
}

export default function SearchableSelect({
  label,
  placeholder = "Select…",
  value,
  options,
  onChange,
  disabled,
  required,
  width = "100%",
  fontFamily = DEFAULT_FONT,
}: Props) {
  const instanceId = useRef(`tm-select-${Math.random().toString(36).slice(2)}`).current;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number } | null>(null);

  // ✅ Global “only one open” coordinator
  useEffect(() => {
    const onOtherOpen = (e: Event) => {
      const ev = e as CustomEvent<{ id: string }>;
      if (ev.detail?.id && ev.detail.id !== instanceId) {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("tm-select-open", onOtherOpen as EventListener);
    return () => window.removeEventListener("tm-select-open", onOtherOpen as EventListener);
  }, [instanceId]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;

    // 1 letter: startsWith ONLY (your requirement)
    if (q.length === 1) {
      return options
        .filter((o) => norm(o.label).startsWith(q))
        .slice(0, 80);
    }

    // ranked search for >= 2 chars
    const scored = options
      .map((o) => ({ o, s: scoreOption(o.label, q) }))
      .filter((x) => x.s < 9999)
      .sort((a, b) => a.s - b.s || a.o.label.localeCompare(b.o.label));

    return scored.map((x) => x.o).slice(0, 80);
  }, [options, query]);

  useEffect(() => setHighlight(0), [query, open]);

  useEffect(() => {
    if (!open) return;

    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuRect({ left: r.left, top: r.bottom + 8, width: r.width });
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);

    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const root = rootRef.current;
      const menu = menuRef.current;

      const clickedInsideRoot = !!(root && root.contains(target));
      const clickedInsideMenu = !!(menu && menu.contains(target));

      if (!clickedInsideRoot && !clickedInsideMenu) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const openMenu = () => {
    if (disabled) return;
    window.dispatchEvent(new CustomEvent("tm-select-open", { detail: { id: instanceId } }));
    setOpen(true);
  };

  const selectOption = (opt: SelectOption) => {
    onChange(opt);
    setQuery("");
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const shownText = open ? query : value?.label ?? "";

  const menu =
    open && !disabled && menuRect
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: menuRect.left,
              top: menuRect.top,
              width: menuRect.width,
              zIndex: 99999,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
              overflow: "hidden",
              fontFamily,
            }}
          >
            <div style={{ maxHeight: 260, overflowY: "auto", padding: 6, fontFamily }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 10, color: "#6b7280", fontSize: "0.9rem" }}>
                  No results
                </div>
              ) : (
                filtered.map((opt, idx) => {
                  const active = idx === highlight;
                  const selected = value?.value === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onMouseEnter={() => setHighlight(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectOption(opt);
                      }}
                      style={{
                        padding: "0.6rem 0.75rem",
                        borderRadius: 10,
                        cursor: "pointer",
                        background: active ? "rgba(99,102,241,0.10)" : "transparent",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                        fontFamily,
                      }}
                    >
                      <span style={{ color: "#111827", fontSize: "0.95rem" }}>{opt.label}</span>
                      {selected ? <span style={{ color: "#4f46e5", fontWeight: 700 }}>✓</span> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      style={{
        width,
        minWidth: 0,
        fontFamily,
      }}
    >
      {label && (
        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#6b7280", marginBottom: "0.5rem" }}>
          {label} {required ? <span style={{ color: "#ef4444" }}>*</span> : null}
        </label>
      )}

      <div ref={anchorRef} style={{ position: "relative" }}>
        <input
          ref={inputRef}
          value={shownText}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onFocus={openMenu}
          onChange={(e) => {
            openMenu();
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (!open) {
              if (e.key === "ArrowDown") openMenu();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const opt = filtered[highlight];
              if (opt) selectOption(opt);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setQuery("");
            }
          }}
          style={{
            width: "89%",
            fontFamily,
            borderRadius: 12,
            border: "1px solid #d1d5db",
            padding: "0.7rem 2.6rem 0.7rem 0.95rem",
            fontSize: "0.95rem",
            outline: "none",
            backgroundColor: disabled ? "#f3f4f6" : "white",
            boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.15)" : "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            color: "#6b7280",
          }}
        >
          {value && !disabled ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 2,
                fontSize: 16,
                lineHeight: "16px",
                color: "#6b7280",
              }}
              title="Clear"
            >
              ×
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              window.dispatchEvent(new CustomEvent("tm-select-open", { detail: { id: instanceId } }));
              setOpen((o) => !o);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            aria-label="Toggle"
            style={{
              border: "none",
              background: "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
              padding: 2,
              fontSize: 14,
              color: "#6b7280",
            }}
          >
            ▾
          </button>
        </div>
      </div>

      {menu}
    </div>
  );
}
