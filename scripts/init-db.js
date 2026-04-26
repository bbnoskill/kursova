// ============================================================
// AudioLib — Ініціалізація бази даних
// Виконує SQL-файли схеми, тригерів, процедур та seed даних
// ============================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 12288,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
});

async function run() {
  const client = await pool.connect();
  try {
    // Створити БД audiolib якщо не існує
    const dbCheck = await client.query(`SELECT 1 FROM pg_database WHERE datname = 'audiolib'`);
    if (dbCheck.rows.length === 0) {
      await client.query('CREATE DATABASE audiolib');
      console.log('✓ База даних audiolib створена');
    } else {
      console.log('✓ База даних audiolib вже існує');
    }
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('✓ База даних audiolib вже існує');
    } else {
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }

  // Підключення до audiolib
  const appPool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 12288,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: 'audiolib',
  });

  const appClient = await appPool.connect();
  try {
    const sqlFiles = ['schema.sql', 'triggers.sql', 'procedures.sql', 'seed.sql'];

    for (const file of sqlFiles) {
      const filePath = path.join(__dirname, '..', 'db', file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`\n► Виконання ${file}...`);
      await appClient.query(sql);
      console.log(`✓ ${file} виконано успішно`);
    }

    // Перевірка
    const tables = await appClient.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('\n═══ Створені таблиці: ═══');
    tables.rows.forEach(r => console.log(`  • ${r.table_name}`));

    const triggers = await appClient.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      GROUP BY trigger_name, event_object_table
    `);
    console.log('\n═══ Створені тригери: ═══');
    triggers.rows.forEach(r => console.log(`  • ${r.trigger_name} → ${r.event_object_table}`));

    const functions = await appClient.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `);
    console.log('\n═══ Створені функції: ═══');
    functions.rows.forEach(r => console.log(`  • ${r.routine_name}`));

    const views = await appClient.query(`
      SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
    `);
    console.log('\n═══ Створені представлення: ═══');
    views.rows.forEach(r => console.log(`  • ${r.table_name}`));

    console.log('\n✓ Ініціалізація завершена успішно!\n');
  } catch (err) {
    console.error('✗ Помилка:', err.message);
    process.exit(1);
  } finally {
    appClient.release();
    await appPool.end();
  }
}

run();
