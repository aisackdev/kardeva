import { useEffect, useState } from "react";
import type { DbStatusResponse, Transaction } from "./types";

function App() {
  // Here will save the message from the backend
  const [message, setMessage] = useState<string>("Loading...");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);

  // Hardcoded monthly income for now (e.g. 1,000,000 colones)
  const monthlyIncome = 1000000;
  const availableBalance = monthlyIncome - totalExpenses;

  // Function to load the transactions from the backend
  const fetchTransactions = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions`)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data.transactions);
      })
      .catch((error) => console.error("Error fetching transactions:", error));
  };

  // NEW: Function to load the summary
  const fetchSummary = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetch(`${apiUrl}/api/transactions/summary`)
      .then((res) => res.json())
      .then((data) => {
        setTotalExpenses(data.totalExpenses);
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
              + ₡{monthlyIncome.toLocaleString("es-CR")}
            </span>
          </div>

          {/* Expenses Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <span className="text-gray-500 text-sm font-semibold mb-1">
              Total Expenses
            </span>
            <span className="text-2xl font-extrabold text-red-600">
              - ₡{totalExpenses.toLocaleString("es-CR")}
            </span>
          </div>

          {/* Balance Card */}
          <div className="bg-gray-900 p-5 rounded-xl shadow-md border border-gray-800 flex flex-col">
            <span className="text-gray-400 text-sm font-semibold mb-1">
              Available Balance
            </span>
            <span className="text-2xl font-extrabold text-white">
              = ₡{availableBalance.toLocaleString("es-CR")}
            </span>
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
                      - ₡{Number(tx.amount).toLocaleString("es-CR")}
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
