import React, { useEffect, useMemo, useState } from "react";
import { exportPDF as ExportPDF } from "../components/exportPDF";
import { supabase } from "../lib/supabaseClient"; 
import { useNavigate } from "react-router-dom";

type ReportKey = "user_activity" | "itinerary_stats" | "content_moderation" | "growth_analytics";
type FormatKey = "pdf" | "excel" | "csv";

function formatDateDisplay(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminReportsView({
  }: {
  onExport?: (payload: {
    reportType: ReportKey;
    from: string;
    to: string;
    format: FormatKey;
  }) => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [reportType, setReportType] = useState<ReportKey>("user_activity");
  const [fromDate, setFromDate] = useState<string>("2025-12-15");
  const [toDate, setToDate] = useState<string>(todayIso);
  const [pdfOpen, setPdfOpen] = useState(false);
  type PreviewCard = { label: string; value: string; tone: "neutral" | "good" | "warn" };
  type PreviewData = { heading: string; cards: PreviewCard[]; note: string };
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  const reportMeta = useMemo(
    () =>
      ({
        user_activity: {
          title: "User Activity Report",
          desc: "Active users, signups, and engagement metrics",
          icon: "👥",
        },
        itinerary_stats: {
          title: "Itinerary Statistics",
          desc: "Created itineraries, popular destinations, and trends",
          icon: "🗺️",
        },
        content_moderation: {
          title: "Content Moderation Report",
          desc: "Flagged content, approvals, and rejections",
          icon: "📄",
        },
        growth_analytics: {
          title: "Growth Analytics",
          desc: "User growth, retention, and engagement trends",
          icon: "📈",
        },
      }) as const,
    []
  );

    const navigate = useNavigate();

    const handleExport = async () => {
        // Navigate to appropriate export page based on report type
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            export: "true"
        });

        switch (reportType) {
            case "user_activity":
                // Export dashboard page
                navigate(`/admin-dashboard?${params.toString()}&view=dashboard`);
                break;
            case "itinerary_stats":
                // Export analytics page without Popular Itineraries
                navigate(`/admin-dashboard?${params.toString()}&view=analytics&hidePopular=true`);
                break;
            case "growth_analytics":
                // Export whole analytics page
                navigate(`/admin-dashboard?${params.toString()}&view=analytics`);
                break;
            case "content_moderation":
                // For content moderation, use the PDF export
                setPdfOpen(true);
                break;
            default:
                setPdfOpen(true);
        }
    };

    const fetchPreview = async () => {
    const params = new URLSearchParams({ type: reportType, from: fromDate, to: toDate });

    setLoadingPreview(true);
    setPreviewErr(null);

    try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        console.log("token exists?", !!token);

        const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
        const who = await fetch(`${API_BASE}/auth/whoami/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        console.log("whoami status", who.status, await who.text());

        if (!token) throw new Error("Not logged in (no Supabase session)");

        const r = await fetch(`${API_BASE}/admin/reports/preview/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        });

        if (!r.ok) throw new Error(await r.text());
        const json = await r.json();
        setPreview(json);
    } catch (e: any) {
        setPreviewErr(e?.message ?? "Failed to load preview");
    } finally {
        setLoadingPreview(false);
    }
    };


    useEffect(() => {
    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportType]);

    const handleApplyFilter = async () => {
    await fetchPreview();
    };

    return (
    <>
      <style>{`
        :root {
          --bg: #f6f8fc;
          --card: #ffffff;
          --text: #111827;
          --muted: #6b7280;
          --border: #e6ebf5;
          --border2: #e8eef9;
          --blue: #3b82f6;
          --blue2: #2563eb;
          --blueSoft: #eff6ff;
          --shadow: 0 10px 24px rgba(17,24,39,0.06);
          --shadow-sm: 0 2px 10px rgba(17,24,39,0.06);
          --radius: 14px;
          --radius-sm: 10px;
        }

        .rp-page {
          background: var(--bg);
          padding: 22px;
          max-width: 1180px;
          margin: 0 auto;
        }

        /* ===== Header (match screenshot) ===== */
        .rp-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .rp-head h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }

        .rp-head p {
          margin: 6px 0 0 0;
          color: var(--muted);
          font-size: 13px;
        }

        .rp-filters {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .rp-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 8px 10px;
          box-shadow: var(--shadow-sm);
        }

        .rp-pill label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 600;
          padding-left: 4px;
        }

        .rp-pill input[type="date"] {
          border: none;
          outline: none;
          font-size: 12px;
          color: var(--text);
          background: transparent;
          padding: 2px 6px;
        }

        .rp-apply-filter {
          background: var(--blue);
          color: white;
          border: none;
          border-radius: 999px;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s;
        }
        .rp-apply-filter:hover { background: var(--blue2); }

        /* ===== Main 2-column area ===== */
        .rp-grid {
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 18px;
          align-items: stretch;
          margin-top: 8px;
        }

        .rp-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 18px;
        }

        .rp-cardTitle {
          font-size: 15px;
          font-weight: 800;
          color: var(--text);
          margin: 0 0 14px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rp-iconBadge {
          width: 26px;
          height: 26px;
          border-radius: 9px;
          background: var(--blueSoft);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--blue);
          font-size: 12px;
          border: 1px solid #dbeafe;
        }

        /* ===== Select list ===== */
        .rp-selectWrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rp-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 14px;
          border: 1px solid var(--border2);
          border-radius: 14px;
          background: #fff;
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;
        }
        .rp-row:hover { border-color: var(--blue); background: var(--blueSoft); }

        .rp-rowLeft {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .rp-miniIcon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          border: 1px solid #edf2f7;
          flex-shrink: 0;
        }

        .rp-rowText .t {
          font-weight: 800;
          color: var(--text);
          font-size: 14px;
          margin: 0 0 4px 0;
        }

        .rp-rowText .d {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.35;
        }

        .rp-radio {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 2px solid #cbd5e1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rp-radio::after {
          content: "";
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: transparent;
        }

        .rp-row.active { border-color: var(--blue); background: var(--blueSoft); }
        .rp-row.active .rp-radio { border-color: var(--blue); }
        .rp-row.active .rp-radio::after { background: var(--blue); }

        /* ===== Preview card ===== */
        .rp-previewPanel {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
        flex: 1; 
        display: flex; 
        flex-direction: column;           
          background: #fff;
        }

        .rp-previewHeading {
          font-size: 22px;
          font-weight: 900;
          margin: 4px 0 14px 0;
          line-height: 1.05;
          white-space: pre-line;
        }

        .rp-previewGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 12px;
        }

        .rp-metric {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          background: #fff;
          min-height: 88px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .rp-metric .label {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
          white-space: pre-line;
          line-height: 1.1;
          margin-bottom: 6px;
        }

        .rp-metric .value {
          font-size: 22px;
          font-weight: 900;
          white-space: pre-line;
          line-height: 1.05;
        }

        .rp-metric .value.good { color: #059669; }
        .rp-metric .value.warn  { color: #dc2626; }
        .rp-metric .value.neutral { color: var(--text); }

        .rp-note {
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
          white-space: pre-line;
          line-height: 1.35;
          margin: 10px 0 12px 0;
        }

        .rp-cardPreview { 
        display: flex; 
        flex-direction: column; 
        height: 100%;
        }

        .rp-rangeText {
          color: var(--muted);
          font-size: 11px;
          display: flex;
          margin-top: auto; 
          justify-content: space-between;
          border-top: 1px solid var(--border);
          padding-top: 10px;
        }

        /* ===== Bottom export bar ===== */
        .rp-footer {
          margin-top: 18px;
          padding-top: 16px;
        }

        .rp-exportBtn {
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 900;
          color: #fff;
          background: var(--blue);
          cursor: pointer;
          box-shadow: var(--shadow-sm);
        }
        .rp-exportBtn:hover { background: var(--blue2); }

        @media (max-width: 980px) {
          .rp-grid { align-items: stretch; }
          .rp-filters { justify-content: flex-start; }
        }

        @media (max-width: 560px) {
          .rp-page { padding: 16px; }
          .rp-head { flex-direction: column; align-items: stretch; }
          .rp-pill { width: 100%; justify-content: space-between; }
          .rp-apply-filter { width: 100%; }
        }

      `}</style>

      <div className="rp-page">
        {/* Header row: title + date pills + apply filter */}
        <div className="rp-head">
          <div>
            <h1>Export Reports</h1 >
            <p>Generate and download comprehensive reports for your dashboard data</p>
          </div>

          <div className="rp-filters">
            <div className="rp-pill">
              <label>From:</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="rp-pill">
              <label>To:</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>

            <button className="rp-apply-filter" onClick={handleApplyFilter}>
              Apply Filter
            </button>
          </div>
        </div>

        {/* Main 2 cards */}
        <div className="rp-grid">
          <section className="rp-card">
            <h2 className="rp-cardTitle">
              <span className="rp-iconBadge">📄</span>
              Select Report Type
            </h2>

            <div className="rp-selectWrap">
              {(["user_activity", "itinerary_stats", "content_moderation", "growth_analytics"] as ReportKey[]).map(
                (key) => (
                  <div
                    key={key}
                    className={`rp-row ${reportType === key ? "active" : ""}`}
                    onClick={() => setReportType(key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setReportType(key);
                    }}
                  >
                    <div className="rp-rowLeft">
                      <div className="rp-miniIcon">{reportMeta[key].icon}</div>
                      <div className="rp-rowText">
                        <p className="t">{reportMeta[key].title}</p>
                        <p className="d">{reportMeta[key].desc}</p>
                      </div>
                    </div>
                    <span className="rp-radio" aria-label="select" />
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rp-card rp-cardPreview">
            <h2 className="rp-cardTitle">
              <span className="rp-iconBadge">🔎</span>
              Report Preview
            </h2>

            <div className="rp-previewPanel">
                <div className="rp-previewHeading">
                {loadingPreview ? "Loading..." : preview?.heading}
                </div>

                {previewErr && (
                <div style={{ color: "#dc2626", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    {previewErr}
                </div>
                )}

              <div className="rp-previewGrid">
                {preview?.cards.map((c) => (
                  <div key={c.label} className="rp-metric">
                    <div className="label">{c.label}</div>
                    <div className={`value ${c.tone}`}>{c.value}</div>
                  </div>
                ))}
              </div>

              <div className="rp-note">{preview?.note}</div>
              <div className="rp-rangeText">
                <span>From: {formatDateDisplay(fromDate)}</span>
                <span>To: {formatDateDisplay(toDate)}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Export button (like screenshot) */}
        <div className="rp-footer">
          <button className="rp-exportBtn" onClick={handleExport}>
            Export Report
          </button>
        </div>
        <div className="rp-footer">
        </div>
        <ExportPDF
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        onExport={async () => {
            setPdfOpen(false);
            requestAnimationFrame(() => {
            window.print();
            });
        }}
        />
      </div>
    </>
  );
}
