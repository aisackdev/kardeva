import { useEffect, useState } from "react";
import type { DbStatusResponse, Transaction, ChartData } from "./types";
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
  // Here will save the message from the backend
  const [message, setMessage] = useState<string>("Loading...");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  // Hardcoded monthly income for now (e.g. 1,000,000 colones)
  const monthlyIncome = 1000000;
  const availableBalance = monthlyIncome - totalExpenses;

  // NEW: Function to load chart data
  const fetchChartData = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/chart`)
      .then((res) => res.json())
      .then((data) => {
        setChartData(data.chartData);
      })
      .catch((error) => console.error("Error fetching chart data:", error));
  };

  // Function to load the transactions from the backend
  const fetchTransactions = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions`)
      .then((res) => res.json())
      .then((data) => {
        if (data.transactions) {
          setTransactions(data.transactions);
        }
      })
      .catch((error) => console.error("Error fetching transactions:", error));
  };

  // Function to load the summary
  const fetchSummary = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/summary`)
      .then((res) => res.json())
      .then((data) => {
        if (data.totalExpenses !== undefined) {
          setTotalExpenses(data.totalExpenses);
        }
      })
      .catch((error) => console.error("Error fetching summary:", error));
  };

  useEffect(() => {
    // We read the environment variable from VITE
    const apiUrl = import.meta.env.VITE_API_URL;

    // We send the request to the backend
    fetch(`${apiUrl}/api/db-status`)
      .then((response) => response.json()) // The backend sends a plain text on route '/'
      .then((data: DbStatusResponse) =>
        setMessage(
          `${data.message} (DB time: ${new Date(data.serverTime).toLocaleString()})`,
        ),
      )
      .catch((error) => {
        console.error("There was an error connecting to the backend:", error);
        setMessage("There was an error connecting to the server 😢");
      });

    fetchTransactions();
    fetchSummary();
    fetchChartData();

    // Connect to the SSE Stream (Turn on the radio)
    const eventSource = new EventSource(`${apiUrl}/api/stream`);

    // Listen for our custom 'new_transaction' event
    eventSource.addEventListener("new_transaction", (event) => {
      console.log("New transaction received from server!", event.data);

      // We received a whisper, now we re-fetch all data to update the UI automatically
      fetchTransactions();
      fetchSummary();
      fetchChartData();
    });

    // Cleanup function - Close the connection if the user leaves the page
    return () => {
      eventSource.close();
    };
  }, []);

  // Button test to simulate Apps Script from Google
  const simulateGoogleScript = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const randomAuth = Math.floor(Math.random() * 1000000).toString();
    const amounts = [1500, 4500.5, 12000, 890];
    const merchants = ["Uber Eats", "Starbucks", "Amazon", "Netflix"];

    const mockTransaction = {
      merchant: merchants[Math.floor(Math.random() * merchants.length)],
      location: "San Jose, CR",
      date: new Date().toISOString(),
      card_type: "Visa",
      auth_code: `AUTH-${randomAuth}`,
      amount: amounts[Math.floor(Math.random() * amounts.length)],
      is_third_party: false,
    };

    fetch(`${apiUrl}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockTransaction),
    }).then(() => {
      fetchTransactions(); // Refresh the list after adding!
      fetchSummary(); // Refresh the summary after adding a new transaction!
      fetchChartData(); // Refresh chart after new transaction!
    });
  };

  // Helper function to format currency without decimals
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("es-CR", {
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        {/* Header Section */}
        <header className="bg-white p-6 rounded-xl shadow-sm mb-6 flex justify-between items-center border border-gray-100">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800">Kardeva</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Financial Dashboard
            </p>
          </div>
          <button
            onClick={simulateGoogleScript}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-sm text-sm"
          >
            + Add Test Transaction
          </button>
        </header>

        {/* DB Status Banner */}
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 text-center">
          {message}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Income Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <span className="text-gray-500 text-sm font-semibold mb-1">
              Monthly Income
            </span>
            <span className="text-2xl font-extrabold text-green-600">
              + ₡{formatCurrency(monthlyIncome)}
            </span>
          </div>

          {/* Expenses Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <span className="text-gray-500 text-sm font-semibold mb-1">
              Total Expenses
            </span>
            <span className="text-2xl font-extrabold text-red-600">
              - ₡{formatCurrency(totalExpenses)}
            </span>
          </div>

          {/* Balance Card */}
          <div className="bg-gray-900 p-5 rounded-xl shadow-md border border-gray-800 flex flex-col">
            <span className="text-gray-400 text-sm font-semibold mb-1">
              Available Balance
            </span>
            <span className="text-2xl font-extrabold text-white">
              = ₡{formatCurrency(availableBalance)}
            </span>
          </div>
        </div>

        {/* --- Chart Section */}
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
                  tickFormatter={(value) => `₡${value / 1000}k`} // Format to show 1k, 2k, etc.
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

        {/* Transactions List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-700">
              Recent Transactions
            </h2>
          </div>

          <ul className="divide-y divide-gray-100">
            {transactions.length === 0 ? (
              <li className="p-6 text-center text-gray-400">
                No transactions yet.
              </li>
            ) : (
              transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="p-5 hover:bg-gray-50 transition-colors flex justify-between items-center"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800">
                      {tx.merchant}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      {new Date(tx.date).toLocaleDateString()} • {tx.card_type}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-red-600">
                      - ₡{formatCurrency(Number(tx.amount))}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1 font-mono">
                      {tx.auth_code}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
