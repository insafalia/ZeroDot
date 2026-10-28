import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function redact(message) {
  const secrets = [process.env.SUPABASE_DB_PASSWORD, process.env.SUPABASE_SECRET_KEY, process.env.APP_OWNER_PASSWORD]
    .filter(Boolean);
  let safe = message;
  for (const secret of secrets) safe = safe.split(secret).join('[redacted]');
  return safe;
}

async function applySql() {
  const directory = path.join(root, 'supabase', 'migrations');
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
  const client = new pg.Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  try {
    for (const file of files) {
      await client.query(fs.readFileSync(path.join(directory, file), 'utf8'));
    }
    const { rows } = await client.query('select name, price_inr from public.services order by sort_order');
    console.log(`Schema ready. Services: ${rows.map((row) => row.name).join(', ')}`);
  } finally {
    await client.end();
  }
}

async function ensureOwner() {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.APP_OWNER_EMAIL;
  const password = process.env.APP_OWNER_PASSWORD;
  const headers = {
    'Content-Type': 'application/json',
    apikey: secret,
    Authorization: `Bearer ${secret}`,
  };
  const created = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (created.ok) {
    console.log('Owner account created');
    return;
  }
  const body = await created.json().catch(() => ({}));
  const message = JSON.stringify(body);
  if (!/already|exists|duplicate|registered/i.test(message)) {
    throw new Error(`Could not create owner (${created.status})`);
  }
  const listed = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=200`, { headers });
  if (!listed.ok) throw new Error(`Could not list owners (${listed.status})`);
  const list = await listed.json();
  const user = (list.users || []).find((item) => (item.email || '').toLowerCase() === email.toLowerCase());
  if (!user) throw new Error('Owner account exists but was not found');
  const updated = await fetch(`${base}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!updated.ok) throw new Error(`Could not update owner (${updated.status})`);
  console.log('Owner account ready');
}

async function smokeTest() {
  const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: process.env.APP_OWNER_EMAIL,
    password: process.env.APP_OWNER_PASSWORD,
  });
  if (signInError) throw new Error(`Owner sign-in failed: ${signInError.message}`);
  const { data, error } = await client.from('services').select('name').order('sort_order');
  if (error) throw new Error(`Owner read failed: ${error.message}`);
  console.log(`Owner can read ${data.length} services`);
}

loadEnv(path.join(root, '.env'));
loadEnv(path.join(root, '.env.server'));

try {
  await applySql();
  await ensureOwner();
  await smokeTest();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redact(message));
  process.exit(1);
}
