import React, { useMemo, useState } from "react";

interface Expense {
  id: number;
  category: string;
  amount: number;
  currency: string;
  payer?: string;
  date?: string;
  splitWith?: string[];
}

const pageStyles = `
.budget-page {
  padding: 24px 24px 48px;
  background: #f7f8fb;
  min-height: 100vh;
  font-family: "Inter", "Segoe UI", sans-serif;
  color: #1f1f1f;
}

.page-grid {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 28px;
  align-items: start;
}

.budget-panel {
  background: #f1f1f1;
  border-radius: 18px;
  border: 1px solid #e4e4e4;
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.04);
}

.budget-panel h2 {
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 800;
}

.budget-amount {
  font-size: 42px;
  font-weight: 800;
  margin: 0 0 12px 0;
  color: #1f1f1f;
}

.budget-caption {
  margin: 8px 0 16px 0;
  font-style: italic;
  color: #403535;
}

.progress-track {
  width: 100%;
  height: 10px;
  background: #d9d9d9;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid #c5c5c5;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #9c2c2c, #c65b5b);
  border-radius: 999px;
}

.budget-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pill-btn {
  border: 1px solid #c6c2b9;
  background: #ddd8cd;
  border-radius: 999px;
  padding: 12px 16px;
  font-weight: 800;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1f1f1f;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
}

.pill-btn.secondary {
  background: #e9e6de;
}

.expenses-panel {
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.expenses-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.expenses-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 26px;
  font-weight: 800;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.add-expense-btn {
  background: #b09b9f;
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 10px 16px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
}

.filter-btn {
  background: #e3e3e3;
  border: 1px solid #cfcfcf;
  border-radius: 999px;
  padding: 10px 12px;
  cursor: pointer;
}

.expense-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.expense-card {
  background: #f1f1f1;
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e0e0e0;
}

.expense-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expense-cat {
  font-size: 18px;
  font-weight: 800;
}

.expense-meta {
  font-size: 13px;
  color: #5d6678;
}

.expense-amt {
  font-size: 22px;
  font-weight: 800;
}

.expense-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 15px;
  padding: 4px 6px;
  color: #333;
}

.muted {
  color: #8a8f9f;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 20, 20, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
}

.modal-card {
  background: #fff;
  border-radius: 18px;
  padding: 22px;
  width: min(560px, 95vw);
  box-shadow: 0 20px 44px rgba(20, 30, 60, 0.2);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
}

.close-btn {
  border: 1px solid #c7c7c7;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-weight: 700;
  color: #1f1f1f;
}

.field-row {
  display: grid;
  grid-template-columns: 0.6fr 1.4fr;
  gap: 8px;
}

.input,
.select {
  width: 100%;
  border: 1px solid #c6a5a5;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 16px;
  background: #fff;
}

.select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, #555 50%), linear-gradient(135deg, #555 50%, transparent 50%);
  background-position: calc(100% - 18px) calc(50% - 4px), calc(100% - 13px) calc(50% - 4px);
  background-size: 8px 8px, 8px 8px;
  background-repeat: no-repeat;
}

.inline-row {
  display: grid;
  grid-template-columns: 0.35fr 1fr;
  gap: 8px;
}

.split-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.split-chip {
  border: 1px solid #d4d4d4;
  border-radius: 999px;
  padding: 8px 12px;
  background: #f1f1f1;
  cursor: pointer;
  font-weight: 600;
}

.split-chip.active {
  background: #d8c7c9;
  border-color: #c7a7ab;
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
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
}

.primary-btn {
  background: #b09b9f;
  color: #fff;
  border: none;
  padding: 12px 18px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
}

@media (max-width: 1024px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}
`;

const currencyOptions = ["SGD", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "MYR", "THB", "IDR", "CNY", "INR"];
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
const defaultCollaborators = ["Ray", "Lena", "Priya", "Marcus", "Mei"];
const sgdPerUnit: Record<string, number> = {
  SGD: 1,
  USD: 1.35,
  EUR: 1.45,
  GBP: 1.7,
  JPY: 0.0093,
  AUD: 0.88,
  CAD: 0.99,
  MYR: 0.29,
  THB: 0.037,
  IDR: 0.000089,
  CNY: 0.19,
  INR: 0.016,
};

