import { useEffect, useState, useRef, useMemo } from "react";
import type {
  Transaction,
  ChartData,
  ThirdParty,
  Card,
  ConfirmConfig,
} from "./types";
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
  const [editTxNote, setEditTxNote] = useState<string>("");
  const [isEditingMerchant, setIsEditingMerchant] = useState<boolean>(false);
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [editTxCategory, setEditTxCategory] = useState<
    "PERSONAL" | "FIXED" | "THIRD_PARTY" | "LINKED_FIXED"
  >("PERSONAL");
  const [editTxPersonId, setEditTxPersonId] = useState<string>("");
  const [editTxLinkedFixedId, setEditTxLinkedFixedId] = useState<string>("");
  const [isSplitAction, setIsSplitAction] = useState<boolean>(false);
  const [splitAmount, setSplitAmount] = useState<string>("");

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

  // Tasa 0 logic
  const [isTasaCeroAction, setIsTasaCeroAction] = useState<boolean>(false);
  const [tasaCeroMonths, setTasaCeroMonths] = useState<string>("3");

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

  // --- NEW: GLOBAL CONFIRMATION MODAL STATE ---

  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    onConfirm: () => {},
  });

  // Helper function to trigger the modal easily
  const requestConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = "Delete",
  ) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm,
    });
  };

  const closeConfirm = () => {
    setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
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

  const handleCopyPreviousFixed = () => {
    requestConfirm(
      "Copy Fixed Expenses",
      "Do you want to copy all fixed expenses from the previous month into this month?",
      () => {
        fetchWithAuth(
          `/api/transactions/fixed-expenses/copy-previous?month=${selectedMonthRef.current}`,
          { method: "POST" },
        )
          .then((res) => res.json())
          .then((data) => {
            if (data.error) alert(data.error);
            else {
              fetchFixedExpenses();
              fetchSummary();
            }
            closeConfirm();
          })
          .catch((err) => {
            console.error("Error copying fixed expenses:", err);
            closeConfirm();
          });
      },
      "Copy",
    );
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
    requestConfirm(
      "Delete Card",
      "Are you sure you want to delete this card?",
      () => {
        fetchWithAuth(`/api/cards/${id}`, { method: "DELETE" })
          .then(() => {
            fetchCards();
            closeConfirm();
          })
          .catch((error) => {
            console.error("Error deleting person:", error);
            alert("Failed to delete person.");
            closeConfirm();
          });
      },
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
    const person = thirdParties.find((p) => p.id === id);
    const personName = person?.name || "this person";

    requestConfirm(
      "Delete Person",
      `Are you sure you want to delete "${personName}"? All their associated transactions will become personal expenses.`,
      () => {
        fetchWithAuth(`/api/third-parties/${id}`, { method: "DELETE" })
          .then(() => {
            fetchThirdParties();
            fetchTransactions();
            fetchSummary();
            closeConfirm();
          })
          .catch((error) => {
            console.error("Error deleting person:", error);
            alert("Failed to delete person.");
            closeConfirm();
          });
      },
    );
  };

  const handleSaveRecentTx = () => {
    if (!selectedTx || !editTxMerchant.trim()) return;
    if (editTxCategory === "THIRD_PARTY" && !editTxPersonId) {
      alert("Please select a person.");
      return;
    }
    if (editTxCategory === "LINKED_FIXED" && !editTxLinkedFixedId) {
      alert("Please select a fixed expense to cover.");
      return;
    }

    if (isSplitAction) {
      const splitNum = Number(splitAmount);
      if (splitNum <= 0 || splitNum >= Number(selectedTx.amount)) {
        alert("The split amount must be valid and less than the total.");
        return;
      }
    }

    fetchWithAuth(`/api/transactions/${selectedTx.id}/edit`, {
      method: "PATCH",
      body: JSON.stringify({
        merchant: editTxMerchant,
        note: editTxNote,
        is_base: editTxCategory === "FIXED",
        is_third_party: editTxCategory === "THIRD_PARTY",
        third_party_id:
          editTxCategory === "THIRD_PARTY" ? editTxPersonId : null,
        linked_fixed_id:
          editTxCategory === "LINKED_FIXED" ? editTxLinkedFixedId : null,
        is_split_action: isSplitAction,
        split_amount: splitAmount,
        is_tasa_cero_action: isTasaCeroAction,
        tasa_cero_months: Number(tasaCeroMonths),
      }),
    }).then(() => {
      setEditModalOpen(false);
      setSelectedTx(null);
    });
  };

  const handleRevertTasaCero = () => {
    if (!selectedTx) return;
    requestConfirm(
      "Revert Tasa 0",
      "Are you sure? This will delete all future installments and restore the original full amount to this month.",
      () => {
        fetchWithAuth(`/api/transactions/${selectedTx.id}/edit`, {
          method: "PATCH",
          body: JSON.stringify({ revert_tasa_cero_action: true }),
        }).then(() => {
          setEditModalOpen(false);
          closeConfirm();
        });
      },
      "Revert",
    );
  };

  const handleDeleteRecentTx = () => {
    if (!selectedTx) return;

    requestConfirm(
      "Delete Transaction",
      `Are you sure you want to delete "${selectedTx.merchant}"? This action cannot be undone.`,
      () => {
        fetchWithAuth(`/api/transactions/${selectedTx.id}`, {
          method: "DELETE",
        })
          .then(() => {
            setEditModalOpen(false);
            setSelectedTx(null);
            closeConfirm();
          })
          .catch((error) => {
            console.error("Error deleting transaction:", error);
            alert("Failed to delete transaction.");
            closeConfirm();
          });
      },
    );
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
    const incomeList = incomesList.find((e) => e.id === id);
    const currentExpense = incomeList?.merchant || "this income";

    requestConfirm(
      "Delete Fixed Income",
      `Are you sure you want to delete "${currentExpense}"?`,
      () => {
        fetchWithAuth(`/api/transactions/${id}`, { method: "DELETE" })
          .then(() => {
            fetchIncomes();
            closeConfirm();
          })
          .catch((error) => {
            console.error("Error deleting income:", error);
            alert("Failed to delete income.");
            closeConfirm();
          });
      },
    );
  };

  const handleDeleteFixedExpense = (id: string) => {
    const expense = fixedExpensesList.find((f) => f.id === id);
    const expenseName = expense?.merchant || "this fixed expense";

    requestConfirm(
      "Delete Fixed Expense",
      `Are you sure you want to delete "${expenseName}"?`,
      () => {
        fetchWithAuth(`/api/transactions/${id}`, { method: "DELETE" })
          .then(() => {
            fetchFixedExpenses();
            fetchSummary();
            closeConfirm();
          })
          .catch((error) => {
            console.error("Error deleting fixed expense:", error);
            alert("Failed to delete fixed expense.");
            closeConfirm();
          });
      },
    );
  };

  const handleRevertFixedExpense = (id: string) => {
    const expense = fixedExpensesList.find((f) => f.id === id);
    const expenseName = expense?.merchant || "this expense";

    requestConfirm(
      "Revert to Normal Expense",
      `Are you sure you want to remove "${expenseName}" from Fixed Expenses? It will be moved back to your normal transactions list.`,
      () => {
        fetchWithAuth(`/api/transactions/${id}`, { method: "DELETE" })
          .then(() => {
            fetchFixedExpenses();
            fetchTransactions(); // Refresh normal transactions list
            fetchSummary();
            closeConfirm();
          })
          .catch((error) => {
            console.error("Error reverting expense:", error);
            alert("Failed to revert expense.");
            closeConfirm();
          });
      },
      "Revert", // Custom text for the red button
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

  // --- NEW: CHECK IF TRANSACTION WAS MODIFIED ---
  const hasTxChanges = selectedTx
    ? editTxMerchant.trim() !== selectedTx.merchant ||
      editTxNote.trim() !== (selectedTx.note || "") ||
      editTxCategory !==
        (selectedTx.linked_fixed_id
          ? "LINKED_FIXED"
          : selectedTx.is_third_party
            ? "THIRD_PARTY"
            : selectedTx.is_base
              ? "FIXED"
              : "PERSONAL") ||
      (editTxCategory === "THIRD_PARTY" &&
        editTxPersonId !== (selectedTx.third_party_id || "")) ||
      (editTxCategory === "LINKED_FIXED" &&
        editTxLinkedFixedId !== (selectedTx.linked_fixed_id || "")) ||
      isSplitAction ||
      isTasaCeroAction
    : false;

  // --- NEW: MEMOIZED CHART TO PREVENT RE-RENDER LAG ---
  const chartComponent = useMemo(() => {
    return (
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
    );
  }, [displayedChartData, isDarkMode]); // Only re-render if data or theme changes

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

  // --- NEW: TRANSACTION UI HELPERS ---

  const getCategoryEmoji = (merchant: string) => {
    const m = merchant.toLowerCase();
    if (
      m.includes("uber") ||
      m.includes("didi") ||
      m.includes("taxi") ||
      m.includes("peaje")
    )
      return "🚗";
    if (
      m.includes("mcdonald") ||
      m.includes("burger") ||
      m.includes("kfc") ||
      m.includes("pizza") ||
      m.includes("restaurante") ||
      m.includes("soda") ||
      m.includes("starbucks")
    )
      return "🍔";
    if (
      m.includes("gas") ||
      m.includes("delta") ||
      m.includes("uno") ||
      m.includes("servicentro") ||
      m.includes("bomba")
    )
      return "⛽";
    if (
      m.includes("walmart") ||
      m.includes("masxmenos") ||
      m.includes("pali") ||
      m.includes("automercado") ||
      m.includes("super") ||
      m.includes("maxi")
    )
      return "🛒";
    if (
      m.includes("farmacia") ||
      m.includes("fischel") ||
      m.includes("sucre") ||
      m.includes("hospital") ||
      m.includes("clinica")
    )
      return "💊";
    if (
      m.includes("cine") ||
      m.includes("netflix") ||
      m.includes("spotify") ||
      m.includes("hbo") ||
      m.includes("disney") ||
      m.includes("apple")
    )
      return "🍿";
    if (
      m.includes("amazon") ||
      m.includes("epa") ||
      m.includes("ferreteria") ||
      m.includes("tienda")
    )
      return "🛍️";
    if (
      m.includes("sinpe") ||
      m.includes("transferencia") ||
      m.includes("atm") ||
      m.includes("cajero")
    )
      return "🏦";
    if (
      m.includes("recarga") ||
      m.includes("kolbi") ||
      m.includes("claro") ||
      m.includes("liberty")
    )
      return "📱";
    return "💳"; // Default fallback
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const dayMonth = date.toLocaleDateString("es-CR", {
      day: "numeric",
      month: "short",
    });
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dayMonth}, ${time}`;
  };

  const getCardDetails = (tx: Transaction) => {
    // Extract last 4 digits from the webhook string (e.g., "VISA *1234")
    const match = tx.card_type?.match(/\d{4}$/);
    const lastFour = match ? match[0] : null;

    let type = "Card";
    let digits = lastFour ? `**** ${lastFour}` : tx.card_type;

    if (lastFour) {
      // Look up the card in our saved cards list to know if it's Credit or Debit
      const foundCard = cardsList.find((c) => c.last_four === lastFour);
      if (foundCard) {
        type = foundCard.type === "CREDIT" ? "Credit" : "Debit";
      }
    } else if (
      tx.card_type?.toLowerCase().includes("transfer") ||
      tx.card_type?.toLowerCase().includes("sinpe")
    ) {
      type = "Transfer";
      digits = "";
    } else if (tx.card_type === "DIRECT") {
      type = "Cash";
      digits = "";
    }

    return digits ? `${type} | ${digits}` : type;
  };

  // --- RENDER 2: MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 flex flex-col items-center relative transition-colors duration-300">
      <div className="w-full max-w-4xl">
        {/* Header Section */}
        <header className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-xl shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-center border border-gray-100 dark:border-gray-800 transition-colors duration-300 gap-4">
          <div className="text-center sm:text-left w-full sm:w-auto">
            <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white">
              Kardeva
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
              Financial Dashboard
            </p>
          </div>

          {/* Controls Container: Column on mobile, Row on desktop */}
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-4 w-full sm:w-auto">
            {/* Month Picker */}
            <div
              className="relative flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-95 w-full sm:w-auto"
              onClick={(e) => {
                try {
                  const input = e.currentTarget.querySelector("input");
                  if (input) input.showPicker();
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
                className="bg-transparent text-gray-700 dark:text-gray-200 font-bold outline-none cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:hidden text-center"
              />
            </div>

            {/* Action Buttons Group */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setIsCardModalOpen(true)}
                className="p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-center text-gray-600 dark:text-gray-300"
                title="Manage Cards"
              >
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-3xl">
                  credit_card
                </span>
              </button>

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

              <button
                onClick={handleLogout}
                className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors flex items-center justify-center"
                title="Logout"
              >
                <span className="material-symbols-outlined text-2xl">
                  logout
                </span>
              </button>
            </div>
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
            {/* The Chart */}
            <div className="h-64 w-full">{chartComponent}</div>
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
            <span className="text-xl font-extrabold text-green-600 dark:text-green-400 whitespace-nowrap">
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
            <span className="text-xl font-extrabold text-red-600 dark:text-red-400 whitespace-nowrap">
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
            <span className="text-xl font-extrabold text-orange-600 dark:text-orange-400 whitespace-nowrap">
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
            <span className="text-xl font-extrabold text-white dark:text-white whitespace-nowrap">
              {availableBalance >= 0 ? "+" : "-"} ₡
              {formatCurrency(Math.abs(availableBalance))}
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
                  onClick={() => {
                    setSelectedTx(tx);
                    setEditTxMerchant(tx.merchant);
                    setEditTxNote(tx.note || "");
                    setIsEditingMerchant(false);
                    setIsEditingNote(false);
                    setIsSplitAction(false);
                    setSplitAmount("");
                    setIsTasaCeroAction(false);
                    setTasaCeroMonths("3");

                    if (tx.linked_fixed_id) {
                      setEditTxCategory("LINKED_FIXED");
                      setEditTxLinkedFixedId(tx.linked_fixed_id);
                      setEditTxPersonId("");
                    } else if (tx.is_third_party) {
                      setEditTxCategory("THIRD_PARTY");
                      setEditTxPersonId(tx.third_party_id || "");
                      setEditTxLinkedFixedId("");
                    } else if (tx.is_base) {
                      setEditTxCategory("FIXED");
                      setEditTxPersonId("");
                      setEditTxLinkedFixedId("");
                    } else {
                      setEditTxCategory("PERSONAL");
                      setEditTxPersonId("");
                      setEditTxLinkedFixedId("");
                    }
                    setEditModalOpen(true);
                  }}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex justify-between items-center cursor-pointer group"
                >
                  <div className="flex items-center gap-4 min-w-0 py-1">
                    {/* 1. Emoji Icon */}
                    <div className="w-12 h-12 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl shadow-sm border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform">
                      {getCategoryEmoji(tx.merchant)}
                    </div>

                    {/* 2 & 3. Text Info */}
                    <div className="flex flex-col overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-800 dark:text-gray-200 truncate">
                          {tx.merchant}
                        </span>

                        {/* SPLIT BADGE */}
                        {tx.is_split && (
                          <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 border border-gray-200 dark:border-gray-700 shrink-0">
                            <span className="material-symbols-outlined !text-[12px]">
                              content_cut
                            </span>{" "}
                            Split
                          </span>
                        )}

                        {/* TASA 0 BADGE (NEW) */}
                        {tx.is_tasa_cero && (
                          <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 border border-blue-200 dark:border-blue-700 shrink-0">
                            <span className="material-symbols-outlined !text-[12px]">
                              calendar_month
                            </span>{" "}
                            Tasa 0
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {getCardDetails(tx)} | {formatDateTime(tx.date)}
                      </span>
                    </div>
                  </div>

                  {/* 4. Amount & Badges */}
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    <span
                      className={`text-lg font-extrabold whitespace-nowrap ${
                        tx.is_tasa_cero || tx.linked_fixed_id
                          ? "text-gray-400 dark:text-gray-600 line-through"
                          : tx.is_third_party
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      - ₡{formatCurrency(Number(tx.amount))}
                    </span>

                    {/* BADGE: Third Party */}
                    {tx.is_third_party && (
                      <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded">
                        FOR: {tx.third_party_name}
                      </span>
                    )}

                    {/* NEW BADGE: Linked Fixed Expense */}
                    {tx.linked_fixed_id && (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                        <span className="material-symbols-outlined !text-[12px]">
                          link
                        </span>
                        FIXED: {tx.linked_fixed_name || "Covered"}
                      </span>
                    )}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300 animate-scale-up">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300 animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950 shrink-0">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span className="material-symbols-outlined">receipt_long</span>
                Transaction Details
              </h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold transition-colors p-2 text-2xl leading-none flex items-center justify-center"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
              {/* 1. RECEIPT CARD (With Inline Edit for Merchant) */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex justify-between items-start mb-4 gap-3">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center text-2xl shadow-sm border border-gray-100 dark:border-gray-600 shrink-0">
                      {getCategoryEmoji(editTxMerchant)}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      {isEditingMerchant ? (
                        <input
                          type="text"
                          value={editTxMerchant}
                          onChange={(e) => setEditTxMerchant(e.target.value)}
                          onBlur={() => setIsEditingMerchant(false)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && setIsEditingMerchant(false)
                          }
                          autoFocus
                          className="border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded px-2 py-1 text-lg font-extrabold outline-none focus:ring-2 focus:ring-indigo-500/50 w-full mb-1 min-w-0"
                        />
                      ) : (
                        <div
                          className="flex items-start gap-2 group cursor-pointer w-full min-w-0"
                          onClick={() => setIsEditingMerchant(true)}
                          title="Click to edit name"
                        >
                          <h3 className="text-lg font-extrabold text-gray-800 dark:text-gray-100 leading-tight break-words min-w-0 flex-1">
                            {editTxMerchant}
                          </h3>
                          <span className="material-symbols-outlined text-[16px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-200 dark:bg-gray-700 rounded-full p-0.5 shrink-0 mt-0.5">
                            edit
                          </span>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold mt-1">
                        Total Amount
                      </p>
                      <p className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 truncate">
                        ₡{formatCurrency(Number(selectedTx.amount))}
                      </p>
                    </div>
                  </div>
                  {selectedTx.is_split && (
                    <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 shrink-0">
                      <span className="material-symbols-outlined !text-[14px]">
                        content_cut
                      </span>{" "}
                      Split
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm pt-4 border-t border-gray-200 dark:border-gray-700/50">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-0.5">
                      Date & Time
                    </p>
                    <p className="font-medium text-gray-700 dark:text-gray-300 truncate">
                      {formatDateTime(selectedTx.date)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-0.5">
                      Payment Method
                    </p>
                    <p className="font-medium text-gray-700 dark:text-gray-300 truncate">
                      {getCardDetails(selectedTx)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-0.5">
                      Location
                    </p>
                    <p
                      className="font-medium text-gray-700 dark:text-gray-300 truncate pr-2"
                      title={selectedTx.location}
                    >
                      {cleanLocation(selectedTx.location)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-0.5">
                      Auth Code
                    </p>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-900 px-1.5 py-0.5 rounded inline-block truncate max-w-full">
                      {selectedTx.auth_code}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. EDITABLE FORM OR TASA 0 REVERT */}
              {selectedTx.is_tasa_cero ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center animate-fade-in">
                  <span className="material-symbols-outlined text-blue-500 text-4xl mb-2">
                    calendar_month
                  </span>
                  <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">
                    Active Tasa 0
                  </h3>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                    This transaction is currently hidden from your monthly
                    expenses and split into future installments.
                  </p>
                  <button
                    onClick={handleRevertTasaCero}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md"
                  >
                    Revert to Normal Expense
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* NOTES SECTION */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 block uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined !text-[16px]">
                        notes
                      </span>
                      Notes
                    </label>
                    {isEditingNote ? (
                      <div className="animate-fade-in">
                        <textarea
                          value={editTxNote}
                          onChange={(e) => setEditTxNote(e.target.value)}
                          placeholder="Add extra details about this expense..."
                          rows={3}
                          autoFocus
                          onBlur={() => setIsEditingNote(false)}
                          className="border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-lg px-4 py-2.5 text-sm w-full outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium transition-all resize-none custom-scrollbar shadow-sm"
                        />
                      </div>
                    ) : editTxNote ? (
                      <div
                        onClick={() => setIsEditingNote(true)}
                        className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group flex justify-between items-start animate-fade-in"
                        title="Click to edit note"
                      >
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-medium leading-relaxed">
                          {editTxNote}
                        </p>
                        <span className="material-symbols-outlined text-[16px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-900 rounded-full p-1 shadow-sm shrink-0 ml-2">
                          edit
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingNote(true)}
                        className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-2 animate-fade-in"
                      >
                        <span className="material-symbols-outlined !text-[18px]">
                          add
                        </span>
                        Add Note
                      </button>
                    )}
                  </div>

                  {/* CATEGORY SECTION */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block uppercase tracking-wider">
                      Category
                    </label>
                    <div className="flex flex-col gap-2">
                      <label
                        className={`flex items-center gap-3 cursor-pointer p-3 border rounded-lg transition-colors ${editTxCategory === "PERSONAL" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                      >
                        <input
                          type="radio"
                          name="tx_category"
                          checked={editTxCategory === "PERSONAL"}
                          onChange={() => setEditTxCategory("PERSONAL")}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Personal (Variable)
                        </span>
                      </label>

                      {/* NEW OPTION: LINKED FIXED EXPENSE */}
                      <label
                        className={`flex items-center gap-3 cursor-pointer p-3 border rounded-lg transition-colors ${editTxCategory === "LINKED_FIXED" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-500" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                      >
                        <input
                          type="radio"
                          name="tx_category"
                          checked={editTxCategory === "LINKED_FIXED"}
                          onChange={() => setEditTxCategory("LINKED_FIXED")}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Cover an existing Fixed Expense (No duplication)
                        </span>
                      </label>

                      <label
                        className={`flex items-center gap-3 cursor-pointer p-3 border rounded-lg transition-colors ${editTxCategory === "THIRD_PARTY" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                      >
                        <input
                          type="radio"
                          name="tx_category"
                          checked={editTxCategory === "THIRD_PARTY"}
                          onChange={() => setEditTxCategory("THIRD_PARTY")}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Lent to Someone
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* SELECTOR FOR LINKED FIXED EXPENSE */}
                  {editTxCategory === "LINKED_FIXED" && (
                    <div className="animate-fade-in">
                      <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1.5 block uppercase tracking-wider">
                        Select Fixed Expense
                      </label>
                      <select
                        value={editTxLinkedFixedId}
                        onChange={(e) => setEditTxLinkedFixedId(e.target.value)}
                        className="border border-emerald-300 dark:border-emerald-700/50 rounded-lg px-4 py-2.5 text-sm w-full outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20 text-gray-800 dark:text-white font-medium transition-all"
                      >
                        <option value="" disabled className="dark:bg-gray-800">
                          -- Choose a fixed expense --
                        </option>
                        {fixedExpensesList.map((f) => (
                          <option
                            key={f.id}
                            value={f.id}
                            className="dark:bg-gray-800"
                          >
                            {f.merchant} (₡{formatCurrency(Number(f.amount))})
                          </option>
                        ))}
                      </select>
                      {fixedExpensesList.length === 0 && (
                        <p className="text-xs font-bold text-red-500 mt-2">
                          No fixed expenses registered for this month.
                        </p>
                      )}
                    </div>
                  )}

                  {/* THIRD PARTY SELECT & SPLIT */}
                  {editTxCategory === "THIRD_PARTY" && (
                    <div className="animate-fade-in">
                      <label className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1.5 block uppercase tracking-wider">
                        Select Person
                      </label>
                      <select
                        value={editTxPersonId}
                        onChange={(e) => setEditTxPersonId(e.target.value)}
                        className="border border-orange-300 dark:border-orange-700/50 rounded-lg px-4 py-2.5 text-sm w-full outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 bg-orange-50 dark:bg-orange-950/20 text-gray-800 dark:text-white font-medium transition-all"
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

                      {/* The Scissors Tool */}
                      {!selectedTx?.is_split && (
                        <div className="mt-4 p-4 bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-xl">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSplitAction}
                              onChange={(e) => {
                                setIsSplitAction(e.target.checked);
                                if (e.target.checked)
                                  setIsTasaCeroAction(false);
                              }}
                              className="w-4 h-4 text-orange-600 rounded"
                            />
                            <span className="text-sm font-bold text-orange-700 dark:text-orange-500 flex items-center gap-1.5">
                              <span className="material-symbols-outlined !text-[18px]">
                                content_cut
                              </span>
                              Split expense with me
                            </span>
                          </label>

                          {isSplitAction && (
                            <div className="mt-4 ml-7 animate-fade-in">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 block">
                                How much do they owe you? (Max: ₡
                                {formatCurrency(Number(selectedTx.amount))})
                              </label>
                              <input
                                type="number"
                                value={splitAmount}
                                onChange={(e) => setSplitAmount(e.target.value)}
                                placeholder="e.g. 3000"
                                className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-4 py-2 text-sm w-full outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 mb-2 font-medium"
                              />
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 p-2 rounded-md border border-gray-100 dark:border-gray-800">
                                Your personal expense will be:{" "}
                                <span className="font-bold text-red-500 dark:text-red-400">
                                  ₡
                                  {formatCurrency(
                                    Number(selectedTx.amount) -
                                      Number(splitAmount || 0),
                                  )}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {thirdParties.length === 0 && (
                        <p className="text-xs font-bold text-red-500 mt-2 flex items-center gap-1">
                          <span className="material-symbols-outlined !text-[14px]">
                            error
                          </span>
                          Please add people in "Manage People" first.
                        </p>
                      )}
                    </div>
                  )}

                  {/* TASA 0 TOOL */}
                  {!selectedTx?.is_split && (
                    <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isTasaCeroAction}
                          onChange={(e) => {
                            setIsTasaCeroAction(e.target.checked);
                            if (e.target.checked) setIsSplitAction(false); // Mutually exclusive
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-500 flex items-center gap-1.5">
                          <span className="material-symbols-outlined !text-[18px]">
                            calendar_month
                          </span>
                          Convert to Tasa 0
                        </span>
                      </label>

                      {isTasaCeroAction && (
                        <div className="mt-4 ml-7 animate-fade-in">
                          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 block">
                            How many months?
                          </label>
                          <select
                            value={tasaCeroMonths}
                            onChange={(e) => setTasaCeroMonths(e.target.value)}
                            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg px-4 py-2 text-sm w-full outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 mb-2 font-medium"
                          >
                            {[2, 3, 6, 10, 12, 18, 24].map((m) => (
                              <option key={m} value={m}>
                                {m} Months
                              </option>
                            ))}
                          </select>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 p-2 rounded-md border border-gray-100 dark:border-gray-800">
                            Monthly installment:{" "}
                            <span className="font-bold text-blue-500 dark:text-blue-400">
                              ₡
                              {formatCurrency(
                                Number(selectedTx.amount) /
                                  Number(tasaCeroMonths),
                              )}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons (Footer) */}
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 shrink-0 flex gap-3">
              <button
                onClick={handleDeleteRecentTx}
                className="w-1/4 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/50 dark:text-red-400 font-bold py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1"
                title="Delete Transaction"
              >
                <span className="material-symbols-outlined !text-[20px]">
                  delete
                </span>
              </button>
              <button
                onClick={handleSaveRecentTx}
                disabled={!hasTxChanges}
                className={`w-3/4 font-bold py-3 rounded-lg transition-colors shadow-md ${
                  hasTxChanges
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
                }`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incomes Modal */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300 animate-scale-up">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300 animate-scale-up">
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
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Registered Fixed Expenses
                </h3>
                <button
                  onClick={handleCopyPreviousFixed}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-md transition-colors"
                  title="Copy fixed expenses from previous month"
                >
                  <span className="material-symbols-outlined !text-[14px]">
                    content_copy
                  </span>
                  Copy from Prev Month
                </button>
              </div>
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

                      {/* CONDITIONAL BUTTON: Delete (Manual) vs Revert (Bank) */}
                      {exp.auth_code?.startsWith("FIX-") ? (
                        <button
                          onClick={() => handleDeleteFixedExpense(exp.id)}
                          className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold"
                          title="Delete completely"
                        >
                          <span className="material-symbols-outlined !text-[14px]">
                            delete
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRevertFixedExpense(exp.id)}
                          className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded hover:bg-orange-100 dark:hover:bg-orange-900/50 font-semibold"
                          title="Revert to normal transaction"
                        >
                          <span className="material-symbols-outlined !text-[14px]">
                            undo
                          </span>
                        </button>
                      )}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800 transition-colors duration-300 animate-scale-up">
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
                          ? `| Cutoff: Day ${card.cutoff_day}`
                          : "| Immediate"}
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

      {/* --- GLOBAL CONFIRMATION MODAL --- */}
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 animate-scale-up">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-red-600 dark:text-red/-400 text-2xl">
                  warning
                </span>
              </div>
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">
                {confirmConfig.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {confirmConfig.message}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={closeConfirm}
                  className="w-1/2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmConfig.onConfirm}
                  className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-md"
                >
                  {confirmConfig.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
