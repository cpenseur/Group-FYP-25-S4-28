// frontend/src/components/AdaptivePlannerOverlay.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, ChevronUp, RefreshCcw } from "lucide-react";
// @ts-expect-error: package ships without types
import OpeningHours from "opening_hours";
import apiClient from "../lib/apiClient";

type DaySummary = {
  dayId: number;
  dayIndex: number;
  dateISO?: string;
  preview?: any;
  proposedIsDifferent: boolean;
  hasSuggestions: boolean;
  weather?: any;
  isRainy?: boolean;
  error?: string | null;
  businessHoursIssues?: { title: string; note: string; itemId?: number }[];
};

type Props = {
  tripId: number;
  days: { id: number; day_index: number }[];
  dayISOMap: Record<number, string>;
  itemsByDay: Record<
    number,
    { id: number; title?: string | null; start_time?: string | null; end_time?: string | null; opening_hours?: string | null }[]
  >;
  onApplied?: () => void;
  onItemsPatched?: (updates: { id: number; day?: number | null; sort_order?: number; start_time?: string | null; end_time?: string | null }[]) => void;
  onFocusItem?: (itemId: number, dayId?: number) => void;
};

function proposedDiffers(proposed: number[] | undefined, current: number[]): boolean {
  if (!proposed || proposed.length === 0) return false;
  if (proposed.length !== current.length) return true;
  for (let i = 0; i < proposed.length; i += 1) {
    if (proposed[i] !== current[i]) return true;
  }
  return false;
}

function weatherDescriptor(codes: number[]): string {
  if (!codes.length) return "Mixed";
  const freq = new Map<number, number>();
  codes.forEach((c) => freq.set(c, (freq.get(c) || 0) + 1));
  const dominant = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  if (dominant < 3) return "Clear";
  if (dominant < 50) return "Cloudy";
  if (dominant < 70) return "Rainy";
  if (dominant < 80) return "Snow / mix";
  return "Stormy";
}