const convertAmount = (amount: number, from: string, to: string) => {
  const fromRate = sgdPerUnit[from] ?? 1;
  const toRate = sgdPerUnit[to] ?? 1;
  return (amount * fromRate) / toRate;
};

export default function BudgetPage() {
  const [tripName] = useState("Trip to Japan");
  const [location] = useState("Tokyo - Osaka");
  const [duration] = useState("7 days - 6 nights");
  const [currency, setCurrency] = useState("SGD");

  const [budgetPlanned, setBudgetPlanned] = useState(2650);

  const [collaborators, setCollaborators] = useState<string[]>(defaultCollaborators);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTripmateModal, setShowTripmateModal] = useState(false);
  const [showBalancesModal, setShowBalancesModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [formBudget, setFormBudget] = useState(budgetPlanned.toString());
  const [formCurrency, setFormCurrency] = useState(currency);

  const [formCategory, setFormCategory] = useState(categoryOptions[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formPayer, setFormPayer] = useState(defaultCollaborators[0]);
  const [formExpenseCurrency, setFormExpenseCurrency] = useState(currency);
  const [formDate, setFormDate] = useState("");
  const [formSplitWith, setFormSplitWith] = useState<string[]>([]);
  const [inviteLink] = useState("https://tripmate.example.com/plan/xyz123");
  const [inviteEmail, setInviteEmail] = useState("");
  const [newCollaborator, setNewCollaborator] = useState("");

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, e) => sum + convertAmount(e.amount, e.currency, currency), 0);
  }, [expenses, currency]);

  const remaining = budgetPlanned - totalSpent;

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setFormCategory(categoryOptions[0]);
    setFormAmount("");
    setFormPayer(collaborators[0] || "");
    setFormExpenseCurrency(currency);
    setFormDate("");
    setFormSplitWith(collaborators);
  };

  const toggleSplitWith = (name: string) => {
    setFormSplitWith((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleBudgetSave = () => {
    const val = parseFloat(formBudget);
    if (Number.isNaN(val) || val < 0) return;
    setBudgetPlanned(val);
    setCurrency(formCurrency || currency);
    setShowBudgetModal(false);
  };

  const handleExpenseSave = () => {
    const amt = parseFloat(formAmount);
    if (!formCategory.trim() || Number.isNaN(amt) || amt < 0) return;
    if (!formPayer) return;
    const participants = formSplitWith.length ? formSplitWith : collaborators;
    const normalized = participants.includes(formPayer) ? participants : [...participants, formPayer];

    if (editingExpense) {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === editingExpense.id
            ? {
                ...e,
                category: formCategory.trim(),
                amount: amt,
                currency: formExpenseCurrency,
                payer: formPayer,
                date: formDate,
                splitWith: normalized,
              }
            : e
        )
      );
    } else {
      setExpenses((prev) => [
        ...prev,
        {
          id: Date.now(),
          category: formCategory.trim(),
          amount: amt,
          currency: formExpenseCurrency,
          payer: formPayer || undefined,
          date: formDate || undefined,
          splitWith: normalized,
        },
      ]);
    }
    resetExpenseForm();
    setShowExpenseModal(false);
  };

  const handleExpenseDelete = (id: number) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (editingExpense?.id === id) resetExpenseForm();
  };

  const balances = useMemo(() => {
    const initial = collaborators.reduce<Record<string, number>>((acc, name) => {
      acc[name] = 0;
      return acc;
    }, {});

    expenses.forEach((exp) => {
      const participants = exp.splitWith && exp.splitWith.length ? exp.splitWith : collaborators;
      const converted = convertAmount(exp.amount, exp.currency, currency);
      const share = participants.length ? converted / participants.length : converted;
      if (exp.payer) {
        initial[exp.payer] = (initial[exp.payer] ?? 0) + converted;
      }
      participants.forEach((name) => {
        initial[name] = (initial[name] ?? 0) - share;
      });
    });

    return initial;
  }, [expenses, collaborators, currency]);

  const handleAddCollaborator = () => {
    const trimmed = newCollaborator.trim();
    if (!trimmed) return false;
    if (collaborators.includes(trimmed)) return false;
    setCollaborators((prev) => [...prev, trimmed]);
    setNewCollaborator("");
    return true;
  };

  const handleInviteEmail = () => {
    const email = inviteEmail.trim();
    if (!email) return false;
    if (!collaborators.includes(email)) {
      setCollaborators((prev) => [...prev, email]);
    }
    setInviteEmail("");
    return true;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // noop if clipboard is unavailable
    }
  };

  return (
    <>
      <style>{pageStyles}</style>
      <div className="budget-page">
        <div className="page-grid">
          <section className="budget-panel">
            <h2>Budgeting</h2>
            <div className="budget-amount">
              {currency} {totalSpent.toLocaleString()}
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, (totalSpent / Math.max(budgetPlanned, 1)) * 100)}%` }}
              />
            </div>
            <div className="budget-caption">
              Budget: {currency} {budgetPlanned.toLocaleString()}
            </div>
            <div className="budget-caption">
              Remaining: {currency} {remaining.toLocaleString()}
            </div>

            <div className="budget-actions">
              <button className="pill-btn" onClick={() => {
                setFormBudget(budgetPlanned.toString());
                setFormCurrency(currency);
                setShowBudgetModal(true);
              }}>
                Edit Budget
              </button>
              <button className="pill-btn secondary" onClick={() => setShowTripmateModal(true)}>Add Tripmate</button>
              <button className="pill-btn secondary" onClick={() => setShowBalancesModal(true)}>Total Balances</button>
              <button className="pill-btn secondary">Settings</button>
            </div>
          </section>

          <section className="expenses-panel">
            <div className="expenses-header">
              <div className="expenses-title">Expenses</div>
              <div className="header-actions">
                <button
                  className="add-expense-btn"
                  onClick={() => {
                    resetExpenseForm();
                    setShowExpenseModal(true);
                  }}
                >
                  + Add Expense
                </button>
                <button className="filter-btn" title="Filters">
                  Filters
                </button>
              </div>
            </div>

            <div className="expense-list">
              {expenses.map((e) => (
                <div key={e.id} className="expense-card">
                  <div className="expense-main">
                    <div className="expense-cat">{e.category}</div>
                    {e.payer && <div className="expense-meta">Paid by {e.payer}</div>}
                    {e.splitWith && e.splitWith.length > 0 && (
                      <div className="expense-meta">Split with: {e.splitWith.join(", ")}</div>
                    )}
                  </div>
                  <div className="expense-actions">
                    <div className="expense-amt">
                      {e.currency} {e.amount.toLocaleString()} ({currency} {convertAmount(e.amount, e.currency, currency).toLocaleString()})
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        setEditingExpense(e);
                        setFormCategory(e.category);
                        setFormAmount(e.amount.toString());
                        setFormExpenseCurrency(e.currency);
                        setFormPayer(e.payer || collaborators[0] || "");
                        setFormDate(e.date || "");
                        setFormSplitWith(e.splitWith || []);
                        setShowExpenseModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="icon-btn" onClick={() => handleExpenseDelete(e.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && <div className="muted">No expenses yet.</div>}
            </div>
          </section>
        </div>

        {(showBudgetModal || showExpenseModal || showTripmateModal || showBalancesModal) && (
          <div className="modal-overlay" onClick={() => {
            setShowBudgetModal(false);
            setShowExpenseModal(false);
            setShowTripmateModal(false);
            setShowBalancesModal(false);
          }}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              {showTripmateModal && (
                <>
                  <div className="modal-header">
                    <h3 className="modal-title">Invite tripmates</h3>
                    <button className="close-btn" onClick={() => setShowTripmateModal(false)}>X</button>
                  </div>
                  <div className="field">
                    <label>Share link</label>
                    <div className="inline-row">
                      <input className="input" type="text" value={inviteLink} readOnly />
                      <button className="primary-btn" type="button" onClick={handleCopyLink}>
                        Copy link
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label>Invite by email or user</label>
                    <div className="inline-row">
                      <input
                        className="input"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@example.com"
                      />
                      <button className="primary-btn" type="button" onClick={handleInviteEmail}>
                        Invite
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label>Manage tripmates</label>
                    <div className="split-list">
                      {collaborators.map((name) => (
                        <div key={name} className="split-chip active">{name}</div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {showBudgetModal && (
                <>
                  <div className="modal-header">
                    <h3 className="modal-title">Set Budget</h3>
                    <button className="close-btn" onClick={() => setShowBudgetModal(false)}>X</button>
                  </div>
                  <div className="inline-row">
                    <select
                      className="select"
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value)}
                    >
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="number"
                      value={formBudget}
                      onChange={(e) => setFormBudget(e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="modal-actions">
                    <button className="ghost-btn" onClick={() => setShowBudgetModal(false)}>
                      Cancel
                    </button>
                    <button className="primary-btn" onClick={handleBudgetSave}>
                      Save
                    </button>
                  </div>
                </>
              )}

              {showExpenseModal && (
                <>
                  <div className="modal-header">
                    <h3 className="modal-title">{editingExpense ? "Edit Expense" : "Add Expense"}</h3>
                    <button className="close-btn" onClick={() => setShowExpenseModal(false)}>X</button>
                  </div>
                  <div className="inline-row">
                    <select
                      className="select"
                      value={formExpenseCurrency}
                      onChange={(e) => setFormExpenseCurrency(e.target.value)}
                    >
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="number"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="field">
                    <label>Select Category</label>
                    <select
                      className="select"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Paid By</label>
                    <select
                      className="select"
                      value={formPayer}
                      onChange={(e) => setFormPayer(e.target.value)}
                    >
                      {collaborators.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Split with</label>
                    <div className="split-list">
                      <button
                        type="button"
                        className={`split-chip ${formSplitWith.length === collaborators.length ? "active" : ""}`}
                        onClick={() => setFormSplitWith(collaborators)}
                      >
                        Split with everyone
                      </button>
                      <button
                        type="button"
                        className={`split-chip ${formSplitWith.length === 1 && formSplitWith[0] === formPayer ? "active" : ""}`}
                        onClick={() => setFormSplitWith(formPayer ? [formPayer] : [])}
                      >
                        No split
                      </button>
                      {collaborators.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className={`split-chip ${formSplitWith.includes(name) ? "active" : ""}`}
                          onClick={() => toggleSplitWith(name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>Date (optional)</label>
                    <input
                      className="input"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                  </div>
                  <div className="modal-actions">
                    <button className="ghost-btn" onClick={() => setShowExpenseModal(false)}>
                      Cancel
                    </button>
                    <button className="primary-btn" onClick={handleExpenseSave}>
                      Save
                    </button>
                  </div>
                </>
              )}
            </div>
            {showTripmateModal && (
              <>
                <div className="modal-header">
                  <h3 className="modal-title">Add Tripmate</h3>
                  <button className="close-btn" onClick={() => setShowTripmateModal(false)}>X</button>
                </div>
                <div className="field">
                  <label>Name</label>
                  <input
                    className="input"
                    type="text"
                    value={newCollaborator}
                    onChange={(e) => setNewCollaborator(e.target.value)}
                    placeholder="Enter name"
                  />
                </div>
                <div className="modal-actions">
                  <button className="ghost-btn" onClick={() => setShowTripmateModal(false)}>
                    Cancel
                  </button>
                  <button className="primary-btn" onClick={() => {
                    const added = handleAddCollaborator();
                    if (added) setShowTripmateModal(false);
                  }}>
                    Add
                  </button>
                </div>
              </>
            )}

            {showBalancesModal && (
              <>
                <div className="modal-header">
                  <h3 className="modal-title">Total Balances</h3>
                  <button className="close-btn" onClick={() => setShowBalancesModal(false)}>X</button>
                </div>
                <div className="expense-list">
                  {collaborators.map((name) => (
                    <div key={name} className="expense-card">
                      <div className="expense-cat">{name}</div>
                      <div className="expense-amt">
                        {currency} {Math.abs(balances[name] || 0).toLocaleString()} {balances[name] >= 0 ? "owed to them" : "they owe"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
