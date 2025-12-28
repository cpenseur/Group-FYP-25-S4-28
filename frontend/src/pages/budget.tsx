// frontend/src/pages/budget.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import TripSubHeader from "../components/TripSubHeader";

/**
 * Backend expectations:
 * - Budget:
 *    GET    /f3/budgets/?trip=:tripId
 *    POST   /f3/budgets/
 *    PATCH  /f3/budgets/:id/
 *
 * - Expenses:
 *    GET    /f3/expenses/?trip=:tripId
 *    POST   /f3/expenses/
 *    PATCH  /f3/expenses/:id/
 *    DELETE /f3/expenses/:id/
 *
 * - Splits:
 *    POST   /f3/expense-splits/
 *    DELETE /f3/expense-splits/:id/
 *
 * - Trip members:
 *    GET    /f3/budgets/trip-members/?trip=:tripId
 *
 * - FX:
 *    GET /f3/fx/latest/?base=SGD
 */

type TripMember = {
  id: string; // UUID string
  full_name: string | null;
  email: string | null;
};

type ExpenseSplit = {
  id: number;
  expense: number;
  user: string; // UUID string
  amount: number;
  is_settled: boolean;
};

type TripExpense = {
  id: number;
  trip: number;
  payer: string; // UUID string
  description: string;
  category: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  linked_day: number | null;
  linked_item: number | null;
  splits?: ExpenseSplit[];
};

type TripBudget = {
  id: number;
  trip: number;
  currency: string;
  planned_total: any; // backend may send string
  actual_total: any;
};

type ModalType = "budget" | "expense" | "balances" | null;

const currencyOptions = [
  "SGD",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "MYR",
  "THB",
  "IDR",
  "CNY",
  "INR",
  "KRW",
];

const categoryOptions = [
  "Flights",
  "Lodging",
  "Car rental",
  "Transit",
  "Food",
  "Drinks",
  "Sightseeing",
  "Activities",
  "Shopping",
  "Gas",
  "Groceries",
  "Other",
];

