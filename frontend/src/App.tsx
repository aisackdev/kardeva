import { useEffect, useState, useRef } from "react";
import type { Transaction, ChartData, ThirdParty, Card } from "./types";
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
  // --- NEW: AUTHENTICATION STATES ---
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("kardeva_token"),
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartRange, setChartRange] = useState<number | "ALL">("ALL");
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

  const getCurrentMonth = () => {
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localNow.toISOString().substring(0, 7); // Extracts "YYYY-MM"
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());

  const selectedMonthRef = useRef(selectedMonth);
  useEffect(() => {
    selectedMonthRef.current = selectedMonth;
  }, [selectedMonth]);

  const [cardsList, setCardsList] = useState<Card[]>([]);
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [cardName, setCardName] = useState<string>("");
  const [cardLastFour, setCardLastFour] = useState<string>("");
  const [cardType, setCardType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [cardCutoff, setCardCutoff] = useState<string>("");
  const [cardNetwork, setCardNetwork] = useState<string>("VISA");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) return savedTheme === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // --- NEW: AUTHENTICATION FUNCTIONS ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("kardeva_token", data.token);
        setToken(data.token);
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (err) {
      setLoginError("Could not connect to server");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("kardeva_token");
    setToken(null);
  };

  // Helper function to inject the Token into every fetch request
  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`, // Pass the token!
      ...options.headers,
    };

    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      // If token is invalid, log out the user
      handleLogout();
      throw new Error("Unauthorized");
    }
    return response;
  };

  // --- API FETCHING (UPDATED TO USE fetchWithAuth) ---
  const fetchChartData = () => {
    fetchWithAuth(`/api/transactions/chart?month=${selectedMonthRef.current}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.chartData) {
          const [year, month] = selectedMonth.split("-");
          const daysInMonth = new Date(
            Number(year),
            Number(month),
            0,
          ).getDate();

          const fullMonthData = Array.from({ length: daysInMonth }, (_, i) => {
            const dayString = `${year}-${month}-${String(i + 1).padStart(2, "0")}`;
            const foundData = data.chartData.find(
              (d: ChartData) => d.day === dayString,
            );
            return {
              day: dayString,
              total: foundData ? foundData.total : 0,
            };
          });
          setChartData(fullMonthData);
        }
      })
      .catch((error) => console.error("Error fetching chart data:", error));
  };

  const fetchTransactions = () => {
    fetchWithAuth(`/api/transactions?month=${selectedMonthRef.current}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.transactions) setTransactions(data.transactions);
      });
  };

  const fetchSummary = () => {
    fetchWithAuth(`/api/transactions/summary?month=${selectedMonthRef.current}`)
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
    fetchWithAuth(
      `/api/transactions/fixed-expenses?month=${selectedMonthRef.current}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.fixedExpenses) setFixedExpensesList(data.fixedExpenses);
      });
  };

  const handleSaveFixedExpense = () => {
    if (!fixedExpenseName.trim() || !fixedExpenseAmount) return;

    if (editingFixedId) {
      fetchWithAuth(`/api/transactions/${editingFixedId}`, {
        method: "PUT",
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
      fetchWithAuth(`/api/transactions`, {
        method: "POST",
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
    fetchWithAuth(`/api/third-parties`)
      .then((res) => res.json())
      .then((data) => {
        if (data.thirdParties) setThirdParties(data.thirdParties);
      });
  };

  const fetchIncomes = () => {
    fetchWithAuth(`/api/transactions/incomes?month=${selectedMonthRef.current}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.incomes) setIncomesList(data.incomes);
      });
  };

  const fetchCards = () => {
    fetchWithAuth(`/api/cards`)
      .then((res) => res.json())
      .then((data) => {
        if (data.cards) setCardsList(data.cards);
      });
  };

  const handleSaveCard = () => {
    if (!cardName.trim() || !cardLastFour.trim() || !cardNetwork) return;

    // If credit, it MUST have a cutoff day.
    const finalCutoff = cardType === "DEBIT" ? null : Number(cardCutoff);
    if (cardType === "CREDIT" && !finalCutoff) {
      alert("Credit cards must have a cutoff day.");
      return;
    }

    const payload = {
      name: cardName,
      last_four: cardLastFour,
      type: cardType,
      cutoff_day: finalCutoff,
      network: cardNetwork, // <-- Send network
    };

    if (editingCardId) {
      fetchWithAuth(`/api/cards/${editingCardId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) alert(data.error);
          else resetCardForm();
        });
    } else {
      fetchWithAuth(`/api/cards`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) alert(data.error);
          else resetCardForm();
        });
    }
  };

  const resetCardForm = () => {
    setCardName("");
    setCardLastFour("");
    setCardType("CREDIT");
    setCardCutoff("");
    setCardNetwork("VISA"); // <-- Reset
    setEditingCardId(null);
    fetchCards();
  };

  const handleDeleteCard = (id: string) => {
    if (!confirm("Delete this card?")) return;
    fetchWithAuth(`/api/cards/${id}`, { method: "DELETE" }).then(() =>
      fetchCards(),
    );
  };

  // FIRST EFFECT: Data that depends on month (Only runs if authenticated)
  useEffect(() => {
    if (!token) return;
    fetchTransactions();
    fetchSummary();
    fetchChartData();
    fetchIncomes();
    fetchFixedExpenses();
  }, [selectedMonth, token]);

  // SECOND EFFECT: Static data and SSE Connection (Only runs if authenticated)
  useEffect(() => {
    if (!token) return;
    const apiUrl = import.meta.env.VITE_API_URL;

    fetchThirdParties();
    fetchCards();

    // Attach token to URL so the backend middleware can read it
    const eventSource = new EventSource(`${apiUrl}/api/stream?token=${token}`);

    const updateAll = () => {
      fetchTransactions();
      fetchSummary();
      fetchChartData();
      fetchIncomes();
      fetchFixedExpenses();
      fetchCards();
    };

    eventSource.addEventListener("new_transaction", updateAll);
    eventSource.addEventListener("transaction_updated", updateAll);
    eventSource.addEventListener("transaction_deleted", updateAll);

    return () => {
      eventSource.close();
    };
  }, [token]);

  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    fetchWithAuth(`/api/third-parties`, {
      method: "POST",
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
    fetchWithAuth(`/api/third-parties/${id}`, {
      method: "PUT",
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
    fetchWithAuth(`/api/third-parties/${id}`, { method: "DELETE" }).then(() => {
      fetchThirdParties();
      fetchTransactions();
      fetchSummary();
    });
  };

  const handleSaveRecentTx = () => {
    if (!selectedTx || !editTxMerchant.trim()) return;
    if (editTxCategory === "THIRD_PARTY" && !editTxPersonId) {
      alert("Please select a person.");
      return;
    }

    fetchWithAuth(`/api/transactions/${selectedTx.id}/edit`, {
      method: "PATCH",
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

    if (editingIncomeId) {
      fetchWithAuth(`/api/transactions/${editingIncomeId}`, {
        method: "PUT",
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
      fetchWithAuth(`/api/transactions`, {
        method: "POST",
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
    fetchWithAuth(`/api/transactions/${id}`, { method: "DELETE" }).then(() =>
      fetchIncomes(),
    );
  };

  const formatCurrency = (amount: number) =>
    amount.toLocaleString("es-CR", { maximumFractionDigits: 0 });

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const datePart = dateString.split("T")[0] || "";
    const dateElements = datePart.split("-");
    const year = Number(dateElements[0] || 0);
    const month = Number(dateElements[1] || 0);
    const day = Number(dateElements[2] || 0);
    if (!year || !month || !day) return "Invalid Date";
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString();
  };

  const cleanLocation = (loc: string) =>
    loc ? loc.replace(/^[\s,]+/, "").trim() : "Unknown";

  const displayedChartData =
    chartRange === "ALL" ? chartData : chartData.slice(-chartRange);

  // --- RENDER 1: LOGIN SCREEN ---
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
        <div className="absolute top-6 right-6">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-indigo-900 dark:text-yellow-400 text-3xl">
              {isDarkMode ? "light_mode" : "dark_mode"}
            </span>
          </button>
        </div>
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 dark:border-gray-800">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white">
              Kardeva
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              Secure Financial Dashboard
            </p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
            {loginError && (
              <p className="text-red-500 text-xs font-bold text-center">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg mt-4 transition-colors shadow-md"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER 2: MAIN DASHBOARD ---
  return (
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
          {/* Cards, Month Picker, Dark/Light Mode Switcher and Logout */}
          <div className="flex items-center gap-4">
            {/* Custom Native Month Picker with Google Icon */}
            <div
              className="relative flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-95"
              onClick={(e) => {
                try {
                  const input = e.currentTarget.querySelector("input");
                  if (input) {
                    input.showPicker();
                  }
                } catch (err) {}
              }}
            >
              <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 mr-2 text-[20px] pointer-events-none">
                calendar_month
              </span>

              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);

                  e.target.blur();
                }}
                className="bg-transparent text-gray-700 dark:text-gray-200 font-bold outline-none cursor-pointer w-full appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>

            {/* Credit Card manager */}
            <button
              onClick={() => setIsCardModalOpen(true)}
              className="p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-center text-gray-600 dark:text-gray-300"
              title="Manage Cards"
            >
              <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-3xl">
                credit_card
              </span>
            </button>

            {/* Dark/Light Mode Switcher */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-yellow-900/30 transition-colors flex items-center justify-center"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <span className="material-symbols-outlined text-yellow-400 text-3xl">
                  light_mode
                </span>
              ) : (
                <span className="material-symbols-outlined text-indigo-600 text-3xl">
                  dark_mode
                </span>
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors flex items-center justify-center"
              title="Logout"
            >
              <span className="material-symbols-outlined text-2xl">logout</span>
            </button>
          </div>
        </header>

        {/* Chart Section */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6 transition-colors duration-300">
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-2">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">
              Expenses Overview
            </h2>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button
                onClick={() => setChartRange(7)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${chartRange === 7 ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
              >
                7D
              </button>
              <button
                onClick={() => setChartRange(14)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${chartRange === 14 ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
              >
                14D
              </button>
              <button
                onClick={() => setChartRange(21)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${chartRange === 21 ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
              >
                21D
              </button>
              <button
                onClick={() => setChartRange("ALL")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${chartRange === "ALL" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
              >
                ALL
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayedChartData}>
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
                  tickFormatter={(val) => val.split("-")[2]}
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
                  labelFormatter={(label) => formatDate(label)}
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
            className="bg-green-50 dark:bg-green-950/30 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-green-900 flex flex-col cursor-pointer hover:ring-2 hover:ring-green-400 transition-all group"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold">
                Total Incomes
              </span>
              <span className="text-[10px] text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Manage ⚙️
              </span>
            </div>
            <span className="text-xl font-extrabold text-green-600 dark:text-green-400">
              + ₡{formatCurrency(baseIncome + extraIncome)}
            </span>
            <span className="text-[10px] text-gray-500 mt-1">
              Base: ₡{formatCurrency(baseIncome)} | Extra: ₡
              {formatCurrency(extraIncome)}
            </span>
          </div>

          <div
            onClick={() => {
              fetchFixedExpenses();
              setIsFixedModalOpen(true);
            }}
            className="bg-red-50 dark:bg-red-950/30 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-red-900 flex flex-col cursor-pointer hover:ring-2 hover:ring-red-400 transition-all group"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold">
                My Expenses
              </span>
              <span className="text-[10px] text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Manage ⚙️
              </span>
            </div>
            <span className="text-xl font-extrabold text-red-600 dark:text-red-400">
              - ₡{formatCurrency(personalExpenses + fixedExpenses)}
            </span>
            <span className="text-[10px] text-gray-500 mt-1">
              Fixed: ₡{formatCurrency(fixedExpenses)} | Var: ₡
              {formatCurrency(personalExpenses)}
            </span>
          </div>

          <div
            onClick={() => setIsModalOpen(true)}
            className="bg-orange-50 dark:bg-orange-950/30 p-5 rounded-xl shadow-sm border border-orange-100 dark:border-orange-800 flex flex-col cursor-pointer hover:ring-2 hover:ring-orange-400 transition-all group"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold">
                Lent to Others
              </span>
              <span className="text-[10px] text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Manage ⚙️
              </span>
            </div>
            <span className="text-xl font-extrabold text-orange-600 dark:text-orange-400">
              - ₡{formatCurrency(thirdPartyExpenses)}
            </span>
            <span className="text-[10px] text-gray-500 mt-1">
              People: {thirdParties.length}
            </span>
          </div>

          <div className="bg-gray-950 dark:bg-gray-900 p-5 rounded-xl shadow-md border border-gray-800 dark:border-gray-800 flex flex-col">
            <span className="text-gray-400 dark:text-gray-400 text-xs font-semibold mb-1">
              Available Balance
            </span>
            <span className="text-xl font-extrabold text-white dark:text-white">
              = ₡{formatCurrency(availableBalance)}
            </span>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mt-6 transition-colors duration-300">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">
              Monthly Transactions
            </h2>
            <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">
              {transactions.length}
            </span>
          </div>

          <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[400px] overflow-y-auto custom-scrollbar">
            {transactions.length === 0 ? (
              <li className="p-6 text-center text-gray-400">
                No transactions found for this month.
              </li>
            ) : (
              transactions.map((tx) => (
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
                      className="flex items-center justify-center gap-1 text-[10px] px-3 py-1.5 rounded transition-colors font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 uppercase tracking-wider"
                    >
                      {tx.is_third_party ? (
                        `FOR: ${tx.third_party_name}`
                      ) : (
                        <>
                          <span className="material-symbols-outlined !text-[14px]">
                            edit
                          </span>
                          EDIT
                        </>
                      )}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* --- ALL MODALS --- */}

      {/* Third Parties Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span className="material-symbols-outlined">group</span> Manage
                People
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
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold"
                        >
                          <span className="material-symbols-outlined !text-[14px]">
                            edit
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePerson(person.id)}
                        className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold"
                      >
                        <span className="material-symbols-outlined !text-[14px]">
                          delete
                        </span>
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
              {/* Conditional Select for Third Parties */}
              {editTxCategory === "THIRD_PARTY" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1 block">
                    Select Person
                  </label>
                  <select
                    value={editTxPersonId}
                    onChange={(e) => setEditTxPersonId(e.target.value)}
                    className="border border-orange-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-orange-500 bg-orange-50 dark:bg-gray-800 text-gray-800 dark:text-white"
                  >
                    <option value="" disabled className="dark:bg-gray-800">
                      -- Choose a person --
                    </option>
                    {thirdParties.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        className="dark:bg-gray-800"
                      >
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {thirdParties.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Please add people in "Manage People" first.
                    </p>
                  )}
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
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span className="material-symbols-outlined">payments</span>{" "}
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
                  className="w-1/2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all [color-scheme:light] dark:[color-scheme:dark] cursor-pointer"
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
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                        {formatDate(inc.date)}
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
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold"
                      >
                        <span className="material-symbols-outlined !text-[14px]">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteIncome(inc.id)}
                        className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold"
                      >
                        <span className="material-symbols-outlined !text-[14px]">
                          delete
                        </span>
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
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span className="material-symbols-outlined">receipt_long</span>{" "}
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
                  className="w-1/2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all [color-scheme:light] dark:[color-scheme:dark] cursor-pointer"
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
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                        {formatDate(exp.date)}
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
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold"
                      >
                        <span className="material-symbols-outlined !text-[14px]">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this fixed expense?")) {
                            fetchWithAuth(`/api/transactions/${exp.id}`, {
                              method: "DELETE",
                            }).then(() => fetchFixedExpenses());
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold"
                      >
                        <span className="material-symbols-outlined !text-[14px]">
                          delete
                        </span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW MODAL: MANAGE CARDS --- */}
      {isCardModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span className="material-symbols-outlined">credit_card</span>{" "}
                Manage Cards
              </h2>
              <button
                onClick={() => {
                  setIsCardModalOpen(false);
                  resetCardForm();
                }}
                className="text-gray-400 hover:text-red-500 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form Section */}
            <div className="p-5 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Card Name (e.g. BAC Millas)"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-1/2 outline-none focus:border-indigo-500"
                />

                {/* NEW: Network Selector */}
                <select
                  value={cardNetwork}
                  onChange={(e) => setCardNetwork(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-1/4 outline-none focus:border-indigo-500"
                >
                  <option value="VISA">VISA</option>
                  <option value="MASTERCARD">Mastercard</option>
                  <option value="AMEX">Amex</option>
                  <option value="DISCOVER">Discover</option>
                </select>

                <input
                  type="text"
                  placeholder="Last 4 (e.g. 1234)"
                  maxLength={4}
                  value={cardLastFour}
                  onChange={(e) => setCardLastFour(e.target.value)}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-1/4 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={cardType}
                  onChange={(e) => {
                    setCardType(e.target.value as "CREDIT" | "DEBIT");
                    if (e.target.value === "DEBIT") setCardCutoff("");
                  }}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm w-1/3 outline-none focus:border-indigo-500"
                >
                  <option value="CREDIT">Credit</option>
                  <option value="DEBIT">Debit</option>
                </select>

                {/* UPGRADED: Cutoff Day uses a clean 1-31 dropdown, disabled if DEBIT */}
                <select
                  value={cardCutoff}
                  onChange={(e) => setCardCutoff(e.target.value)}
                  disabled={cardType === "DEBIT"}
                  className={`border rounded-lg px-3 py-2 text-sm w-1/3 outline-none focus:border-indigo-500 ${cardType === "DEBIT" ? "bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 cursor-not-allowed" : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white"}`}
                >
                  <option value="" disabled>
                    {cardType === "DEBIT" ? "No Cutoff" : "Cutoff Day"}
                  </option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleSaveCard}
                  className="w-1/3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                >
                  {editingCardId ? "Save" : "Add Card"}
                </button>
              </div>
            </div>

            {/* List Section */}
            <div className="p-5 overflow-y-auto flex-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Your Cards
              </h3>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {cardsList.map((card) => (
                  <li
                    key={card.id}
                    className="py-3 flex justify-between items-center"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 dark:text-gray-200">
                          {card.name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${card.type === "CREDIT" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}
                        >
                          {card.type}
                        </span>
                        {/* NEW: Network Badge */}
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                          {card.network}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                        **** {card.last_four}{" "}
                        {card.cutoff_day
                          ? `• Cutoff: Day ${card.cutoff_day}`
                          : "• Immediate"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingCardId(card.id);
                          setCardName(card.name);
                          setCardLastFour(card.last_four);
                          setCardType(card.type as "CREDIT" | "DEBIT");
                          setCardCutoff(
                            card.cutoff_day ? card.cutoff_day.toString() : "",
                          );
                          setCardNetwork(card.network);
                        }}
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold"
                      >
                        <span className="material-symbols-outlined !text-[14px]">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold"
                      >
                        <span className="material-symbols-outlined !text-[14px]">
                          delete
                        </span>
                      </button>
                    </div>
                  </li>
                ))}
                {cardsList.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No cards registered yet.
                  </p>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
