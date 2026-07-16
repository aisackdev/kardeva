import { useEffect, useState } from "react";
import type { Transaction, ChartData, ThirdParty } from "./types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [personalExpenses, setPersonalExpenses] = useState<number>(0);
  const [thirdPartyExpenses, setThirdPartyExpenses] = useState<number>(0);
  const [fixedExpenses, setFixedExpenses] = useState<number>(0);

  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newPersonName, setNewPersonName] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");

  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTxMerchant, setEditTxMerchant] = useState<string>("");
  const [editTxCategory, setEditTxCategory] = useState<
    "PERSONAL" | "FIXED" | "THIRD_PARTY"
  >("PERSONAL");
  const [editTxPersonId, setEditTxPersonId] = useState<string>("");

  const [incomeSource, setIncomeSource] = useState<string>("");
  const [incomeAmount, setIncomeAmount] = useState<string>("");

  const [baseIncome, setBaseIncome] = useState<number>(0);
  const [extraIncome, setExtraIncome] = useState<number>(0);
  const availableBalance =
    baseIncome +
    extraIncome -
    personalExpenses -
    thirdPartyExpenses -
    fixedExpenses;

  const [incomesList, setIncomesList] = useState<Transaction[]>([]);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState<boolean>(false);
  const [isBaseIncome, setIsBaseIncome] = useState<boolean>(true);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);

  const getTodayDate = () => {
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localNow.toISOString().split("T")[0];
  };
  const [incomeDate, setIncomeDate] = useState<string>(getTodayDate());

  const [fixedExpensesList, setFixedExpensesList] = useState<Transaction[]>([]);
  const [isFixedModalOpen, setIsFixedModalOpen] = useState<boolean>(false);
  const [fixedExpenseName, setFixedExpenseName] = useState<string>("");
  const [fixedExpenseAmount, setFixedExpenseAmount] = useState<string>("");
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [fixedExpenseDate, setFixedExpenseDate] =
    useState<string>(getTodayDate());

  // --- NEW: DARK MODE LOGIC ---
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check if user has a preference saved in their browser
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) return savedTheme === "dark";
      // If no preference, check system settings
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    // Apply the class to the root <html> element based on state
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);
  // ----------------------------

  // --- API FETCHING ---
  const fetchChartData = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/chart`)
      .then((res) => res.json())
      .then((data) => {
        if (data.chartData) setChartData(data.chartData);
      });
  };

  const fetchTransactions = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions`)
      .then((res) => res.json())
      .then((data) => {
        if (data.transactions) setTransactions(data.transactions);
      });
  };

  const fetchSummary = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/summary`)
      .then((res) => res.json())
      .then((data) => {
        if (data.personalExpenses !== undefined) {
          setPersonalExpenses(data.personalExpenses);
          setFixedExpenses(data.fixedExpenses);
          setThirdPartyExpenses(data.thirdPartyExpenses);
          setBaseIncome(data.baseIncome);
          setExtraIncome(data.extraIncome);
        }
      });
  };

  const fetchFixedExpenses = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/fixed-expenses`)
      .then((res) => res.json())
      .then((data) => {
        if (data.fixedExpenses) setFixedExpensesList(data.fixedExpenses);
      });
  };

  const handleSaveFixedExpense = () => {
    if (!fixedExpenseName.trim() || !fixedExpenseAmount) return;
    const apiUrl = import.meta.env.VITE_API_URL;

    if (editingFixedId) {
      fetch(`${apiUrl}/api/transactions/${editingFixedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: fixedExpenseName,
          amount: Number(fixedExpenseAmount),
          is_base: true,
          date: fixedExpenseDate,
        }),
      }).then(() => resetFixedForm());
    } else {
      const newFixed = {
        merchant: fixedExpenseName,
        location: "Auto-Pay",
        date: fixedExpenseDate,
        card_type: "DIRECT",
        auth_code: `FIX-${Math.floor(Math.random() * 1000000)}`,
        amount: Number(fixedExpenseAmount),
        is_third_party: false,
        type: "EXPENSE",
        is_base: true,
      };
      fetch(`${apiUrl}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFixed),
      }).then(() => resetFixedForm());
    }
  };

  const resetFixedForm = () => {
    setFixedExpenseName("");
    setFixedExpenseAmount("");
    setEditingFixedId(null);
    setFixedExpenseDate(getTodayDate());
    fetchFixedExpenses();
  };

  const fetchThirdParties = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/third-parties`)
      .then((res) => res.json())
      .then((data) => {
        if (data.thirdParties) setThirdParties(data.thirdParties);
      });
  };

  const fetchIncomes = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/incomes`)
      .then((res) => res.json())
      .then((data) => {
        if (data.incomes) setIncomesList(data.incomes);
      });
  };

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetchTransactions();
    fetchSummary();
    fetchChartData();
    fetchThirdParties();
    fetchIncomes();
    fetchFixedExpenses();

    const eventSource = new EventSource(`${apiUrl}/api/stream`);

    const updateAll = () => {
      fetchTransactions();
      fetchSummary();
      fetchChartData();
      fetchIncomes();
      fetchFixedExpenses();
    };

    eventSource.addEventListener("new_transaction", updateAll);
    eventSource.addEventListener("transaction_updated", updateAll);
    eventSource.addEventListener("transaction_deleted", updateAll);

    return () => {
      eventSource.close();
    };
  }, []);

  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/third-parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPersonName }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) alert(data.error);
        else {
          setNewPersonName("");
          fetchThirdParties();
        }
      });
  };

  const handleUpdatePerson = (id: string) => {
    if (!editName.trim()) return;
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/third-parties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) alert(data.error);
        else {
          setEditingId(null);
          fetchThirdParties();
          fetchTransactions();
        }
      });
  };

  const handleDeletePerson = (id: string) => {
    if (
      !confirm(
        "Are you sure? Their transactions will become personal expenses.",
      )
    )
      return;
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/third-parties/${id}`, { method: "DELETE" }).then(
      () => {
        fetchThirdParties();
        fetchTransactions();
        fetchSummary();
      },
    );
  };

  const handleSaveRecentTx = () => {
    if (!selectedTx || !editTxMerchant.trim()) return;
    if (editTxCategory === "THIRD_PARTY" && !editTxPersonId) {
      alert("Please select a person.");
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL;

    fetch(`${apiUrl}/api/transactions/${selectedTx.id}/edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant: editTxMerchant,
        is_base: editTxCategory === "FIXED",
        is_third_party: editTxCategory === "THIRD_PARTY",
        third_party_id:
          editTxCategory === "THIRD_PARTY" ? editTxPersonId : null,
      }),
    }).then(() => {
      setEditModalOpen(false);
      setSelectedTx(null);
    });
  };

  const handleSaveIncome = () => {
    if (!incomeSource.trim() || !incomeAmount) return;
    const apiUrl = import.meta.env.VITE_API_URL;

    if (editingIncomeId) {
      fetch(`${apiUrl}/api/transactions/${editingIncomeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: incomeSource,
          amount: Number(incomeAmount),
          is_base: isBaseIncome,
          date: incomeDate,
        }),
      }).then(() => resetIncomeForm());
    } else {
      const newIncome = {
        merchant: incomeSource,
        location: "Direct",
        date: incomeDate,
        card_type: "TRANSFER",
        auth_code: `INC-${Math.floor(Math.random() * 1000000)}`,
        amount: Number(incomeAmount),
        is_third_party: false,
        type: "INCOME",
        is_base: isBaseIncome,
      };
      fetch(`${apiUrl}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIncome),
      }).then(() => resetIncomeForm());
    }
  };

  const resetIncomeForm = () => {
    setIncomeSource("");
    setIncomeAmount("");
    setIsBaseIncome(true);
    setEditingIncomeId(null);
    setIncomeDate(getTodayDate());
    fetchIncomes();
  };

  const handleDeleteIncome = (id: string) => {
    if (!confirm("Delete this income?")) return;
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/${id}`, { method: "DELETE" }).then(() =>
      fetchIncomes(),
    );
  };

  const formatCurrency = (amount: number) =>
    amount.toLocaleString("es-CR", { maximumFractionDigits: 0 });
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("T")[0].split("-");
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    return localDate.toLocaleDateString();
  };
  const cleanLocation = (loc: string) =>
    loc ? loc.replace(/^[\s,]+/, "").trim() : "Unknown";

  return (
    // Added dark mode transitions to the main wrapper
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 flex flex-col items-center relative transition-colors duration-300">
      <div className="w-full max-w-4xl">
        {/* Header Section */}
        <header className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center border border-gray-100 dark:border-gray-800 transition-colors duration-300 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white">
              Kardeva
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
              Financial Dashboard
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
              title="Toggle Dark Mode"
            >
              {/* USE GOOGLE ICONS: Note the class 'material-symbols-outlined' */}
              {isDarkMode ? (
                <span className="material-symbols-outlined text-yellow-400 text-3xl">
                  light_mode
                </span>
              ) : (
                <span className="material-symbols-outlined text-indigo-900 text-3xl">
                  dark_mode
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Chart Section */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6 transition-colors duration-300">
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-4">
            Expenses Last 7 Days
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                {/* Chart grid adjusts to dark mode */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDarkMode ? "#374151" : "#f3f4f6"}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  tickFormatter={(value) => `₡${value / 1000}k`}
                />
                <Tooltip
                  cursor={{ fill: isDarkMode ? "#1f2937" : "#f3f4f6" }}
                  contentStyle={{
                    backgroundColor: isDarkMode ? "#111827" : "#fff",
                    borderColor: isDarkMode ? "#374151" : "#e5e7eb",
                    color: isDarkMode ? "#fff" : "#000",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any) => [
                    `₡${formatCurrency(Number(value))}`,
                    "Total",
                  ]}
                />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div
            onClick={() => {
              fetchIncomes();
              setIsIncomeModalOpen(true);
            }}
            className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col cursor-pointer hover:ring-2 hover:ring-green-400 transition-all group"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold">
                Total Incomes
              </span>
              <span className="text-[10px] text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Edit ⚙️
              </span>
            </div>
            <span className="text-xl font-extrabold text-green-600 dark:text-green-400">
              + ₡{formatCurrency(baseIncome + extraIncome)}
            </span>
            <span className="text-[10px] text-gray-400 mt-1">
              Base: ₡{formatCurrency(baseIncome)} | Extra: ₡
              {formatCurrency(extraIncome)}
            </span>
          </div>

          <div
            onClick={() => {
              fetchFixedExpenses();
              setIsFixedModalOpen(true);
            }}
            className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col cursor-pointer hover:ring-2 hover:ring-red-400 transition-all group"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold">
                My Expenses
              </span>
              <span className="text-[10px] text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Manage Fixed ⚙️
              </span>
            </div>
            <span className="text-xl font-extrabold text-red-600 dark:text-red-400">
              - ₡{formatCurrency(personalExpenses + fixedExpenses)}
            </span>
            <span className="text-[10px] text-gray-400 mt-1">
              Fixed: ₡{formatCurrency(fixedExpenses)} | Var: ₡
              {formatCurrency(personalExpenses)}
            </span>
          </div>

          <div
            onClick={() => setIsModalOpen(true)}
            className="bg-orange-50 dark:bg-orange-950/30 p-5 rounded-xl shadow-sm border border-orange-100 dark:border-orange-900 flex flex-col cursor-pointer hover:ring-2 hover:ring-orange-400 transition-all group"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-orange-700 dark:text-orange-500 text-xs font-semibold">
                Lent to Others
              </span>
              <span className="text-[10px] text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Manage ⚙️
              </span>
            </div>
            <span className="text-xl font-extrabold text-orange-600 dark:text-orange-400">
              - ₡{formatCurrency(thirdPartyExpenses)}
            </span>
            <span className="text-[10px] text-orange-400 mt-1">
              People: {thirdParties.length}
            </span>
          </div>

          <div className="bg-gray-900 dark:bg-indigo-950/50 p-5 rounded-xl shadow-md border border-gray-800 dark:border-indigo-900 flex flex-col">
            <span className="text-gray-400 dark:text-indigo-300 text-xs font-semibold mb-1">
              Available Balance
            </span>
            <span className="text-xl font-extrabold text-white dark:text-indigo-100">
              = ₡{formatCurrency(availableBalance)}
            </span>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mt-6 transition-colors duration-300">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">
              Recent Transactions
            </h2>
          </div>

          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex justify-between items-center"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {tx.merchant}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 mt-1">
                    {formatDate(tx.date)} • {cleanLocation(tx.location)} •{" "}
                    {tx.card_type}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`font-bold ${tx.is_third_party ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    - ₡{formatCurrency(Number(tx.amount))}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedTx(tx);
                      setEditTxMerchant(tx.merchant);
                      if (tx.is_third_party) {
                        setEditTxCategory("THIRD_PARTY");
                        setEditTxPersonId(tx.third_party_id || "");
                      } else if (tx.is_base) {
                        setEditTxCategory("FIXED");
                        setEditTxPersonId("");
                      } else {
                        setEditTxCategory("PERSONAL");
                        setEditTxPersonId("");
                      }
                      setEditModalOpen(true);
                    }}
                    // 1. ADDED: flex items-center justify-center gap-1
                    className="flex items-center justify-center gap-1 text-[10px] px-3 py-1.5 rounded transition-colors font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 uppercase tracking-wider"
                  >
                    {tx.is_third_party ? (
                      `FOR: ${tx.third_party_name}`
                    ) : (
                      <>
                        {/* 2. FIXED: Removed the stray '}' and adjusted the size to 14px so it matches the 10px text */}
                        <span className="material-symbols-outlined !text-[14px]">
                          edit
                        </span>
                        EDIT
                      </>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* --- ALL MODALS WITH DARK MODE --- */}

      {/* Third Parties Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                Manage People
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                  setNewPersonName("");
                }}
                className="text-gray-400 hover:text-red-500 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New person's name..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleAddPerson}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Registered People
              </h3>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {thirdParties.map((person) => (
                  <li
                    key={person.id}
                    className="py-3 flex justify-between items-center"
                  >
                    {editingId === person.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-800 text-white rounded px-2 py-1 text-sm outline-none w-1/2"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {person.name}
                      </span>
                    )}
                    <div className="flex gap-2">
                      {editingId === person.id ? (
                        <button
                          onClick={() => handleUpdatePerson(person.id)}
                          className="text-xs text-white bg-green-500 px-3 py-1.5 rounded font-semibold"
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(person.id);
                            setEditName(person.name);
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePerson(person.id)}
                        className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
                {thirdParties.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No people registered yet.
                  </p>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recent Transaction Modal */}
      {editModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                Edit Transaction
              </h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
                  Description / Note
                </label>
                <input
                  type="text"
                  value={editTxMerchant}
                  onChange={(e) => setEditTxMerchant(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-indigo-500 font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block">
                  Category
                </label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      name="tx_category"
                      checked={editTxCategory === "PERSONAL"}
                      onChange={() => setEditTxCategory("PERSONAL")}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Personal (Variable)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      name="tx_category"
                      checked={editTxCategory === "FIXED"}
                      onChange={() => setEditTxCategory("FIXED")}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Fixed Expense (Bills, etc)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      name="tx_category"
                      checked={editTxCategory === "THIRD_PARTY"}
                      onChange={() => setEditTxCategory("THIRD_PARTY")}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Lent to Someone
                    </span>
                  </label>
                </div>
              </div>
              {editTxCategory === "THIRD_PARTY" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1 block">
                    Select Person
                  </label>
                  <select
                    value={editTxPersonId}
                    onChange={(e) => setEditTxPersonId(e.target.value)}
                    className="border border-orange-300 dark:border-orange-700 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-gray-800 dark:text-gray-200"
                  >
                    <option value="" disabled>
                      -- Choose a person --
                    </option>
                    {thirdParties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={handleSaveRecentTx}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg mt-2 transition-colors shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incomes Modal */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                Manage Incomes
              </h2>
              <button
                onClick={() => {
                  setIsIncomeModalOpen(false);
                  resetIncomeForm();
                }}
                className="text-gray-400 hover:text-red-500 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Source (e.g. Salary, Repair)"
                  value={incomeSource}
                  onChange={(e) => setIncomeSource(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-1/2 outline-none focus:border-green-500"
                />
                <input
                  type="number"
                  placeholder="Amount (₡)"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-1/2 outline-none focus:border-green-500"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={incomeDate}
                  onChange={(e) => setIncomeDate(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg px-3 py-2 text-sm w-1/2 outline-none focus:border-green-500"
                />
                <button
                  onClick={handleSaveIncome}
                  className="w-1/2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                >
                  {editingIncomeId ? "Save Changes" : "Add Income"}
                </button>
              </div>
              <label className="flex items-center gap-2 mt-1 cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={isBaseIncome}
                  onChange={(e) => setIsBaseIncome(e.target.checked)}
                  className="w-4 h-4 text-green-600"
                />
                Is this a Base/Fixed Income? (Uncheck for Extras)
              </label>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Registered Incomes
              </h3>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {incomesList.map((inc) => (
                  <li
                    key={inc.id}
                    className="py-3 flex justify-between items-center"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 dark:text-gray-200">
                          {inc.merchant}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${inc.is_base ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
                        >
                          {inc.is_base ? "Base" : "Extra"}
                        </span>
                      </div>
                      <span className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                        + ₡{formatCurrency(Number(inc.amount))}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingIncomeId(inc.id);
                          setIncomeSource(inc.merchant);
                          setIncomeAmount(inc.amount);
                          setIsBaseIncome(inc.is_base);
                          setIncomeDate(inc.date.split("T")[0]);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteIncome(inc.id)}
                        className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Expenses Modal */}
      {isFixedModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                Manage Fixed Expenses
              </h2>
              <button
                onClick={() => {
                  setIsFixedModalOpen(false);
                  resetFixedForm();
                }}
                className="text-gray-400 hover:text-red-500 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Rent, Internet, Water"
                  value={fixedExpenseName}
                  onChange={(e) => setFixedExpenseName(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-1/2 outline-none focus:border-red-500"
                />
                <input
                  type="number"
                  placeholder="Amount (₡)"
                  value={fixedExpenseAmount}
                  onChange={(e) => setFixedExpenseAmount(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-1/2 outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={fixedExpenseDate}
                  onChange={(e) => setFixedExpenseDate(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg px-3 py-2 text-sm w-1/2 outline-none focus:border-red-500"
                />
                <button
                  onClick={handleSaveFixedExpense}
                  className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                >
                  {editingFixedId ? "Save Changes" : "Add Fixed Expense"}
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Registered Fixed Expenses
              </h3>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {fixedExpensesList.map((exp) => (
                  <li
                    key={exp.id}
                    className="py-3 flex justify-between items-center"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 dark:text-gray-200">
                          {exp.merchant}
                        </span>
                        <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                          FIXED
                        </span>
                      </div>
                      <span className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">
                        - ₡{formatCurrency(Number(exp.amount))}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingFixedId(exp.id);
                          setFixedExpenseName(exp.merchant);
                          setFixedExpenseAmount(exp.amount);
                          setFixedExpenseDate(exp.date.split("T")[0]);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this fixed expense?")) {
                            const apiUrl = import.meta.env.VITE_API_URL;
                            fetch(`${apiUrl}/api/transactions/${exp.id}`, {
                              method: "DELETE",
                            });
                          }
                        }}
                        className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