const pageStyles = `
.budget-page {
  padding: 24px 24px 48px;
  background: #f7f8fb;
  min-height: 100vh;
  font-family: "Inter", "Segoe UI", sans-serif;
  color: #1f1f1f;
}
.warn {
  max-width: 1200px;
  margin: 0 auto 18px auto;
  background: #fff3e5;
  border: 1px solid #f1d2ac;
  color: #7a4b17;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
}
.page-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 28px;
  align-items: start;
}
.panel {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e6e8ef;
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.04);
}
.panel h2 {
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 800;
}
.big-amount {
  font-size: 44px;
  font-weight: 900;
  margin: 6px 0 12px 0;
}
.caption {
  margin: 8px 0 16px 0;
  font-style: italic;
  color: #403535;
}
.progress-track {
  width: 100%;
  height: 10px;
  background: #e7e7e7;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid #d0d0d0;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #9c2c2c, #c65b5b);
  border-radius: 999px;
}
.row {
  display:flex;
  justify-content: space-between;
  margin-top: 10px;
  color:#2b2b2b;
}
.btn {
  width: 100%;
  margin-top: 14px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid #d7d9df;
  font-weight: 900;
  cursor: pointer;
  background: #f3efe6;
}
.btn.primary {
  background: #b09b9f;
  color: #fff;
  border: none;
}
.exp-header {
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
}
.small-btn {
  padding: 10px 14px;
  border-radius: 999px;
  border: none;
  font-weight: 900;
  cursor: pointer;
  background: #b09b9f;
  color: #fff;
}
.card {
  margin-top: 14px;
  background: #f2f2f2;
  border: 1px solid #dedede;
  border-radius: 16px;
  padding: 14px;
}
.card-top {
  display:flex;
  justify-content: space-between;
  gap: 12px;
  align-items:flex-start;
}
.card-title {
  font-weight: 900;
  font-size: 18px;
}
.card-meta {
  color: #6b7280;
  font-size: 14px;
  margin-top: 4px;
}
.card-right {
  display:flex;
  gap: 18px;
  align-items:center;
}
.amount {
  font-size: 22px;
  font-weight: 900;
}
.mini {
  font-size: 14px;
  color: #6b7280;
  font-weight: 800;
}
.link-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-weight: 900;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display:flex;
  justify-content:center;
  align-items:flex-start;
  padding: 84px 18px 18px;
  z-index: 999;
}

.modal {
  width: min(760px, 96vw);
  background: #fff;
  border-radius: 18px;
  padding: 18px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 18px 50px rgba(0,0,0,0.2);
  max-height: 90vh;
  overflow-y: auto;
}

.balances-modal {
  max-height: calc(100vh - 140px);
}

.modal h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 900;
}
.grid2 {
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field label {
  display:block;
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 6px;
  font-weight: 800;
}
.field input, .field select, .field textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #d1d5db;
  outline: none;
  font-size: 14px;
  box-sizing: border-box;
  background: #fff;
  color: #111827;
  font-family: inherit;
}
.field textarea {
  min-height: 84px;
  resize: vertical;
}
.field select[multiple] {
  min-height: 120px;
  padding: 8px 10px;
}
.modal-actions {
  display:flex;
  justify-content:flex-end;
  gap: 10px;
  margin-top: 14px;
}
.secondary {
  background:#f3f4f6;
  color:#111827;
  border:1px solid #e5e7eb;
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 900;
  cursor:pointer;
}
.primary {
  background:#111827;
  color:#fff;
  border:none;
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 900;
  cursor:pointer;
}

/* --- Category chart (like screenshot #1) --- */
.cat-chart-wrap {
  margin-top: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  padding: 12px;
}
.cat-chart-title {
  font-weight: 900;
  margin: 0 0 10px 0;
  color: #111827;
}
.cat-chart {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.split-controls {
  display: flex;
  gap: 10px;
  margin: 4px 0 8px;
}
.split-controls button {
  border: none;
  background: transparent;
  color: #2563eb;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}
.split-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 140px;
  overflow-y: auto;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
}
.split-option {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #111827;
}

.balances-panel {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  padding: 14px;
}
.balances-title {
  font-weight: 900;
  color: #111827;
  font-size: 18px;
}
.balances-items {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}

@media (max-width: 1024px) {
  .page-grid { grid-template-columns: 1fr; }
}
`;

function memberLabel(m: TripMember) {
  return (m.full_name && m.full_name.trim()) || (m.email && m.email.trim()) || `User #${m.id}`;
}