// Keep the wall-clock time component when parsing stored ISO strings
function parseWallClockDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  if (!datePart || !timePart) return null;
  const d = new Date(`${datePart}T${timePart}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function checkHoursConflict(
  openingHoursText?: string | null,
  startISO?: string | null,
  endISO?: string | null
): string | null {
  if (!openingHoursText || (!startISO && !endISO)) return null;
  try {
    const oh = new OpeningHours(openingHoursText);
    const issues: string[] = [];
    if (startISO) {
      const d = parseWallClockDate(startISO);
      if (Number.isNaN(d?.getTime()) || !oh.getState(d)) {
        issues.push("start");
      }
    }
    if (endISO) {
      const d = parseWallClockDate(endISO);
      if (Number.isNaN(d?.getTime()) || !oh.getState(d)) {
        issues.push("end");
      }
    }
    if (issues.length === 0) return null;
    if (issues.length === 2) return "Start and end time fall outside opening hours.";
    return issues[0] === "start"
      ? "Start time falls outside opening hours."
      : "End time falls outside opening hours.";
  } catch {
    return null;
  }
}

export default function AdaptivePlannerOverlay({
  tripId,
  days,
  dayISOMap,
  itemsByDay,
  onApplied,
  onItemsPatched,
  onFocusItem,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latestSig, setLatestSig] = useState<string | null>(null);
  const lastAutoOpened = useRef<string | null>(null);
  const hasFetchedOnce = useRef(false); // Track if we've fetched at least once
  const [ignoredSigs, setIgnoredSigs] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("tm_suggestions_ignore_sigs");
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Lightweight client-side check for business hours issues (no API calls)
  // This runs on mount/data changes to show the animation indicator
  const hasClientSideIssues = useMemo(() => {
    for (const dayId of Object.keys(itemsByDay)) {
      const items = itemsByDay[Number(dayId)] || [];
      for (const item of items) {
        const conflict = checkHoursConflict(item.opening_hours, item.start_time, item.end_time);
        if (conflict) return true;
      }
    }
    return false;
  }, [itemsByDay]);

  const actionableDays = useMemo(
    () => daySummaries.filter((d) => d.hasSuggestions),
    [daySummaries]
  );
  const hasActionableMotion = daySummaries.some((d) => {
    const hasOrderChange =
      d.proposedIsDifferent &&
      Array.isArray(d.preview?.proposed_item_ids) &&
      d.preview.proposed_item_ids.length > 0;

    const hasNonHoursChange =
      Array.isArray(d.preview?.changes) &&
      d.preview.changes.some(
        (c: any) =>
          c?.action !== "opening_hours_warning" &&
          c?.action !== "opening_hours_conflict" &&
          c?.action !== "opening_hours_missing"
      );

    const hasHoursIssues = Array.isArray(d.businessHoursIssues) && d.businessHoursIssues.length > 0;

    return hasOrderChange || hasNonHoursChange || hasHoursIssues;
  });
  const isIgnoredSig = latestSig ? ignoredSigs.has(latestSig) : false;
  // Show animation if either: client-side issues detected OR full fetch found actionable items
  const shouldAnimate = (hasClientSideIssues || hasActionableMotion) && !isIgnoredSig;

  const ignoreKey = "tm_suggestions_ignore_sigs";
  const saveIgnored = (val: Set<string>) => {
    try {
      localStorage.setItem(ignoreKey, JSON.stringify(Array.from(val)));
    } catch {
      /* ignore */
    }
  };

  const weekSummary = useMemo(() => {
    const weatherCodes: number[] = [];
    let rainyDays = 0;
    let maxRainProb = 0;
    daySummaries.forEach((d) => {
      if (d.isRainy) rainyDays += 1;
      const wx = d.weather || {};
      const prob = wx.precipitation_probability_max;
      if (typeof prob === "number") {
        maxRainProb = Math.max(maxRainProb, prob);
      }
      const code = wx.weathercode;
      if (typeof code === "number") weatherCodes.push(code);
    });
    return {
      descriptor: weatherDescriptor(weatherCodes),
      rainyDays,
      maxRainProb,
    };
  }, [daySummaries]);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const jobs = days
        .filter((d) => dayISOMap[d.id])
        .map(async (d) => {
          const currentOrder = (itemsByDay[d.id] || []).map((i) => i.id);
          const titleMap = new Map(
            (itemsByDay[d.id] || []).map((it) => [it.id, it.title || `Item ${it.id}`])
          );
    const hourIssues =
      (itemsByDay[d.id] || [])
        .map((it) => {
          const msg = checkHoursConflict(it.opening_hours, it.start_time, it.end_time);
          return msg
            ? {
                title: it.title || `Item ${it.id}`,
                note: msg,
                action: "opening_hours_conflict",
                itemId: it.id,
              }
            : null;
        })
        .filter(Boolean) as { title: string; note: string; action: string; itemId?: number }[];
          const body = { trip_id: tripId, day_id: d.id, date: dayISOMap[d.id] };
          try {
            const res = await apiClient.post("/f1/adaptive-plan/", body);
            const proposed = Array.isArray(res?.proposed_item_ids) ? res.proposed_item_ids : [];
            const proposedIsDifferent = proposedDiffers(proposed, currentOrder);
            const backendHourIssues = (Array.isArray(res?.changes) ? res.changes : []).filter(
              (c: any) =>
                c?.action === "opening_hours_warning" ||
                c?.action === "opening_hours_conflict" ||
                c?.action === "opening_hours_missing"
            );

            const mergedHourIssues = [
              ...hourIssues,
              ...backendHourIssues.map((c: any, idx: number) => ({
                title: titleMap.get(c.item_id) || `Item ${c.item_id}`,
                note: c.reason || "Opening hours issue",
                action: c.action,
                itemId: c.item_id,
                key: `bh-${c.item_id}-${idx}`,
              })),
            ];

            const hasChanges = Array.isArray(res?.changes) && res.changes.length > 0;
            const hasSuggestions = proposedIsDifferent || hasChanges || mergedHourIssues.length > 0;
            return {
              dayId: d.id,
              dayIndex: d.day_index,
              dateISO: dayISOMap[d.id],
              preview: res,
              proposedIsDifferent,
              hasSuggestions,
              businessHoursIssues: mergedHourIssues,
              weather: res?.weather,
              isRainy: !!res?.is_rainy,
              error: null,
            } as DaySummary;
          } catch (e: any) {
            return {
              dayId: d.id,
              dayIndex: d.day_index,
              dateISO: dayISOMap[d.id],
              proposedIsDifferent: false,
              hasSuggestions: hourIssues.length > 0,
              businessHoursIssues: hourIssues,
              error: e?.message || "Failed to load",
            } as DaySummary;
          }
        });

      const results = await Promise.all(jobs);
      setDaySummaries(results);

      // Build a signature of current suggestions for auto-open/ignore logic
      const codes: number[] = [];
      let rainyDays = 0;
      let maxRainProb = 0;
      results.forEach((d) => {
        if (d.isRainy) rainyDays += 1;
        const wx = d.weather || {};
        const prob = wx.precipitation_probability_max;
        if (typeof prob === "number") {
          maxRainProb = Math.max(maxRainProb, prob);
        }
        const code = wx.weathercode;
        if (typeof code === "number") codes.push(code);
      });
      const sig = JSON.stringify({
        week: {
          descriptor: weatherDescriptor(codes),
          rainyDays,
          maxRainProb,
        },
        days: results
          .filter((s) => s.hasSuggestions)
          .map((s) => ({
            id: s.dayId,
            reason: s.preview?.reason,
            changes: s.preview?.changes,
            items: s.preview?.proposed_item_ids,
            hours: s.businessHoursIssues,
          })),
      });
      setLatestSig(sig);
      // Removed auto-open logic - panel only opens when user clicks the icon
    } catch (e: any) {
      setError(e?.message || "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }

  // Find an alternate day to move an item to (prefers next, else previous)
  function findAlternateDay(currentDayIndex: number) {
    const sorted = [...days].sort((a, b) => a.day_index - b.day_index);
    const next = sorted.find((d) => d.day_index > currentDayIndex);
    if (next) return { target: next, label: "Move to next day" };
    const prev = [...sorted].reverse().find((d) => d.day_index < currentDayIndex);
    if (prev) return { target: prev, label: "Move to previous day" };
    return null;
  }

  async function approveDay(dayId: number) {
    const entry = daySummaries.find((d) => d.dayId === dayId);
    if (!entry || !entry.preview) return;
    try {
      const fallbackOrder = (itemsByDay[dayId] || []).map((i) => i.id);
      const proposedIds =
        Array.isArray(entry.preview.proposed_item_ids) && entry.preview.proposed_item_ids.length > 0
          ? entry.preview.proposed_item_ids
          : fallbackOrder;

      const res = await apiClient.post("/f1/adaptive-plan/", {
        trip_id: tripId,
        day_id: dayId,
        date: dayISOMap[dayId],
        apply_changes: true,
        proposed_item_ids: proposedIds,
      });
      const updates = Array.isArray(res?.updated_items) ? res.updated_items : [];
      if (updates.length && onItemsPatched) {
        onItemsPatched(updates);
      }
      const appliedPromise = onApplied?.();
      if (appliedPromise && typeof (appliedPromise as any).then === "function") {
        await appliedPromise;
      }
      await fetchAll();
    } catch (e: any) {
      setError(e?.message || "Failed to apply changes");
    }
  }

  const moveIssueToNextDay = async (issue: { itemId?: number }, currentDayId: number, targetDayId?: number) => {
    if (!issue.itemId) return;
    const currentDay = days.find((d) => d.id === currentDayId);
    if (!currentDay) return;
    const target =
      targetDayId != null
        ? days.find((d) => d.id === targetDayId)
        : findAlternateDay(currentDay.day_index)?.target;
    if (!target) return;

    try {
      const payload: any = {
        day: target.id,
        sort_order: (itemsByDay[target.id]?.length || 0) + 1,
      };
      const res = await apiClient.patch(`/f1/itinerary-items/${issue.itemId}/`, payload);
      if (onItemsPatched) {
        onItemsPatched([
          {
            id: issue.itemId,
            day: target.id,
            sort_order: res?.sort_order ?? payload.sort_order,
            start_time: res?.start_time ?? null,
            end_time: res?.end_time ?? null,
          },
        ]);
      }
      await fetchAll();
    } catch (e: any) {
      setError(e?.message || "Failed to move item to next day");
    }
  };

  useEffect(() => {
    // Only fetch when panel is explicitly opened by user
    if (open) {
      fetchAll();
      hasFetchedOnce.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tripId, JSON.stringify(dayISOMap), JSON.stringify(itemsByDay)]);

  const handleIgnore = () => {
    if (!latestSig) {
      setOpen(false);
      return;
    }
    const next = new Set<string>(ignoredSigs);
    next.add(latestSig);
    setIgnoredSigs(next);
    saveIgnored(next);
    setOpen(false);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 0,
        right: 0,
        paddingLeft: 8,
        paddingTop: 4,
        zIndex: 120,
        display: "flex",
        justifyContent: "flex-start",
        pointerEvents: "none",
      }}
    >
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Adaptive Planner Suggestions"
          style={{
            pointerEvents: "auto",
            width: 50,
            height: 50,
            borderRadius: 16,
            border: "1px solid rgba(229,231,235,0.95)",
            background: shouldAnimate
              ? "conic-gradient(from 0deg, #f97316, #facc15, #6366f1, #f97316)"
              : "rgba(255,255,255,0.92)",
            boxShadow: shouldAnimate
              ? "0 0 0 3px rgba(99,102,241,0.2), 0 12px 30px rgba(15,23,42,0.18)"
              : "0 12px 30px rgba(15,23,42,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {shouldAnimate && <div className="tmGlowRing tmGlowRingA" aria-hidden="true" />}

          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12, 
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              position: "relative",
              boxShadow: shouldAnimate
                ? "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1.5px rgba(255,255,255,0.9)"
                : "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <Lightbulb size={20} color={shouldAnimate ? "#4f46e5" : "#111827"} />
          </div>
        </button>
      )}

      {open && (
        <div
          style={{
            pointerEvents: "auto",
            width: "min(460px, 50vw)",
            maxHeight: "48vh",
            overflow: "hidden",
            borderRadius: 16,
            border: "1px solid rgba(229,231,235,0.95)",
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 18px 45px rgba(15,23,42,0.22)",
            backdropFilter: "blur(10px)",
            transformOrigin: "top left",
            animation: "tmSlideDown 180ms ease-out",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderBottom: "1px solid rgba(229,231,235,0.9)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 12,
                  background: "rgba(99,102,241,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(99,102,241,0.20)",
                }}
              >
                <Lightbulb size={16} />
              </div>
              <div style={{ fontWeight: 800, color: "#111827", fontSize: "0.9rem" }}>
                Adaptive Planner
              </div>
              <div style={{ fontSize: "0.78rem", color: "#6b7280", marginLeft: 16 }}>
                Week: {weekSummary.descriptor}<br /> Rainy days: {weekSummary.rainyDays}<br />Max rain chance:{" "}
                {weekSummary.maxRainProb}%.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={fetchAll}
                title="Refresh"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4,
                }}
              >
                <RefreshCcw size={16} />
              </button>
              <button
                type="button"
                onClick={handleIgnore}
                title="Ignore and stop auto-opening"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                Ignore
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Minimize"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4,
                }}
              >
                <ChevronUp size={18} />
              </button>
            </div>
          </div>

          <div
            style={{
              padding: 10,
              overflowY: "auto",
              maxHeight: "calc(32vh - 46px)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {error && <div style={{ color: "#b91c1c", fontSize: "0.9rem" }}>{error}</div>}

            {!error && loading && (
              <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Loading suggestions…</div>
            )}

            {!loading && actionableDays.length === 0 && (
              <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                Looks good — no changes recommended.
              </div>
            )}

            {!loading &&
              actionableDays.map((d) => (
                <div
                  key={d.dayId}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "white",
                    fontSize: "0.85rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 750, color: "#111827", fontSize: "0.82rem" }}>
                      Day {d.dayIndex} {d.dateISO ? `• ${d.dateISO}` : ""}
                    </div>
                  </div>

                  <div style={{ marginTop: 4, color: "#4b5563", fontSize: "0.82rem" }}>
                    {d.preview?.reason || "Reorder for better flow."}
                  </div>

                  {d.weather && (
                    <div style={{ marginTop: 4, color: "#6b7280", fontSize: "0.8rem" }}>
                      Weather: rain={String(d.weather.precipitation_probability_max ?? "–")}%, precip=
                      {String(d.weather.precipitation_sum ?? "–")}mm
                    </div>
                  )}

                  {d.proposedIsDifferent && Array.isArray(d.preview?.proposed_item_ids) && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700, color: "#111827", fontSize: "0.82rem" }}>Proposed order</div>
                      <ol style={{ marginTop: 4, paddingLeft: 18, color: "#374151", fontSize: "0.82rem" }}>
                        {d.preview.proposed_item_ids.map((iid: number) => {
                          const titleMap = new Map(
                            (itemsByDay[d.dayId] || []).map((it) => [it.id, it.title || `Item ${it.id}`])
                          );
                          return (
                            <li key={iid}>{titleMap.get(iid) || `Item ${iid}`}</li>
                          );
                        })}
                      </ol>
                    </div>
                  )}

                  {d.businessHoursIssues && d.businessHoursIssues.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700, color: "#111827", fontSize: "0.82rem" }}>Opening hours</div>
                      <ul style={{ marginTop: 4, paddingLeft: 18, color: "#b91c1c", fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 6 }}>
                        {d.businessHoursIssues.map((iss, idx) => {
                          const alt = findAlternateDay(d.dayIndex);
                          return (
                            <li key={`${iss.title}-${idx}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <span>
                                <strong>{iss.title}:</strong> {iss.note}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {iss.itemId && (
                                  <button
                                    type="button"
                                    onClick={() => onFocusItem?.(iss.itemId!, d.dayId)}
                                    style={{
                                      border: "1px solid #d1d5db",
                                      borderRadius: 8,
                                      padding: "4px 8px",
                                      background: "white",
                                      color: "#111827",
                                      fontSize: "0.78rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Show stop
                                  </button>
                                )}
                                {iss.itemId && alt && (
                                  <button
                                    type="button"
                                    onClick={() => moveIssueToNextDay(iss, d.dayId, alt.target.id)}
                                    style={{
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 8,
                                      padding: "4px 8px",
                                      background: "white",
                                      color: "#111827",
                                      fontSize: "0.78rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {alt.label}
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    {((d.proposedIsDifferent &&
                      Array.isArray(d.preview?.proposed_item_ids) &&
                      d.preview.proposed_item_ids.length > 0) ||
                      (Array.isArray(d.preview?.changes) &&
                        d.preview.changes.some(
                          (c: any) =>
                            c?.action !== "opening_hours_warning" &&
                            c?.action !== "opening_hours_conflict" &&
                            c?.action !== "opening_hours_missing"
                        )) ||
                      (Array.isArray(d.businessHoursIssues) && d.businessHoursIssues.length > 0)) && (
                      <button
                        onClick={() => approveDay(d.dayId)}
                        disabled={loading}
                        style={{
                          border: "1px solid #111827",
                          borderRadius: 10,
                          padding: "5px 9px",
                          background: "#111827",
                          color: "white",
                          cursor: loading ? "not-allowed" : "pointer",
                          fontWeight: 750,
                          fontSize: "0.8rem",
                          opacity: loading ? 0.6 : 1,
                        }}
                      >
                        Apply suggestions
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes tmSlideDown {
            0% { transform: translateY(-6px); opacity: 0.0; }
            100% { transform: translateY(0); opacity: 1.0; }
          }

          .tmGlowRing {
            position: absolute;
            inset: -3px;
            border-radius: 16px;
            pointer-events: none;
            z-index: 0;
          }

          .tmGlowRingA {
            background: conic-gradient(from 0deg, #f97316, #facc15, #6366f1, #f97316);
            filter: blur(2px);
            animation: tmRingSpin 2.2s linear infinite;
          }
            
          @keyframes tmRingSpin {
            to { transform: rotate(360deg); }
          }

          @media (prefers-reduced-motion: reduce) {
            .tmGlowRingA { animation: none !important; }
          }

        `}
      </style>
    </div>
  );
}
