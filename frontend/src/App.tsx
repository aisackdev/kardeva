// frontend/src/App.tsx
import { useEffect, useState } from "react";
import type {
  DbStatusResponse,
  Transaction,
  ChartData,
  ThirdParty,
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
  const [message, setMessage] = useState<string>("Loading...");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [personalExpenses, setPersonalExpenses] = useState<number>(0);
  const [thirdPartyExpenses, setThirdPartyExpenses] = useState<number>(0);

  // Third Parties & Modal States
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newPersonName, setNewPersonName] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const monthlyIncome = 1000000;
  const availableBalance = monthlyIncome - totalExpenses;

  // --- API FETCHING ---
  const fetchChartData = () => {
    /* same as before */
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/chart`)
      .then((res) => res.json())
      .then((data) => {
        if (data.chartData) setChartData(data.chartData);
      });
  };
  const fetchTransactions = () => {
    /* same as before */
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions`)
      .then((res) => res.json())
      .then((data) => {
        if (data.transactions) setTransactions(data.transactions);
      });
  };
  const fetchSummary = () => {
    /* same as before */
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/summary`)
      .then((res) => res.json())
      .then((data) => {
        if (data.totalExpenses !== undefined) {
          setTotalExpenses(data.totalExpenses);
          setPersonalExpenses(data.personalExpenses);
          setThirdPartyExpenses(data.thirdPartyExpenses);
        }
      });
  };
  const fetchThirdParties = () => {
    /* same as before */
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/third-parties`)
      .then((res) => res.json())
      .then((data) => {
        if (data.thirdParties) setThirdParties(data.thirdParties);
      });
  };

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/db-status`)
      .then((res) => res.json())
      .then((data: DbStatusResponse) =>
        setMessage(
          `${data.message} (DB time: ${new Date(data.serverTime).toLocaleString()})`,
        ),
      )
      .catch(() => setMessage("Error connecting to server 😢"));

    fetchTransactions();
    fetchSummary();
    fetchChartData();
    fetchThirdParties();

    const eventSource = new EventSource(`${apiUrl}/api/stream`);
    eventSource.addEventListener("new_transaction", () => {
      fetchTransactions();
      fetchSummary();
      fetchChartData();
    });
    eventSource.addEventListener("transaction_updated", () => {
      fetchTransactions();
      fetchSummary();
      fetchChartData();
    });
    return () => eventSource.close();
  }, []);

  // --- THIRD PARTY CRUD ---
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
        } // Re-fetch transactions to update names!
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

  // --- HELPERS ---
  const simulateGoogleScript = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const isThirdParty = Math.random() > 0.7 && thirdParties.length > 0;
    const randomPerson = isThirdParty
      ? thirdParties[Math.floor(Math.random() * thirdParties.length)]
      : null;

    // Simulating dirty bank locations
    const locations = [" , San Jose", "Heredia", " , Cartago ", "Online"];

    fetch(`${apiUrl}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant: "Store " + Math.floor(Math.random() * 100),
        location: locations[Math.floor(Math.random() * locations.length)],
        date: new Date().toISOString(),
        card_type: "Visa",
        auth_code: `AUTH-${Math.floor(Math.random() * 1000000)}`,
        amount: 1500,
        is_third_party: isThirdParty,
        third_party_id: randomPerson ? randomPerson.id : null,
      }),
    });
  };

  const assignThirdPartyToTx = (personId: string | null) => {
    if (!selectedTx) return;
    const apiUrl = import.meta.env.VITE_API_URL;

    fetch(`${apiUrl}/api/transactions/${selectedTx.id}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_third_party: personId !== null, // True if there is an ID, False if null
        third_party_id: personId,
      }),
    }).then(() => {
      // Close the modal, SSE will trigger the UI reload automatically!
      setAssignModalOpen(false);
      setSelectedTx(null);
    });
  };

  const formatCurrency = (amount: number) =>
    amount.toLocaleString("es-CR", { maximumFractionDigits: 0 });

  // Clean location using Regex: removes spaces and commas from the start
  const cleanLocation = (loc: string) =>
    loc ? loc.replace(/^[\s,]+/, "").trim() : "Unknown";

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center relative">
      <div className="w-full max-w-4xl">
        {/* Header Section */}
        <header className="bg-white p-6 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center border border-gray-100 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800">Kardeva</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Financial Dashboard
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg text-sm transition-colors border border-gray-300"
            >
              Manage People
            </button>
            <button
              onClick={simulateGoogleScript}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-sm text-sm"
            >
              Simulate Transaction
            </button>
          </div>
        </header>

        {/* Chart Section */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">
            Expenses Last 7 Days
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f3f4f6"
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
                  cursor={{ fill: "#f3f4f6" }}
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* ... Keep your 4 cards ... */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <span className="text-gray-500 text-xs font-semibold mb-1">
              Monthly Income
            </span>
            <span className="text-xl font-extrabold text-green-600">
              + ₡{formatCurrency(monthlyIncome)}
            </span>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <span className="text-gray-500 text-xs font-semibold mb-1">
              My Expenses
            </span>
            <span className="text-xl font-extrabold text-red-600">
              - ₡{formatCurrency(personalExpenses)}
            </span>
          </div>
          <div className="bg-orange-50 p-5 rounded-xl shadow-sm border border-orange-100 flex flex-col">
            <span className="text-orange-700 text-xs font-semibold mb-1">
              Lent to Others
            </span>
            <span className="text-xl font-extrabold text-orange-600">
              - ₡{formatCurrency(thirdPartyExpenses)}
            </span>
          </div>
          <div className="bg-gray-900 p-5 rounded-xl shadow-md border border-gray-800 flex flex-col">
            <span className="text-gray-400 text-xs font-semibold mb-1">
              Available Balance
            </span>
            <span className="text-xl font-extrabold text-white">
              = ₡{formatCurrency(availableBalance)}
            </span>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
          <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-700">
              Recent Transactions
            </h2>
          </div>

          <ul className="divide-y divide-gray-100">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="p-5 hover:bg-gray-50 transition-colors flex justify-between items-center"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">
                      {tx.merchant}
                    </span>
                  </div>
                  {/* NEW: Display cleaned location! */}
                  <span className="text-xs text-gray-400 mt-1">
                    {new Date(tx.date).toLocaleDateString()} •{" "}
                    {cleanLocation(tx.location)} • {tx.card_type}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`font-bold ${tx.is_third_party ? "text-orange-600" : "text-red-600"}`}
                  >
                    - ₡{formatCurrency(Number(tx.amount))}
                  </span>

                  {/* NEW: Assign Button */}
                  <button
                    onClick={() => {
                      setSelectedTx(tx);
                      setAssignModalOpen(true);
                    }}
                    className={`text-[10px] px-2 py-1 rounded transition-colors font-bold ${
                      tx.is_third_party
                        ? "bg-orange-100 text-orange-800 hover:bg-orange-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tx.is_third_party
                      ? `FOR: ${tx.third_party_name?.toUpperCase()}`
                      : "ASSIGN"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* --- MODAL FOR THIRD PARTIES --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-800">Manage People</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="New person's name..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleAddPerson}
                  className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg text-sm"
                >
                  Add
                </button>
              </div>

              <ul className="divide-y divide-gray-100">
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
                        className="border border-indigo-300 rounded px-2 py-1 text-sm outline-none w-1/2"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-gray-700">
                        {person.name}
                      </span>
                    )}

                    <div className="flex gap-2">
                      {editingId === person.id ? (
                        <button
                          onClick={() => handleUpdatePerson(person.id)}
                          className="text-xs text-white bg-green-500 px-2 py-1 rounded"
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(person.id);
                            setEditName(person.name);
                          }}
                          className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePerson(person.id)}
                        className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100"
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
      {/* --- NEW MODAL: ASSIGN TRANSACTION --- */}
      {assignModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-800">
                Assign Transaction
              </h2>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 bg-gray-50">
              <p className="text-sm text-gray-600 mb-1">Transaction:</p>
              <p className="font-bold text-gray-800">
                {selectedTx.merchant} (- ₡
                {formatCurrency(Number(selectedTx.amount))})
              </p>
            </div>

            <div className="p-5">
              <p className="text-sm font-semibold text-gray-500 mb-3">
                Who is this expense for?
              </p>
              <ul className="space-y-2">
                {/* Option to revert to personal expense */}
                <li>
                  <button
                    onClick={() => assignThirdPartyToTx(null)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors font-medium text-gray-700"
                  >
                    It's mine (Personal Expense)
                  </button>
                </li>

                {/* List all registered third parties */}
                {thirdParties.map((person) => (
                  <li key={person.id}>
                    <button
                      onClick={() => assignThirdPartyToTx(person.id)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-colors font-medium text-gray-700"
                    >
                      {person.name}
                    </button>
                  </li>
                ))}
              </ul>
              {thirdParties.length === 0 && (
                <p className="text-xs text-red-500 mt-3">
                  * You need to add people in "Manage People" first.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
