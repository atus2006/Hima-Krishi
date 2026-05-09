const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const sql = fs.readFileSync('./db/schema.sql', 'utf8');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to DB, executing schema...');
    await client.query(sql);
    console.log('Schema executed successfully.');
  } catch (err) {
    console.error('Error running schema:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
