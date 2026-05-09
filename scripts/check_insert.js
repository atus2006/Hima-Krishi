const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const res = await client.query("SELECT id, name, village, crop, quantity_kg, ready_date, phone, created_at FROM farmers ORDER BY created_at DESC LIMIT 10");
    console.log('Rows:', res.rows.length);
    console.dir(res.rows, { depth: null });
  } catch (err) {
    console.error('Error querying:', err);
  } finally {
    await client.end();
  }
}

run();
