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
 *
 * - Trip members:
 *    GET    /f3/budgets/trip-members/?trip=:tripId
 *
 * - FX:
 *    GET /f3/fx/latest/?base=SGD
 */

type TripMember = {
  id: number;
  full_name: string | null;
  email: string | null;
};

type ExpenseSplit = {
  id: number;
  expense: number;
  user: number;
  amount: number;
  is_settled: boolean;
};

type TripExpense = {
  id: number;
  trip: number;
  payer: number; // user id
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
  planned_total: number;
  actual_total: number;
};

type ModalType = "budget" | "expense" | "balances" | null;

const currencyOptions = ["SGD", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "MYR", "THB", "IDR", "CNY", "INR", "KRW"];

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
.top-note {
  max-width: 1200px;
  margin: 0 auto 12px auto;
  font-size: 14px;
  color: #6b7280;
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
  align-items:center;
  padding: 18px;
  z-index: 999;
}
.modal {
  width: min(760px, 96vw);
  background: #fff;
  border-radius: 18px;
  padding: 18px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 18px 50px rgba(0,0,0,0.2);
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
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #d7d9df;
  outline: none;
}
.field textarea {
  min-height: 84px;
  resize: vertical;
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
.danger {
  background:#fee2e2;
  color:#991b1b;
  border:1px solid #fecaca;
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
@media (max-width: 1024px) {
  .page-grid { grid-template-columns: 1fr; }
}
`;

function memberLabel(m: TripMember) {
  return (m.full_name && m.full_name.trim()) || (m.email && m.email.trim()) || `User #${m.id}`;
}

function fmt(amount: number) {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetPage() {
  const params = useParams();
  const tripId = Number(params.tripId || params.id);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [budget, setBudget] = useState<TripBudget | null>(null);

  // budget currency (preferred)
  const [currency, setCurrency] = useState<string>("SGD");

  // FX rates: sgd_per_unit["USD"] means SGD for 1 USD
  const [sgdPerUnit, setSgdPerUnit] = useState<Record<string, number>>({ SGD: 1 });
  const [fxWarning, setFxWarning] = useState<string | null>(null);

  // UI
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Budget form
  const [formBudget, setFormBudget] = useState<string>("0");
  const [formCurrency, setFormCurrency] = useState<string>("SGD");

  // Expense form
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [formCategory, setFormCategory] = useState(categoryOptions[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formExpenseCurrency, setFormExpenseCurrency] = useState("SGD");
  const [formPayerId, setFormPayerId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formSplitIds, setFormSplitIds] = useState<number[]>([]);
  const [formDescription, setFormDescription] = useState("");

  const convertAmount = (amount: number, from: string, to: string) => {
    const fromRate = sgdPerUnit[from] ?? 1;
    const toRate = sgdPerUnit[to] ?? 1;
    // amount[from] -> SGD -> to
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
      // 1) Members (owner + collaborators)
      const m: TripMember[] = await apiFetch(`/f3/budgets/trip-members/?trip=${tripId}`);
      setMembers(m);

      // 2) Budget row (get or create)
      const budgetList: TripBudget[] = await apiFetch(`/f3/budgets/?trip=${tripId}`);
      let b = budgetList?.[0] || null;

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
      setFormBudget(String(b.planned_total ?? 0));

      // 3) Expenses
      const exps: TripExpense[] = await apiFetch(`/f3/expenses/?trip=${tripId}`);
      setExpenses(Array.isArray(exps) ? exps : []);

      // 4) FX
      try {
        const fx = await apiFetch(`/f3/fx/latest/?base=SGD`);
        const rates = fx?.sgd_per_unit || fx?.rates || null;

        if (rates && typeof rates === "object") {
          setSgdPerUnit({ SGD: 1, ...rates });
          setFxWarning(null);
        } else {
          setFxWarning("FX rates endpoint returned unexpected data. Using 1:1 conversion.");
        }
      } catch (e: any) {
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

  const plannedTotal = budget?.planned_total ?? 0;

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, e) => sum + convertAmount(e.amount, e.currency, currency), 0);
  }, [expenses, currency, sgdPerUnit]);

  const remaining = plannedTotal - totalSpent;

  const memberById = useMemo(() => {
    const map = new Map<number, TripMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  // balances: payer +, participants -
  const balances = useMemo(() => {
    const bal: Record<number, number> = {};
    members.forEach((m) => (bal[m.id] = 0));

    for (const exp of expenses) {
      const expTotalPref = convertAmount(exp.amount, exp.currency, currency);
      const splits = exp.splits && exp.splits.length ? exp.splits : null;

      if (exp.payer) {
        bal[exp.payer] = (bal[exp.payer] ?? 0) + expTotalPref;
      }

      if (splits) {
        for (const s of splits) {
          const sharePref = convertAmount(s.amount, exp.currency, currency);
          bal[s.user] = (bal[s.user] ?? 0) - sharePref;
        }
      } else {
        const ids = members.map((m) => m.id);
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
    setFormBudget(String(budget?.planned_total ?? 0));
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

    const defaultPayer = members[0]?.id ?? null;
    setFormPayerId(defaultPayer);

    // default: split with everyone
    setFormSplitIds(members.map((m) => m.id));
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

    // if splits present, preselect participants from splits; else everyone
    if (e.splits && e.splits.length) {
      setFormSplitIds(e.splits.map((s) => s.user));
    } else {
      setFormSplitIds(members.map((m) => m.id));
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
      alert("Please choose payer.");
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

      // Save splits as equal shares (basic version)
      // shares stored in expense currency, then UI converts to budget currency
      const share = amt / formSplitIds.length;

      // NOTE: This will create NEW split rows; for a production version you’d delete old splits first.
      await Promise.all(
        formSplitIds.map((uid) =>
          apiFetch(`/f3/expense-splits/`, {
            method: "POST",
            body: JSON.stringify({
              expense: saved.id,
              user: uid,
              amount: share,
              is_settled: false,
            }),
          })
        )
      );

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
          <div className="top-note">Loading budget...</div>
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
          <div className="top-note">Trip #{tripId}</div>
          <div className="warn">{errorMsg}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{pageStyles}</style>

      {/* ✅ Same trip sub header tabs as notes/checklists */}
      <TripSubHeader />

      <div className="budget-page">
        <div className="top-note">Trip #{tripId} • Stored in database • No hardcoded expenses</div>

        {fxWarning && <div className="warn">{fxWarning}</div>}

        <div className="page-grid">
          {/* LEFT: Budget */}
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

          {/* RIGHT: Expenses */}
          <div className="panel">
            <div className="exp-header">
              <h2 style={{ margin: 0 }}>Expenses</h2>
              <button className="small-btn" onClick={openNewExpenseModal}>
                + Add Expense
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="caption" style={{ marginTop: 12 }}>
                No expenses yet. Click “Add Expense”.
              </div>
            ) : (
              expenses.map((e) => {
                const payer = memberById.get(e.payer);
                const payerName = payer ? memberLabel(payer) : `User #${e.payer}`;

                const converted = convertAmount(e.amount, e.currency, currency);

                // show split list for UI
                const splitNames =
                  e.splits && e.splits.length
                    ? e.splits
                        .map((s) => memberById.get(s.user))
                        .filter(Boolean)
                        .map((u) => memberLabel(u as TripMember))
                        .join(", ")
                    : "—";

                return (
                  <div key={e.id} className="card">
                    <div className="card-top">
                      <div>
                        <div className="card-title">{e.category}</div>
                        <div className="card-meta">Paid by <b>{payerName}</b></div>
                        <div className="card-meta">Split with {splitNames}</div>
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

                        <button className="link-btn" onClick={() => openEditExpenseModal(e)}>Edit</button>
                        <button className="link-btn" onClick={() => deleteExpense(e)}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MODALS */}
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

        {activeModal === "expense" && (
          <div className="modal-backdrop" onMouseDown={() => setActiveModal(null)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <h3>{editingExpense ? "Edit Expense" : "Add Expense"}</h3>

              <div className="grid2">
                <div className="field">
                  <label>Category</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {categoryOptions.map((c) => (
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
                  <select value={formExpenseCurrency} onChange={(e) => setFormExpenseCurrency(e.target.value)}>
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
                    onChange={(e) => setFormPayerId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select payer</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Participants (split with)</label>
                  <select
                    multiple
                    value={formSplitIds.map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                      setFormSplitIds(selected);
                    }}
                    style={{ height: 120 }}
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Description (optional)</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
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

        {activeModal === "balances" && (
          <div className="modal-backdrop" onMouseDown={() => setActiveModal(null)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <h3>Total Balances ({currency})</h3>

              <div style={{ marginTop: 10 }}>
                {members.map((m) => {
                  const v = balances[m.id] ?? 0;
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
                      <div style={{ fontWeight: 900 }}>{memberLabel(m)}</div>
                      <div style={{ fontWeight: 900 }}>
                        {v >= 0 ? "+" : "-"} {currency} {fmt(Math.abs(v))}
                      </div>
                    </div>
                  );
                })}
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
