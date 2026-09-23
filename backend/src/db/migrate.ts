import 'dotenv/config';
import { pool } from './client.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function run() {
  const drizzleDir = path.resolve(__dirname, '../../drizzle');
  if (!fs.existsSync(drizzleDir)) {
    console.log('⚠️  Pasta drizzle/ não encontrada, criando diretório vazio.');
    fs.mkdirSync(drizzleDir, { recursive: true });
    return;
  }

  const files = fs
    .readdirSync(drizzleDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  Nenhuma migration SQL encontrada em', drizzleDir);
    return;
  }

  await ensureMigrationsTable();
  const { rows: applied } = await pool.query<{ name: string }>(
    'SELECT name FROM _migrations'
  );
  const appliedSet = new Set(applied.map((r) => r.name));

  console.log(`📦 Encontradas ${files.length} migrations, ${appliedSet.size} já aplicadas.`);

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`   ⏭  ${file} (já aplicada)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(drizzleDir, file), 'utf-8');
    console.log(`   ▶️  Aplicando ${file}...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`   ✅ ${file} aplicada.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`   ❌ Falha em ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('🎉 Migrations concluídas.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});