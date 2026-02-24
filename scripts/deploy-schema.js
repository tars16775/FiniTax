// Deploy schema to Supabase PostgreSQL directly
// Tries multiple connection methods

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load password from .env.deploy
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.deploy'), 'utf8');
const envMatch = envFile.match(/DB_PASSWORD=(.+)/);
if (envMatch) process.env.DB_PASSWORD = envMatch[1].trim();

const PROJECT_REF = 'gpizxeplpciqpkajcnjl';
const SQL_FILE = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');

// Read the SQL
const sql = fs.readFileSync(SQL_FILE, 'utf8');
console.log(`Loaded SQL file: ${sql.length} characters`);

// Connection options to try
const connections = [
  {
    name: 'Direct (port 5432)',
    connectionString: `postgresql://postgres.${PROJECT_REF}:${process.env.DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  },
  {
    name: 'Transaction pooler (port 6543)',
    connectionString: `postgresql://postgres.${PROJECT_REF}:${process.env.DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
  },
  {
    name: 'Direct DB host',
    connectionString: `postgresql://postgres:${process.env.DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  },
];

async function tryConnection(config) {
  console.log(`\nTrying: ${config.name}...`);
  const client = new Client({
    connectionString: config.connectionString,
    ssl: config.ssl,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✅ Connected!');

    // Drop existing tables/functions to do a clean deploy
    console.log('Dropping existing objects...');
    await client.query(`
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
      DROP TRIGGER IF EXISTS update_dte_invoices_updated_at ON dte_invoices;
      DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON inventory_items;
      DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
      DROP FUNCTION IF EXISTS get_user_orgs() CASCADE;
      DROP TABLE IF EXISTS consent_logs CASCADE;
      DROP TABLE IF EXISTS payroll_details CASCADE;
      DROP TABLE IF EXISTS payroll_runs CASCADE;
      DROP TABLE IF EXISTS expenses CASCADE;
      DROP TABLE IF EXISTS inventory_adjustments CASCADE;
      DROP TABLE IF EXISTS inventory_items CASCADE;
      DROP TABLE IF EXISTS dte_items CASCADE;
      DROP TABLE IF EXISTS dte_invoices CASCADE;
      DROP TABLE IF EXISTS journal_entry_lines CASCADE;
      DROP TABLE IF EXISTS journal_entries CASCADE;
      DROP TABLE IF EXISTS chart_of_accounts CASCADE;
      DROP TABLE IF EXISTS organization_members CASCADE;
      DROP TABLE IF EXISTS employees CASCADE;
      DROP TABLE IF EXISTS user_profiles CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
    `);
    console.log('✅ Clean slate ready.');

    // Execute the schema in a transaction
    console.log('Deploying schema...');
    await client.query(sql);
    console.log('✅ Schema deployed successfully!');

    // Verify tables
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name;
    `);
    console.log('\n📋 Tables created:');
    res.rows.forEach(r => console.log('  -', r.table_name));

    await client.end();
    return true;
  } catch (err) {
    console.log('❌', err.message.substring(0, 120));
    try { await client.end(); } catch {}
    return false;
  }
}

async function main() {
  if (!process.env.DB_PASSWORD) {
    console.error('ERROR: Set DB_PASSWORD environment variable');
    console.error('Usage: DB_PASSWORD=your_database_password node scripts/deploy-schema.js');
    console.error('\nFind your database password in Supabase Dashboard:');
    console.error('  Project Settings → Database → Connection string → Password');
    process.exit(1);
  }

  for (const config of connections) {
    const success = await tryConnection(config);
    if (success) {
      console.log('\n🎉 Deployment complete!');
      process.exit(0);
    }
  }

  console.log('\n❌ All connection methods failed.');
  console.log('Please check your database password and try again.');
  process.exit(1);
}

main();
