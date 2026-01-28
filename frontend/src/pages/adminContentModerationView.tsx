// src/pages/adminContentModerationView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED" | null;

type TripFlagRow = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  visibility: string;
  created_at: string;
  owner_id: string | null;
  is_demo: boolean;
  is_flagged: boolean;
  flag_category: string | null;
  flag_reason: string | null;
  moderation_status: ModerationStatus;
  moderated_at?: string | null;
};

type TripFlagHistoryRow = {
  id: number;
  trip_id: number;
  action: "FLAGGED" | "APPROVED" | "REJECTED";
  category: string | null;
  reason: string | null;
  moderation_status: "PENDING" | "APPROVED" | "REJECTED" | null;
  moderated_at: string | null;
  created_at: string;
  trip: TripFlagRow | null;
};

type Props = {
  /** If true: slightly tighter layout (nice for dashboard card) */
  compact?: boolean;
};

export default function AdminContentModerationView({ compact }: Props) {
  const [loading, setLoading] = useState(false);

  // pending list (from trip table)
  const [rows, setRows] = useState<TripFlagRow[]>([]);

  // completed list (from trip_flag_history + joined trip)
  const [completedRows, setCompletedRows] = useState<TripFlagHistoryRow[]>([]);

  // ✅ new toggle: false => pending view (default), true => completed view
  const [showCompleted, setShowCompleted] = useState(false);

  const [search, setSearch] = useState("");
  const [rowBusy, setRowBusy] = useState<Record<number, boolean>>({});

  const setBusy = (tripId: number, busy: boolean) =>
    setRowBusy((p) => ({ ...p, [tripId]: busy }));

  const severity = (cat: string | null, reason: string | null) => {
    const text = `${cat ?? ""} ${reason ?? ""}`.toLowerCase();
    if (text.includes("explicit") || text.includes("hate") || text.includes("harass")) return "red";
    if (text.includes("spam") || text.includes("scam") || text.includes("link")) return "red";
    if (text.includes("inappropriate") || text.includes("nsfw")) return "orange";
    return "orange";
  };

  const statusBadge = (status: ModerationStatus) => {
    if (status === "APPROVED") return { label: "✓", cls: "cm-badge--green" };
    if (status === "REJECTED") return { label: "✕", cls: "cm-badge--red" };
    // PENDING / null
    return { label: "•", cls: "cm-badge--orange" };
  };

  const getAuthUserId = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  };

  const insertHistory = async (args: {
    tripId: number;
    action: "APPROVED" | "REJECTED";
    category: string | null;
    reason: string | null;
    moderation_status: "APPROVED" | "REJECTED";
    moderated_at: string;
  }) => {
    const userId = await getAuthUserId();

    const { error } = await supabase.from("trip_flag_history").insert([
      {
        trip_id: args.tripId,
        action: args.action,
        category: args.category,
        reason: args.reason,
        moderation_status: args.moderation_status,
        moderated_at: args.moderated_at,
        moderated_by_auth_user_id: userId,
        actor_auth_user_id: userId,
      },
    ]);

    if (error) throw error;
  };

  const fetchPendingTrips = async () => {
    // pending flagged from trip table
    let q = supabase
      .from("trip")
      .select(
        "id,title,main_city,main_country,visibility,created_at,owner_id,is_demo,is_flagged,flag_category,flag_reason,moderation_status,moderated_at"
      )
      .eq("is_flagged", true)
      .eq("moderation_status", "PENDING")
      .order("created_at", { ascending: false });

    if (search.trim()) {
      const s = search.trim();
      q = q.or(`title.ilike.%${s}%,main_country.ilike.%${s}%,main_city.ilike.%${s}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    setRows((data ?? []) as TripFlagRow[]);
  };

  const fetchCompletedModeration = async () => {
    // completed from history table + join trip
    // NOTE: this requires Supabase relationship: trip_flag_history.trip_id -> trip.id
    const { data, error } = await supabase
      .from("trip_flag_history")
      .select(
        `
        id, trip_id, action, category, reason, moderation_status, moderated_at, created_at,
        trip:trip_id (
          id,title,main_city,main_country,visibility,created_at,owner_id,is_demo,is_flagged,flag_category,flag_reason,moderation_status,moderated_at
        )
      `
      )
      .in("action", ["APPROVED", "REJECTED"])
      .order("moderated_at", { ascending: false, nullsFirst: false });

    if (error) throw error;

    setCompletedRows((data ?? []) as TripFlagHistoryRow[]);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (showCompleted) {
        await fetchCompletedModeration();
      } else {
        await fetchPendingTrips();
      }
    } catch (e) {
      console.error(e);
      if (showCompleted) setCompletedRows([]);
      else setRows([]);
      alert("Could not load moderation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCompleted]);

  // if user types in search, just filter locally for completed (simpler than nested filters)
  const filteredPending = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      return (
        r.title.toLowerCase().includes(s) ||
        (r.main_country ?? "").toLowerCase().includes(s) ||
        (r.main_city ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, search]);

  const filteredCompleted = useMemo(() => {
    const base = completedRows.filter((h) => h.trip);
    if (!search.trim()) return base;

    const s = search.trim().toLowerCase();
    return base.filter((h) => {
      const t = h.trip!;
      return (
        t.title.toLowerCase().includes(s) ||
        (t.main_country ?? "").toLowerCase().includes(s) ||
        (t.main_city ?? "").toLowerCase().includes(s)
      );
    });
  }, [completedRows, search]);

  const approveTrip = async (t: TripFlagRow) => {
    setBusy(t.id, true);
    const nowIso = new Date().toISOString();

    try {
      // 1) update trip
      const { error } = await supabase
        .from("trip")
        .update({
          moderation_status: "APPROVED",
          moderated_at: nowIso,
          is_flagged: false,
          visibility: "forbidden",
          is_demo: false,
        })
        .eq("id", t.id);

      if (error) throw error;

      // 2) write history
      await insertHistory({
        tripId: t.id,
        action: "APPROVED",
        category: t.flag_category,
        reason: t.flag_reason,
        moderation_status: "APPROVED",
        moderated_at: nowIso,
      });

      // 3) update UI
      if (!showCompleted) setRows((prev) => prev.filter((r) => r.id !== t.id));
      else await fetchCompletedModeration();
    } catch (e) {
      console.error(e);
      alert("Could not approve this trip.");
    } finally {
      setBusy(t.id, false);
    }
  };

  const rejectTrip = async (t: TripFlagRow) => {
    setBusy(t.id, true);
    const nowIso = new Date().toISOString();

    try {
      // 1) update trip
      const { error } = await supabase
        .from("trip")
        .update({
          moderation_status: "REJECTED",
          moderated_at: nowIso,
          is_flagged: false,
          visibility: "public",
          is_demo: true,
        })
        .eq("id", t.id);

      if (error) throw error;

      // 2) write history
      await insertHistory({
        tripId: t.id,
        action: "REJECTED",
        category: t.flag_category,
        reason: t.flag_reason,
        moderation_status: "REJECTED",
        moderated_at: nowIso,
      });

      // 3) update UI
      if (!showCompleted) setRows((prev) => prev.filter((r) => r.id !== t.id));
      else await fetchCompletedModeration();
    } catch (e) {
      console.error(e);
      alert("Could not reject this trip.");
    } finally {
      setBusy(t.id, false);
    }
  };

  const visibleListPending = filteredPending;
  const visibleListCompleted = filteredCompleted;

  return (
    <div className={compact ? "cm-wrap cm-wrap--compact" : "cm-wrap"}>
      <div className="cm-head">
        <div>
          {!compact && (
            <>
              <h2 className="cm-title">Content Moderation</h2>
              <p className="cm-sub">
                Review flagged itineraries from <code>trip</code> table
              </p>
            </>
          )}
        </div>

        <div className="cm-head-actions">
          {compact && (
            <input
              className="cm-search cm-search--inline"
              placeholder="Search title / country / city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          {/* ✅ replaced button */}
          <button
            className={"btn btn-outline btn-small " + (showCompleted ? "btn-filter-active" : "")}
            onClick={() => setShowCompleted((v) => !v)}
            title="Toggle between Pending flagged items and Completed moderation"
          >
            ✓ Completed moderation
          </button>

          <button className="btn btn-primary btn-small" onClick={fetchData} disabled={loading}>
            ↻ {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {!compact && (
        <div className="cm-toolbar">
          <input
            className="cm-search"
            placeholder="Search by title / country / city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="cm-grid">
        <div className="cm-list">
          {loading ? (
            <div className="cm-empty">Loading…</div>
          ) : !showCompleted ? (
            // ✅ Pending list (default)
            visibleListPending.length === 0 ? (
              <div className="cm-empty">No flagged trips to review 🎉</div>
            ) : (
              visibleListPending.map((t) => {
                const sev = severity(t.flag_category, t.flag_reason);
                const busy = !!rowBusy[t.id];
                const sb = statusBadge(t.moderation_status);

                return (
                  <div key={t.id} className="cm-item">
                    <div className="cm-left">
                      <div className="cm-row1">
                        <div className="cm-item-title">{t.title}</div>

                        {/* pending dot like your screenshot */}
                        <span className={"cm-badge " + sb.cls}>{sb.label}</span>

                        <span className="cm-pill">{t.visibility}</span>
                      </div>

                      <div className="cm-row2">
                        <span className="cm-meta">
                          {t.main_country ?? "-"}
                          {t.main_city ? ` • ${t.main_city}` : ""}
                        </span>
                        <span className="cm-dot">•</span>
                        <span className="cm-meta">
                          Flag: {t.flag_category ?? "Uncategorised"}
                          {t.flag_reason ? ` — ${t.flag_reason}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="cm-actions">
                      <button className="btn btn-approve" onClick={() => approveTrip(t)} disabled={busy}>
                        ✓ Approve
                      </button>
                      <button className="btn btn-reject" onClick={() => rejectTrip(t)} disabled={busy}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // ✅ Completed list
            visibleListCompleted.length === 0 ? (
              <div className="cm-empty">No completed moderation yet.</div>
            ) : (
              visibleListCompleted.map((h) => {
                const t = h.trip!;
                const sev = severity(h.category ?? t.flag_category, h.reason ?? t.flag_reason);
                const sb = statusBadge(h.moderation_status);
                const statusText =
                  h.moderation_status === "APPROVED" ? "Approved" : h.moderation_status === "REJECTED" ? "Rejected" : "Completed";

                return (
                  <div key={h.id} className="cm-item">
                    <div className="cm-left">
                      <div className="cm-row1">
                        <div className="cm-item-title">{t.title}</div>
                        <span className={"cm-badge " + sb.cls}>{sb.label}</span>
                        <span className="cm-pill">{statusText}</span>
                        <span className="cm-pill cm-pill--muted">{t.visibility}</span>
                      </div>

                      <div className="cm-row2">
                        <span className="cm-meta">
                          {t.main_country ?? "-"}
                          {t.main_city ? ` • ${t.main_city}` : ""}
                        </span>
                        <span className="cm-dot">•</span>
                        <span className="cm-meta">
                          Flag: {(h.category ?? t.flag_category) ?? "Uncategorised"}
                          {(h.reason ?? t.flag_reason) ? ` — ${(h.reason ?? t.flag_reason)}` : ""}
                        </span>
                        {h.moderated_at && (
                          <>
                            <span className="cm-dot">•</span>
                            <span className="cm-meta">Moderated: {new Date(h.moderated_at).toLocaleString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="cm-actions">
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        <aside className="cm-guidelines">
          <h3 className="cm-guidelines-title">Guidelines</h3>
          <ul className="cm-guidelines-list">
            <li>No hate speech or harassment</li>
            <li>No explicit adult content</li>
            <li>Flag suspicious links / scams</li>
          </ul>
        </aside>
      </div>

      <style>{`
        .cm-wrap { display: flex; flex-direction: column; gap: 12px; }
        .cm-wrap--compact .cm-sub { display: none; }

        .cm-head { display:flex; justify-content: space-between; align-items:flex-start; gap: 10px; }
        .cm-title { margin:0; font-size: 1rem; }
        .cm-sub { margin: 4px 0 0; color:#6b7280; font-size: 0.85rem; }
        .cm-head-actions { display:flex; gap: 8px; flex-wrap: wrap; justify-content:flex-end; }

        .cm-toolbar { display:flex; gap: 10px; }
        .cm-search {
          width: 100%;
          padding: 0.65rem 1rem;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          font-size: 0.9rem;
          background: #fff;
          outline: none;
        }

        .cm-search--inline { width: 320px; max-width: 44vw; }

        .cm-grid { display:grid; grid-template-columns: 2fr 1fr; gap: 14px; align-items:flex-start; }
        .cm-list { display:flex; flex-direction:column; gap: 10px; }

        .cm-item {
          display:flex; justify-content:space-between; align-items:center;
          padding: 0.85rem 0.95rem;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          gap: 12px;
        }

        .cm-left { flex: 1; min-width: 0; }
        .cm-row1 { display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
        .cm-item-title { font-weight: 700; color:#111827; font-size: 0.95rem; white-space: nowrap; overflow:hidden; text-overflow: ellipsis; max-width: 52ch; }
        .cm-row2 { margin-top: 6px; display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
        .cm-meta { color:#6b7280; font-size: 0.82rem; }
        .cm-dot { color:#cbd5e1; }

        .cm-badge { font-size: 0.75rem; padding: 0.1rem 0.45rem; border-radius: 999px; }
        .cm-badge--red { background:#fee2e2; color:#b91c1c; }
        .cm-badge--orange { background:#ffedd5; color:#c2410c; }
        .cm-badge--green { background:#dcfce7; color:#15803d; }

        .cm-pill { font-size: 0.72rem; padding: 0.12rem 0.55rem; border-radius: 999px; border: 1px solid #e5e7eb; background:#fff; color:#374151; }
        .cm-pill--muted { color:#6b7280; }
        .cm-pill--danger { border-color:#fecaca; background:#fff; color:#b91c1c; }
        .cm-pill--warn { border-color:#fed7aa; background:#fff; color:#c2410c; }

        .cm-actions { display:flex; gap: 8px; align-items:center; }

        .cm-guidelines {
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          padding: 12px 14px;
        }
        .cm-guidelines-title { margin: 0; font-size: 0.95rem; }
        .cm-guidelines-list { margin: 8px 0 0; padding-left: 16px; color:#111827; }
        .cm-guidelines-list li { margin: 6px 0; font-size: 0.88rem; }

        .cm-empty { color:#6b7280; padding: 10px 2px; }

        /* if you already have btn-filter-active in global css, keep it.
           otherwise this gives a subtle active state */
        .btn-filter-active { box-shadow: 0 0 0 3px rgba(59,130,246,0.15) inset; }

        @media (max-width: 1024px) {
          .cm-grid { grid-template-columns: 1fr; }
          .cm-search--inline { width: 100%; max-width: 100%; }
          .cm-item-title { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
