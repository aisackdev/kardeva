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
  const createThirdPartiesTableQuery = `
    CREATE TABLE IF NOT EXISTS third_parties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createTransactionsTableQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      date TIMESTAMP NOT NULL,
      card_type VARCHAR(50) NOT NULL,
      auth_code VARCHAR(100) UNIQUE NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      is_third_party BOOLEAN DEFAULT FALSE,
      third_party_id UUID REFERENCES third_parties(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createCardsTableQuery = `
    CREATE TABLE IF NOT EXISTS cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      last_four VARCHAR(4) NOT NULL UNIQUE,
      type VARCHAR(20) NOT NULL, -- 'CREDIT' or 'DEBIT'
      cutoff_day INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const addColumnsQuery = `
    ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'EXPENSE',
    ADD COLUMN IF NOT EXISTS is_base BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS billing_month VARCHAR(7),
    ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES cards(id) ON DELETE SET NULL;
  `;

  const updateCardsTableQuery = `
    ALTER TABLE cards 
    ADD COLUMN IF NOT EXISTS network VARCHAR(50) DEFAULT 'VISA';
    
    ALTER TABLE cards 
    ALTER COLUMN cutoff_day DROP NOT NULL;
  `;

  const backfillBillingMonthQuery = `
    UPDATE transactions 
    SET billing_month = TO_CHAR(date, 'YYYY-MM') 
    WHERE billing_month IS NULL;
  `;

  try {
    await pool.query(createThirdPartiesTableQuery);
    await pool.query(createTransactionsTableQuery);
    await pool.query(createCardsTableQuery);
    await pool.query(addColumnsQuery);
    await pool.query(updateCardsTableQuery);
    await pool.query(backfillBillingMonthQuery);
    console.log("✅ Database tables and migrations applied successfully.");
  } catch (error) {
    console.error("❌ Error setting up database:", error);
  }
};

pool.on("connect", () => {
  console.log("✅ Conection established sucessfully with PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected error on the database client", err);
});
