// frontend/src/components/AdaptiveDayPlanner.tsx
import React, { useEffect, useMemo, useState } from "react";
import apiClient from "../lib/apiClient";

export default function AdaptiveDayPlanner({
  tripId,
  dayId,
  dateISO,
  dayItems,
  onApplied,
  mode = "inline",
  autoLoad = false,
}: {
  tripId: number;
  dayId: number;
  dateISO: string; // "YYYY-MM-DD"
  dayItems: { id: number; title?: string | null }[];
  onApplied?: () => void;
  mode?: "inline";
  autoLoad?: boolean;
}) {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(
    () => ({ trip_id: tripId, day_id: dayId, date: dateISO }),
    [tripId, dayId, dateISO]
  );

  const idToTitle = useMemo(() => {
    const m = new Map<number, string>();
    for (const it of dayItems) m.set(it.id, it.title || `Item ${it.id}`);
    return m;
  }, [dayItems]);

  const currentOrder = useMemo(() => dayItems.map((it) => it.id), [dayItems]);
  const proposedOrder: number[] = Array.isArray(preview?.proposed_item_ids)
    ? preview.proposed_item_ids
    : [];
  const proposedIsDifferent = useMemo(() => {
    if (!proposedOrder.length) return false;
    if (proposedOrder.length !== currentOrder.length) return true;
    for (let i = 0; i < proposedOrder.length; i += 1) {
      if (proposedOrder[i] !== currentOrder[i]) return true;
    }
    return false;
  }, [proposedOrder, currentOrder]);

  const hasChangeObjects = Array.isArray(preview?.changes) && preview.changes.length > 0;
  const hasSuggestions = proposedIsDifferent || hasChangeObjects;

  const suggestionCards = useMemo(() => {
    if (!preview) return [];
    const changes = Array.isArray(preview.changes) ? preview.changes : [];
    const baseReason = preview.reason;

    if (changes.length > 0) {
      return changes.map((c: any, idx: number) => ({
        key: c?.item_id ?? idx,
        title: c?.reason || "Reorder suggestion",
        detail:
          c?.from_index != null && c?.to_index != null
            ? `Move from #${c.from_index + 1} to #${c.to_index + 1}`
            : baseReason || "Reorder the day for weather",
      }));
    }

    if (Array.isArray(preview.proposed_item_ids) && preview.proposed_item_ids.length > 0) {
      return [
        {
          key: "plan",
          title: "Apply proposed order",
          detail: baseReason || "Reorder the day for better flow.",
        },
      ];
    }

    return [];
  }, [preview]);

  async function loadPreview() {
    if (!dateISO || dateISO.length < 10) {
      setError("Missing day date. Please set trip start date (or day date) first.");
      setPreview(null);
      return;
    }

    setLoadingPreview(true);
    setError(null);
    try {
      console.log("[AdaptivePlan] request payload", payload);
      const res = await apiClient.post("/f1/adaptive-plan/", payload);
      console.log("[AdaptivePlan] response", res);
      setPreview(res);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.date?.[0] ||
        e?.message ||
        "Failed to generate adaptive plan";
      setError(String(msg));
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function applyChanges() {
    if (!hasSuggestions) return;
    if (!preview?.proposed_item_ids || preview.proposed_item_ids.length === 0) return;

    setLoadingApply(true);
    setError(null);
    try {
      const body = {
        ...payload,
        apply_changes: true,
        proposed_item_ids: preview.proposed_item_ids,
      };
      console.log("[AdaptivePlan] apply payload", body);
      const res = await apiClient.post("/f1/adaptive-plan/", body);
      console.log("[AdaptivePlan] apply response", res);
      setPreview(null);
      onApplied?.();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to apply changes";
      setError(String(msg));
    } finally {
      setLoadingApply(false);
    }
  }

  useEffect(() => {
    if (autoLoad) loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, dayId, dateISO]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={loadPreview}
          disabled={loadingPreview || loadingApply}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "8px 12px",
            background: "white",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.85rem",
          }}
        >
          {loadingPreview ? "Generating…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 10, color: "#b91c1c", fontSize: "0.9rem" }}>
          {error}
        </div>
      )}

      {!error && !loadingPreview && !preview && (
        <div style={{ marginTop: 10, color: "#6b7280", fontSize: "0.85rem" }}>
          No adaptive suggestions yet.
        </div>
      )}

      {preview && (
        <div
          style={{
            marginTop: 10,
            border: "1px solid #eef2f7",
            background: "rgba(249,250,251,0.9)",
            borderRadius: 14,
            padding: "0.75rem",
          }}
        >
          <div style={{ fontWeight: 750, color: "#111827" }}>
            {preview.reason || "Adaptive suggestions"}
          </div>

          {proposedIsDifferent && Array.isArray(preview.proposed_item_ids) && (
            <>
              <div style={{ marginTop: 8, fontWeight: 700, color: "#111827" }}>
                Proposed order
              </div>
              <ol style={{ marginTop: 6, paddingLeft: 18, color: "#374151" }}>
                {preview.proposed_item_ids.map((iid: number) => (
                  <li key={iid} style={{ marginBottom: 6 }}>
                    {idToTitle.get(iid) || `Item ${iid}`}
                  </li>
                ))}
              </ol>
            </>
          )}

          {hasSuggestions ? (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestionCards.map((card) => (
                <div
                  key={card.key}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "white",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#111827" }}>{card.title}</div>
                  <div style={{ marginTop: 4, color: "#4b5563", fontSize: "0.9rem" }}>
                    {card.detail}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={applyChanges}
                      disabled={!hasSuggestions || loadingApply || !proposedOrder.length}
                      style={{
                        border: "1px solid #111827",
                        borderRadius: 10,
                        padding: "6px 10px",
                        background: "#111827",
                        color: "white",
                        cursor:
                          !hasSuggestions || loadingApply || !proposedOrder.length
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: 750,
                        fontSize: "0.85rem",
                        opacity: !hasSuggestions || loadingApply || !proposedOrder.length ? 0.6 : 1,
                      }}
                    >
                      {loadingApply ? "Applying…" : "Approve"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 12, color: "#6b7280" }}>
              Looks good — no changes recommended.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
