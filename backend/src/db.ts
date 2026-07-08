import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

export const initDB = async () => {
  // 1. WARNING: We drop the tables to recreate them with the new schema (Only for development!)
  const dropOldTablesQuery = `
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS third_parties CASCADE;
  `;

  // 2. We create the table for the people you lend your card to
  const createThirdPartiesTableQuery = `
    CREATE TABLE IF NOT EXISTS third_parties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 3. We create the main transactions table with all the new banking fields
  const createTransactionsTableQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      date TIMESTAMP NOT NULL,
      card_type VARCHAR(50) NOT NULL,
      auth_code VARCHAR(100) UNIQUE NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      
      -- Fields for third party tracking
      is_third_party BOOLEAN DEFAULT FALSE,
      third_party_id UUID REFERENCES third_parties(id) ON DELETE SET NULL,
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(dropOldTablesQuery);
    await pool.query(createThirdPartiesTableQuery);
    await pool.query(createTransactionsTableQuery);
    console.log(
      "✅ Database tables (third_parties & transactions) created successfully.",
    );
  } catch (error) {
    console.error("❌ Error creating database tables:", error);
  }
};

pool.on("connect", () => {
  console.log("✅ Conection established sucessfully with PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected error on the database client", err);
});