// ƒo. Handles string/number safely
function fmt(amount: any) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CategoryBarChart({
  currency,
  categoryList,
  categoryTotals,
  maxValue,
}: {
  currency: string;
  categoryList: string[];
  categoryTotals: Record<string, number>;
  maxValue: number;
}) {
  const W = 860;
  const rowH = 30;
  const topPad = 12;
  const leftPad = 130;
  const rightPad = 24;
  const bottomPad = 30;

  const H = topPad + categoryList.length * rowH + bottomPad;
  const safeMax = maxValue > 0 ? maxValue : 1;

  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => (safeMax * i) / ticks);

  const xScale = (v: number) => {
    const usable = W - leftPad - rightPad;
    return leftPad + (Math.max(0, v) / safeMax) * usable;
  };

  return (
    <div className="cat-chart-wrap">
      <div className="cat-chart-title">Category Breakdown</div>

      <div className="cat-chart" style={{ minWidth: 0 }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Category breakdown chart">
          {/* grid + ticks */}
          {tickValues.map((tv, i) => {
            const x = xScale(tv);
            return (
              <g key={i}>
                <line x1={x} y1={topPad - 6} x2={x} y2={H - bottomPad + 6} stroke="#e5e7eb" />
                <text x={x} y={H - 12} textAnchor="middle" fontSize="12" fill="#6b7280">
                  {currency} {fmt(tv)}
                </text>
              </g>
            );
          })}

          {/* x-axis */}
          <line x1={leftPad} y1={H - bottomPad} x2={W - rightPad} y2={H - bottomPad} stroke="#6b7280" />

          {/* bars + labels */}
          {categoryList.map((cat, idx) => {
            const val = categoryTotals[cat] || 0;
            const y = topPad + idx * rowH;
            const barY = y + 7;
            const barH = 20;

            const x0 = leftPad;
            const x1 = xScale(val);

            return (
              <g key={cat} style={{ cursor: "default" }}>
                <text x={leftPad - 10} y={y + 22} textAnchor="end" fontSize="14" fill="#4b5563">
                  {cat}
                </text>

                <rect
                  x={x0}
                  y={barY}
                  width={W - rightPad - leftPad}
                  height={barH}
                  rx={10}
                  fill="#f3f4f6"
                  stroke="#e5e7eb"
                />

                <rect
                  x={x0}
                  y={barY}
                  width={Math.max(0, x1 - x0)}
                  height={barH}
                  rx={10}
                  fill="#bfc8ff"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const params = useParams();
  const tripId = Number((params as any).tripId || (params as any).id);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [budget, setBudget] = useState<TripBudget | null>(null);

  const [currency, setCurrency] = useState<string>("SGD");

  const [sgdPerUnit, setSgdPerUnit] = useState<Record<string, number>>({ SGD: 1 });
  const [fxWarning, setFxWarning] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const [formBudget, setFormBudget] = useState<string>("0");
  const [formCurrency, setFormCurrency] = useState<string>("SGD");

  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [formCategory, setFormCategory] = useState(categoryOptions[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formExpenseCurrency, setFormExpenseCurrency] = useState("SGD");
  const [formPayerId, setFormPayerId] = useState<string | null>(null);
  const [formSplitIds, setFormSplitIds] = useState<string[]>([]);
  const [formDate, setFormDate] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const convertAmount = (amount: number, from: string, to: string) => {
    const fromRate = sgdPerUnit[from] ?? 1;
    const toRate = sgdPerUnit[to] ?? 1;
    return (amount * fromRate) / toRate;
  };

  const reloadAll = async () => {
    if (!tripId || Number.isNaN(tripId)) {
      setErrorMsg("Missing tripId in URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const m: TripMember[] = await apiFetch(`/f3/budgets/trip-members/?trip=${tripId}`);
      setMembers(Array.isArray(m) ? m : []);

      const budgetList: TripBudget[] = await apiFetch(`/f3/budgets/?trip=${tripId}`);
      let b = (Array.isArray(budgetList) ? budgetList : [])?.[0] || null;

      if (!b) {
        b = await apiFetch(`/f3/budgets/`, {
          method: "POST",
          body: JSON.stringify({
            trip: tripId,
            currency: "SGD",
            planned_total: 0,
            actual_total: 0,
          }),
        });
      }

      setBudget(b);
      setCurrency(b.currency || "SGD");
      setFormCurrency(b.currency || "SGD");
      setFormBudget(String(Number(b.planned_total ?? 0)));

      const exps: TripExpense[] = await apiFetch(`/f3/expenses/?trip=${tripId}`);
      setExpenses(Array.isArray(exps) ? exps : []);

      try {
        const fx = await apiFetch(`/f3/fx/latest/?base=SGD`);
        const rates = fx?.sgd_per_unit || fx?.rates || null;

        if (rates && typeof rates === "object") {
          setSgdPerUnit({ SGD: 1, ...rates });
          setFxWarning(null);
        } else {
          setFxWarning("FX rates endpoint returned unexpected data. Using 1:1 conversion.");
        }
      } catch {
        setFxWarning("FX rates endpoint not available yet. Using 1:1 conversion.");
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load budget data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const plannedTotal = Number(budget?.planned_total ?? 0);

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, e) => sum + convertAmount(e.amount, e.currency, currency), 0);
  }, [expenses, currency, sgdPerUnit]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category && e.category.trim() ? e.category : "Other";
      totals[cat] = (totals[cat] || 0) + convertAmount(e.amount, e.currency, currency);
    });
    return totals;
  }, [expenses, currency, sgdPerUnit]);

  const categoryList = useMemo(() => {
    const extras = new Set<string>();
    expenses.forEach((e) => {
      if (e.category && e.category.trim()) extras.add(e.category);
    });

    const merged = [...categoryOptions];
    extras.forEach((c) => {
      if (!merged.includes(c)) merged.push(c);
    });
    return merged;
  }, [expenses]);

  const maxCategoryTotal = useMemo(() => {
    if (!categoryList.length) return 0;
    return Math.max(0, ...categoryList.map((c) => categoryTotals[c] || 0));
  }, [categoryList, categoryTotals]);

  const remaining = plannedTotal - totalSpent;

  const memberById = useMemo(() => {
    const map = new Map<string, TripMember>();
    members.forEach((m) => map.set(String(m.id), m));
    return map;
  }, [members]);

  const balances = useMemo(() => {
    const bal: Record<string, number> = {};
    members.forEach((m) => (bal[String(m.id)] = 0));

    for (const exp of expenses) {
      const expTotalPref = convertAmount(exp.amount, exp.currency, currency);
      const splits = exp.splits && exp.splits.length ? exp.splits : null;

      if (exp.payer) {
        bal[String(exp.payer)] = (bal[String(exp.payer)] ?? 0) + expTotalPref;
      }

      if (splits) {
        for (const s of splits) {
          const sharePref = convertAmount(s.amount, exp.currency, currency);
          bal[String(s.user)] = (bal[String(s.user)] ?? 0) - sharePref;
        }
      } else {
        const ids = members.map((m) => String(m.id));
        const share = ids.length ? expTotalPref / ids.length : expTotalPref;
        ids.forEach((uid) => {
          bal[uid] = (bal[uid] ?? 0) - share;
        });
      }
    }

    return bal;
  }, [expenses, members, currency, sgdPerUnit]);

  const progressPct = useMemo(() => {
    if (plannedTotal <= 0) return 0;
    return Math.min(100, Math.max(0, (totalSpent / plannedTotal) * 100));
  }, [plannedTotal, totalSpent]);

  const openBudgetModal = () => {
    setFormBudget(String(Number(budget?.planned_total ?? 0)));
    setFormCurrency(currency);
    setActiveModal("budget");
  };

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setFormCategory(categoryOptions[0]);
    setFormAmount("");
    setFormExpenseCurrency(currency);
    setFormDate("");
    setFormDescription("");

    setFormPayerId(null);
    setFormSplitIds(members.map((m) => String(m.id)));
  };

  const openNewExpenseModal = () => {
    resetExpenseForm();
    setActiveModal("expense");
  };

  const openEditExpenseModal = (e: TripExpense) => {
    setEditingExpense(e);
    setFormCategory(e.category || categoryOptions[0]);
    setFormAmount(String(e.amount ?? ""));
    setFormExpenseCurrency(e.currency || currency);
    setFormDate(e.paid_at ? String(e.paid_at).slice(0, 10) : "");
    setFormDescription(e.description || "");
    setFormPayerId(e.payer ?? null);

    if (e.splits && e.splits.length) {
      setFormSplitIds(e.splits.map((s) => String(s.user)));
    } else {
      setFormSplitIds(members.map((m) => String(m.id)));
    }

    setActiveModal("expense");
  };

  const saveBudget = async () => {
    if (!budget) return;

    const planned = Number(formBudget);
    if (!Number.isFinite(planned) || planned < 0) {
      alert("Invalid budget amount.");
      return;
    }

    const newCurrency = formCurrency;

    try {
      const updated: TripBudget = await apiFetch(`/f3/budgets/${budget.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          planned_total: planned,
          currency: newCurrency,
        }),
      });

      setBudget(updated);
      setCurrency(updated.currency || newCurrency);
      setFormBudget(String(Number(updated.planned_total ?? planned)));
      setFormCurrency(updated.currency || newCurrency);
      setActiveModal(null);
    } catch (e: any) {
      alert(e?.message || "Failed to save budget.");
    }
  };

  const saveExpense = async () => {
    if (!tripId) return;

    const amt = Number(formAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Invalid expense amount.");
      return;
    }
    if (!formPayerId) {
      alert("Please select who paid for this expense.");
      return;
    }
    if (!formSplitIds.length) {
      alert("Please select at least one participant.");
      return;
    }

    const payload = {
      trip: tripId,
      payer: formPayerId,
      description: formDescription || "",
      category: formCategory,
      amount: amt,
      currency: formExpenseCurrency,
      paid_at: formDate ? formDate : null,
      linked_day: null,
      linked_item: null,
    };

    try {
      let saved: TripExpense;

      if (editingExpense) {
        if (editingExpense.splits && editingExpense.splits.length > 0) {
          await Promise.all(
            editingExpense.splits.map((split) =>
              apiFetch(`/f3/expense-splits/${split.id}/`, {
                method: "DELETE",
              })
            )
          );
        }

        saved = await apiFetch(`/f3/expenses/${editingExpense.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        saved = await apiFetch(`/f3/expenses/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      const share = Math.round((amt / formSplitIds.length) * 100) / 100;

      for (const uid of formSplitIds) {
        try {
          await apiFetch(`/f3/expense-splits/`, {
            method: "POST",
            body: JSON.stringify({
              expense: saved.id,
              user: uid,
              amount: share,
              is_settled: false,
            }),
          });
        } catch (splitError: any) {
          console.error(`Failed to create split for user ${uid}:`, splitError);
        }
      }

      setActiveModal(null);
      await reloadAll();
    } catch (e: any) {
      alert(e?.message || "Failed to save expense.");
    }
  };

  const deleteExpense = async (e: TripExpense) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await apiFetch(`/f3/expenses/${e.id}/`, { method: "DELETE" });
      await reloadAll();
    } catch (err: any) {
      alert(err?.message || "Failed to delete expense.");
    }
  };

  if (loading) {
    return (
      <>
        <style>{pageStyles}</style>
        <TripSubHeader />
        <div className="budget-page">
          <div style={{ maxWidth: 1200, margin: "0 auto", color: "#6b7280", fontSize: 14 }}>
            Loading budget...
          </div>
        </div>
      </>
    );
  }

  if (errorMsg) {
    return (
      <>
        <style>{pageStyles}</style>
        <TripSubHeader />
        <div className="budget-page">
          <div className="warn">{errorMsg}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{pageStyles}</style>
      <TripSubHeader />

      <div className="budget-page">
        {fxWarning && <div className="warn">{fxWarning}</div>}

        <div className="page-grid">
          {/* LEFT */}
          <div className="panel">
            <h2>Budgeting</h2>

            <div className="big-amount">
              {currency} {fmt(totalSpent)}
            </div>

            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="row">
              <div style={{ fontStyle: "italic" }}>Budget:</div>
              <div style={{ fontWeight: 900 }}>
                {currency} {fmt(plannedTotal)}
              </div>
            </div>

            <div className="row">
              <div style={{ fontStyle: "italic" }}>Remaining:</div>
              <div style={{ fontWeight: 900 }}>
                {currency} {fmt(remaining)}
              </div>
            </div>

            <button className="btn" onClick={openBudgetModal}>
              Edit Budget
            </button>

            <button className="btn" onClick={() => setActiveModal("balances")}>
              Total Balances
            </button>
          </div>

          {/* RIGHT */}
          <div className="panel">
            <div className="exp-header">
              <h2 style={{ margin: 0 }}>Expenses</h2>
              <button className="small-btn" onClick={openNewExpenseModal}>
                + Add Expense
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="caption" style={{ marginTop: 12 }}>
                No expenses yet. Click "+ Add Expense".
              </div>
            ) : (
              expenses.map((e) => {
                const payer = memberById.get(String(e.payer));
                const payerName = payer ? memberLabel(payer) : `User #${e.payer}`;
                const converted = convertAmount(e.amount, e.currency, currency);

                const splitNames =
                  e.splits && e.splits.length
                    ? e.splits
                      .map((s) => memberById.get(String(s.user)))
                      .filter(Boolean)
                      .map((u) => memberLabel(u as TripMember))
                      .join(", ")
                    : "Everyone";

                return (
                  <div key={e.id} className="card">
                    <div className="card-top">
                      <div>
                        <div className="card-title">{e.category}</div>
                        <div className="card-meta">
                          Paid by <b>{payerName}</b>
                        </div>
                        <div className="card-meta">Split with {splitNames}</div>
                        {e.description ? <div className="card-meta">{e.description}</div> : null}
                      </div>

                      <div className="card-right">
                        <div style={{ textAlign: "right" }}>
                          <div className="amount">
                            {currency} {fmt(converted)}
                          </div>
                          <div className="mini">
                            ({e.currency} {fmt(e.amount)})
                          </div>
                        </div>

                        <button className="link-btn" onClick={() => openEditExpenseModal(e)}>
                          Edit
                        </button>
                        <button className="link-btn" onClick={() => deleteExpense(e)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Budget modal */}
        {activeModal === "budget" && (
          <div className="modal-backdrop" onMouseDown={() => setActiveModal(null)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <h3>Edit Budget</h3>

              <div className="grid2">
                <div className="field">
                  <label>Budget amount</label>
                  <input value={formBudget} onChange={(e) => setFormBudget(e.target.value)} />
                </div>

                <div className="field">
                  <label>Budget currency</label>
                  <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)}>
                    {currencyOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button className="secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button className="primary" onClick={saveBudget}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Expense modal */}
        {activeModal === "expense" && (
          <div className="modal-backdrop" onMouseDown={() => setActiveModal(null)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <h3>{editingExpense ? "Edit Expense" : "Add Expense"}</h3>

              <div className="grid2">
                <div className="field">
                  <label>Category</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {categoryList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Amount</label>
                  <input value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
                </div>

                <div className="field">
                  <label>Currency</label>
                  <select
                    value={formExpenseCurrency}
                    onChange={(e) => setFormExpenseCurrency(e.target.value)}
                  >
                    {currencyOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Date</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>

                <div className="field">
                  <label>Payer</label>
                  <select
                    value={formPayerId ?? ""}
                    onChange={(e) => setFormPayerId(e.target.value ? e.target.value : null)}
                  >
                    <option value="">Select payer</option>
                    {members.length === 0 && <option disabled>No members found</option>}
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Participants (split with)</label>

                  <div className="split-controls">
                    <button
                      type="button"
                      onClick={() => setFormSplitIds(members.map((m) => m.id))}
                    >
                      Select all
                    </button>
                    <button type="button" onClick={() => setFormSplitIds([])}>
                      Clear
                    </button>
                  </div>

                  <div className="split-options">
                    {members.map((m) => (
                      <label key={m.id} className="split-option">
                        <input
                          type="checkbox"
                          checked={formSplitIds.includes(m.id)}
                          onChange={() => {
                            setFormSplitIds((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((id) => id !== m.id)
                                : [...prev, m.id]
                            );
                          }}
                        />
                        <span>{memberLabel(m)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Description (optional)</label>
                  <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                </div>
              </div>

              <div className="modal-actions">
                <button className="secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button className="primary" onClick={saveExpense}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Balances modal */}
        {activeModal === "balances" && (
          <div className="modal-backdrop" onMouseDown={() => setActiveModal(null)}>
            <div className="modal balances-modal" onMouseDown={(e) => e.stopPropagation()}>
              <h3>Total Balances ({currency})</h3>

              <div className="balances-panel">
                {expenses.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>No expenses yet.</div>
                ) : (
                  <CategoryBarChart
                    currency={currency}
                    categoryList={categoryList}
                    categoryTotals={categoryTotals}
                    maxValue={maxCategoryTotal}
                  />
                )}
              </div>

              <div className="balances-panel" style={{ marginTop: 14 }}>
                <div className="balances-title">Balances by member</div>
                <div className="balances-items">
                  {members.map((m) => {
                    const v = balances[String(m.id)] ?? 0;
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{memberLabel(m)}</div>
                        <div style={{ fontWeight: 900 }}>
                          {v >= 0 ? "+" : "-"} {currency} {fmt(Math.abs(v))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button className="primary" onClick={() => setActiveModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
